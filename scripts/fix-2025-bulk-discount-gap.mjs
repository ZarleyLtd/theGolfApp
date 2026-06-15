#!/usr/bin/env node
/**
 * Align Bulk discount 2025 rows so amount exactly closes the year boundary gap
 * (prior season end → first 2025 outing index_before).
 *
 * Usage:
 *   node scripts/fix-2025-bulk-discount-gap.mjs --dry-run
 *   node scripts/fix-2025-bulk-discount-gap.mjs
 */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOCIETY_ID = "botanic";
const SEASON_YEAR = 2025;
const OUTING_LABEL = "Bulk discount 2025";
const DRY_RUN = process.argv.includes("--dry-run");
const TOL = 0.001;

const NAME_ALIASES = {
  "Mick Garrahan": "Michael Garrahan",
  "David Kernan": "Dave Kernan",
  "Gary Kelly": "Garry kelly",
  "Sean Duggan": "Seán Duggan",
};

function dbQuery(sql) {
  const tmp = path.join(os.tmpdir(), `golfapp-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  fs.writeFileSync(tmp, sql, "utf8");
  try {
    const out = execFileSync("supabase", ["db", "query", "--linked", "-f", tmp], {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
    const jsonStart = out.indexOf("{");
    if (jsonStart < 0) throw new Error("Unexpected supabase output:\n" + out);
    return JSON.parse(out.slice(jsonStart)).rows || [];
  } finally {
    fs.unlinkSync(tmp);
  }
}

function esc(s) {
  return String(s).replace(/'/g, "''");
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function roundFromLabel(label) {
  const m = String(label || "").match(/^R(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

function sortKey(row) {
  const eff = row.effective_date ? String(row.effective_date).slice(0, 10) : "";
  if (eff) return eff;
  const sy = row.season_year != null ? Number(row.season_year) : 0;
  const r = roundFromLabel(row.outing_label);
  const mm = String(Math.min(12, Math.max(1, Math.ceil(r / 2) + 1))).padStart(2, "0");
  const dd = String(Math.min(28, Math.max(1, r * 2))).padStart(2, "0");
  return `${sy}-${mm}-${dd}`;
}

function eq(a, b) {
  return Math.abs(a - b) <= TOL;
}

const { adjustments: listedDiscounts } = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "2025-bulk-discount.json"), "utf8"),
);
const listedByDbName = new Map(
  listedDiscounts.map((a) => [String(NAME_ALIASES[a.playerName] || a.playerName).toLowerCase(), a.discount]),
);

const bulkRows = dbQuery(`
  select
    ha.adjustment_id,
    ha.player_id,
    p.player_name,
    ha.amount,
    ha.index_before,
    ha.index_after
  from thegolfapp.handicap_adjustments ha
  join thegolfapp.players p on p.player_id = ha.player_id
  where ha.society_id='${SOCIETY_ID}'
    and ha.season_year=${SEASON_YEAR}
    and ha.outing_label='${esc(OUTING_LABEL)}'
`);

const priorRowsAll = dbQuery(`
  select
    ha.player_id,
    p.player_name,
    ha.season_year,
    ha.outing_label,
    ha.effective_date,
    ha.index_after
  from thegolfapp.handicap_adjustments ha
  join thegolfapp.players p on p.player_id = ha.player_id
  where ha.society_id='${SOCIETY_ID}'
    and ha.season_year is not null
    and ha.season_year < ${SEASON_YEAR}
`);
const priorEndByPlayer = new Map();
for (const row of priorRowsAll) {
  const prev = priorEndByPlayer.get(row.player_id);
  if (!prev || sortKey(row).localeCompare(sortKey(prev)) >= 0) {
    priorEndByPlayer.set(row.player_id, row);
  }
}

const first2025All = dbQuery(`
  select
    ha.player_id,
    p.player_name,
    ha.season_year,
    ha.outing_label,
    ha.effective_date,
    ha.index_before
  from thegolfapp.handicap_adjustments ha
  join thegolfapp.players p on p.player_id = ha.player_id
  where ha.society_id='${SOCIETY_ID}'
    and ha.season_year=${SEASON_YEAR}
    and ha.outing_label <> '${esc(OUTING_LABEL)}'
`);
const first2025ByPlayer = new Map();
for (const row of first2025All) {
  const prev = first2025ByPlayer.get(row.player_id);
  if (!prev || sortKey(row).localeCompare(sortKey(prev)) < 0) {
    first2025ByPlayer.set(row.player_id, row);
  }
}

const updates = [];
const ok = [];
const noOuting = [];

for (const bulk of bulkRows) {
  const name = String(bulk.player_name);
  const key = name.toLowerCase();
  const listed = listedByDbName.get(key);
  const prior = priorEndByPlayer.get(bulk.player_id);
  const first = first2025ByPlayer.get(bulk.player_id);
  const priorEnd = prior ? round3(Number(prior.index_after)) : round3(Number(bulk.index_before));
  const currentAmount = round3(Number(bulk.amount));
  const currentDiscount = round3(-currentAmount);

  if (!first) {
    noOuting.push({ name, listed, currentDiscount, priorEnd, indexAfter: round3(Number(bulk.index_after)) });
    continue;
  }

  const targetBefore = round3(Number(first.index_before));
  const gapDiscount = round3(priorEnd - targetBefore);
  const requiredAmount = round3(targetBefore - priorEnd);
  const requiredIndexAfter = targetBefore;
  const requiredIndexBefore = priorEnd;

  const listedMatchesGap = listed != null && eq(listed, gapDiscount);
  const currentMatchesGap = eq(currentDiscount, gapDiscount);

  if (currentMatchesGap && eq(round3(Number(bulk.index_after)), requiredIndexAfter)) {
    ok.push({ name, gapDiscount, first: first.outing_label, listed });
    continue;
  }

  updates.push({
    adjustment_id: bulk.adjustment_id,
    player_id: bulk.player_id,
    name,
    priorEnd,
    targetBefore,
    gapDiscount,
    listed,
    currentDiscount,
    currentAmount,
    requiredAmount,
    requiredIndexBefore,
    requiredIndexAfter,
    firstOuting: first.outing_label,
    listedMatchesGap,
  });
}

console.log(`Bulk discount rows: ${bulkRows.length}`);
console.log(`Already correct (has 2025 outing): ${ok.length}`);
console.log(`No 2025 outing (unchanged): ${noOuting.length}`);
console.log(`To update: ${updates.length}\n`);

for (const u of updates) {
  console.log(
    `${u.name}: prior ${u.priorEnd} → ${u.targetBefore} | gap discount ${u.gapDiscount} | listed ${u.listed} | was ${u.currentDiscount} → amount ${u.requiredAmount}`,
  );
  console.log(`  first outing: ${u.firstOuting}${u.listedMatchesGap ? "" : " (listed ≠ gap)"}`);
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
update thegolfapp.handicap_adjustments
set
  amount = ${u.requiredAmount},
  index_before = ${u.requiredIndexBefore},
  index_after = ${u.requiredIndexAfter}
where society_id = '${SOCIETY_ID}'
  and adjustment_id = '${esc(u.adjustment_id)}';
`,
);

dbQuery(statements.join("\n"));
console.log(`\nUpdated ${updates.length} bulk discount row(s).`);
