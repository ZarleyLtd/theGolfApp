#!/usr/bin/env node
/**
 * Set players.handicap_index (and playing handicap) to final chain index_after
 * wherever they differ.
 *
 * Usage:
 *   node scripts/sync-handicap-index-from-chain.mjs --dry-run
 *   node scripts/sync-handicap-index-from-chain.mjs
 */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOCIETY_ID = "botanic";
const TOL = 0.001;
const DRY_RUN = process.argv.includes("--dry-run");

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

function esc(s) {
  return String(s).replace(/'/g, "''");
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function eq(a, b) {
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= TOL;
}

function playingHandicapFromIndex(index) {
  return Math.round(index);
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
    ha.player_id,
    ha.season_year,
    ha.source,
    ha.outing_label,
    ha.effective_date,
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

const updates = [];

for (const p of players) {
  const rows = (byPlayer.get(p.player_id) || []).slice();
  if (!rows.length) continue;

  rows.sort((a, b) => {
    const ak = historySortKey(a);
    const bk = historySortKey(b);
    if (ak !== bk) return ak.localeCompare(bk);
    const ar = String(a.outing_label || "").match(/^R(\d+)/i);
    const br = String(b.outing_label || "").match(/^R(\d+)/i);
    if (ar && br) return parseInt(ar[1], 10) - parseInt(br[1], 10);
    return String(a.outing_label || "").localeCompare(String(b.outing_label || ""));
  });

  const last = rows[rows.length - 1];
  const chainEnd = num(last.index_after);
  const currentIndex = num(p.handicap_index);
  if (chainEnd == null || eq(chainEnd, currentIndex)) continue;

  const newPlaying = playingHandicapFromIndex(chainEnd);
  updates.push({
    player_id: p.player_id,
    player_name: p.player_name,
    fromIndex: currentIndex,
    toIndex: chainEnd,
    fromHandicap: num(p.handicap),
    toHandicap: newPlaying,
    lastAdjustment: `${last.season_year ?? "?"} ${last.outing_label} (${last.source})`,
  });
}

console.log(`Players to update: ${updates.length}\n`);
for (const u of updates) {
  console.log(
    `  ${u.player_name}: index ${u.fromIndex} → ${u.toIndex} | handicap ${u.fromHandicap} → ${u.toHandicap} | last: ${u.lastAdjustment}`,
  );
}

if (!updates.length) {
  console.log("\nNothing to update.");
  process.exit(0);
}

if (DRY_RUN) {
  console.log("\nDry run — no database changes.");
  process.exit(0);
}

const statements = updates.map(
  (u) => `
update thegolfapp.players
set
  handicap_index = ${u.toIndex},
  handicap = ${u.toHandicap},
  updated_at = now()
where society_id = '${SOCIETY_ID}'
  and player_id = '${esc(u.player_id)}';
`,
);

dbQuery(statements.join("\n"));
console.log(`\nUpdated ${updates.length} player(s).`);
