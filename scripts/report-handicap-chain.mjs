#!/usr/bin/env node
/**
 * Report handicap adjustment chain integrity vs players.handicap_index.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOCIETY_ID = "botanic";
const TOL = 0.001;

function dbQuery(sql) {
  const tmp = path.join(os.tmpdir(), `golfapp-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  fs.writeFileSync(tmp, sql, "utf8");
  try {
    const out = execFileSync("supabase", ["db", "query", "--linked", "-f", tmp], {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8",
      maxBuffer: 30 * 1024 * 1024,
    });
    const jsonStart = out.indexOf("{");
    return JSON.parse(out.slice(jsonStart)).rows || [];
  } finally {
    fs.unlinkSync(tmp);
  }
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function eq(a, b) {
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= TOL;
}

function fmt(n) {
  if (n == null) return "?";
  return Number.isInteger(n) || Math.abs(n - Math.round(n)) < TOL ? String(Math.round(n * 1000) / 1000) : String(n);
}

function historySortKey(a) {
  const eff = a.effective_date ? String(a.effective_date).trim().slice(0, 10) : "";
  const sy = a.season_year != null ? Number(a.season_year) : null;
  if (eff && sy != null) {
    const ey = parseInt(eff.slice(0, 4), 10);
    if (!isNaN(ey) && ey > sy) return eff;
  }
  if (eff) return eff;
  if (sy != null) {
    const r = String(a.outing_label || "").match(/^R(\d+)/i);
    const round = r ? parseInt(r[1], 10) : 0;
    const mm = String(Math.min(12, Math.max(1, Math.ceil(round / 2) + 1))).padStart(2, "0");
    const dd = String(Math.min(28, Math.max(1, round * 2))).padStart(2, "0");
    return `${sy}-${mm}-${dd}`;
  }
  return "0000-01-01";
}

const players = dbQuery(`
  select player_id, player_name, handicap_index, handicap
  from thegolfapp.players
  where society_id='${SOCIETY_ID}'
  order by player_name
`);

const adjustments = dbQuery(`
  select
    ha.adjustment_id,
    ha.player_id,
    ha.season_year,
    ha.source,
    ha.outing_label,
    ha.effective_date,
    ha.amount,
    ha.index_before,
    ha.index_after,
    ha.created_at
  from thegolfapp.handicap_adjustments ha
  where ha.society_id='${SOCIETY_ID}'
  order by ha.player_id, ha.season_year, ha.outing_label
`);

const byPlayer = new Map();
for (const row of adjustments) {
  const list = byPlayer.get(row.player_id) || [];
  list.push(row);
  byPlayer.set(row.player_id, list);
}

const rowErrors = [];
const chainGaps = [];
const latestMismatch = [];
const noHistory = [];
const noAdjustmentsButIndex = [];

for (const p of players) {
  const rows = (byPlayer.get(p.player_id) || []).slice();
  if (!rows.length) {
    if (num(p.handicap_index) !== 0) noAdjustmentsButIndex.push(p);
    continue;
  }

  rows.sort((a, b) => {
    const ak = historySortKey(a);
    const bk = historySortKey(b);
    if (ak !== bk) return ak.localeCompare(bk);
    const ar = String(a.outing_label || "").match(/^R(\d+)/i);
    const br = String(b.outing_label || "").match(/^R(\d+)/i);
    if (ar && br) return parseInt(ar[1], 10) - parseInt(br[1], 10);
    return String(a.outing_label || "").localeCompare(String(b.outing_label || ""));
  });

  for (const r of rows) {
    const before = num(r.index_before);
    const after = num(r.index_after);
    const amount = num(r.amount);
    if (before == null || after == null || amount == null) continue;
    const expected = Math.round((before + amount) * 1000) / 1000;
    if (!eq(expected, after)) {
      rowErrors.push({
        player: p.player_name,
        outing: r.outing_label,
        season: r.season_year,
        source: r.source,
        before,
        amount,
        after,
        expected,
      });
    }
  }

  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const curr = rows[i];
    const prevAfter = num(prev.index_after);
    const currBefore = num(curr.index_before);
    if (!eq(prevAfter, currBefore)) {
      const gapEntry = {
        player: p.player_name,
        afterRow: `${prev.season_year} ${prev.outing_label} (${prev.source}) → ${fmt(prevAfter)}`,
        beforeRow: `${curr.season_year} ${curr.outing_label} (${curr.source}) → before ${fmt(currBefore)}`,
        delta: currBefore != null && prevAfter != null ? Math.round((currBefore - prevAfter) * 1000) / 1000 : null,
        crossSeason: prev.season_year !== curr.season_year,
        missingSeason:
          prev.season_year != null &&
          curr.season_year != null &&
          Number(curr.season_year) - Number(prev.season_year) > 1,
      };
      chainGaps.push(gapEntry);
    }
  }

  const last = rows[rows.length - 1];
  const lastAfter = num(last.index_after);
  const latest = num(p.handicap_index);
  if (!eq(lastAfter, latest)) {
    latestMismatch.push({
      player: p.player_name,
      chainEnd: lastAfter,
      latestIndex: latest,
      delta: latest != null && lastAfter != null ? Math.round((latest - lastAfter) * 1000) / 1000 : null,
      lastAdjustment: `${last.season_year} ${last.outing_label} (${last.source})`,
    });
  }
}

console.log("=== Handicap chain integrity report (botanic) ===\n");
console.log(`Players: ${players.length}`);
console.log(`Total adjustments: ${adjustments.length}`);
console.log(`Players with adjustments: ${byPlayer.size}`);

console.log(`\n--- Row math errors (index_before + amount ≠ index_after): ${rowErrors.length} ---`);
for (const e of rowErrors) {
  console.log(
    `  ${e.player} | ${e.season} ${e.outing} [${e.source}] | ${fmt(e.before)} + (${fmt(e.amount)}) ≠ ${fmt(e.after)} (expected ${fmt(e.expected)})`,
  );
}

console.log(`\n--- Chain gaps (prior index_after ≠ next index_before): ${chainGaps.length} ---`);
const withinSeasonGaps = chainGaps.filter((g) => !g.crossSeason);
const crossSeasonGaps = chainGaps.filter((g) => g.crossSeason);
const bulkToOutingGaps = withinSeasonGaps.filter(
  (g) => g.afterRow.includes("Bulk discount") && g.beforeRow.includes("2025 R"),
);
const otherWithinGaps = withinSeasonGaps.filter((g) => !bulkToOutingGaps.includes(g));
console.log(`  Within same season: ${withinSeasonGaps.length}`);
console.log(`    Bulk discount 2025 → first outing: ${bulkToOutingGaps.length}`);
console.log(`    Other within-season: ${otherWithinGaps.length}`);
console.log(`  Cross-season / missing years: ${crossSeasonGaps.length}`);

if (bulkToOutingGaps.length) {
  console.log("\n  [BULK DISCOUNT → FIRST 2025 OUTING — spreadsheet opening HC rounding]");
  for (const g of bulkToOutingGaps) {
    console.log(`  ${g.player}: ${g.afterRow} | ${g.beforeRow} | gap ${g.delta >= 0 ? "+" : ""}${g.delta}`);
  }
}

if (otherWithinGaps.length) {
  console.log("\n  [WITHIN-SEASON — likely data errors]");
  for (const g of otherWithinGaps) {
    console.log(`  ${g.player}: ${g.afterRow} | ${g.beforeRow} | gap ${g.delta >= 0 ? "+" : ""}${g.delta}`);
  }
}

console.log("\n  [CROSS-SEASON — opening HC (c/f) ≠ prior season end]");
for (const g of crossSeasonGaps) {
  const tag = g.missingSeason ? "MISSING YEAR(S)" : "year boundary";
  console.log(`  ${g.player} (${tag})`);
  console.log(`    after:  ${g.afterRow}`);
  console.log(`    before: ${g.beforeRow}`);
  if (g.delta != null) console.log(`    gap:    ${g.delta >= 0 ? "+" : ""}${g.delta}`);
}

console.log(`\n--- Latest index mismatch (final chain end ≠ players.handicap_index): ${latestMismatch.length} ---`);
for (const m of latestMismatch) {
  console.log(
    `  ${m.player} | chain ends ${fmt(m.chainEnd)} | latest ${fmt(m.latestIndex)} | delta ${m.delta >= 0 ? "+" : ""}${m.delta} | last: ${m.lastAdjustment}`,
  );
}

if (noAdjustmentsButIndex.length) {
  console.log(`\n--- Players with handicap_index but no adjustment history: ${noAdjustmentsButIndex.length} ---`);
  for (const p of noAdjustmentsButIndex.slice(0, 20)) {
    console.log(`  ${p.player_name}: index ${fmt(num(p.handicap_index))}`);
  }
  if (noAdjustmentsButIndex.length > 20) console.log(`  ... and ${noAdjustmentsButIndex.length - 20} more`);
}

const ok = rowErrors.length === 0 && chainGaps.length === 0 && latestMismatch.length === 0;
console.log(`\n=== Overall: ${ok ? "ALL CHAINS CONSISTENT WITH LATEST INDEX" : "ISSUES FOUND"} ===`);
