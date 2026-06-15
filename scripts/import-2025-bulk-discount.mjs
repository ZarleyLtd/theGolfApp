#!/usr/bin/env node
/**
 * Import 2025 season-start bulk handicap discounts (not tied to an outing).
 *
 * Usage:
 *   node scripts/import-2025-bulk-discount.mjs --dry-run
 *   node scripts/import-2025-bulk-discount.mjs
 */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOCIETY_ID = "botanic";
const DATA_PATH = path.join(__dirname, "data", "2025-bulk-discount.json");
const DRY_RUN = process.argv.includes("--dry-run");

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

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

const { seasonYear, outingLabel, adjustments } = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const effectiveDate = `${seasonYear}-01-01`;

const players = dbQuery(
  `select player_id, player_name from thegolfapp.players where society_id='${SOCIETY_ID}'`,
);
const idByName = new Map(players.map((p) => [String(p.player_name).trim().toLowerCase(), p.player_id]));

const existing = dbQuery(`
  select p.player_name, ha.index_before, ha.index_after, ha.amount
  from thegolfapp.handicap_adjustments ha
  join thegolfapp.players p on p.player_id = ha.player_id
  where ha.society_id='${SOCIETY_ID}'
    and ha.season_year=${seasonYear}
    and ha.outing_label='${esc(outingLabel)}'
`);
const existingNames = new Set(existing.map((r) => String(r.player_name).toLowerCase()));

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

const priorRowsAll = dbQuery(`
  select
    p.player_name,
    ha.season_year,
    ha.outing_label,
    ha.effective_date,
    ha.index_after
  from thegolfapp.handicap_adjustments ha
  join thegolfapp.players p on p.player_id = ha.player_id
  where ha.society_id='${SOCIETY_ID}'
    and ha.season_year is not null
    and ha.season_year < ${seasonYear}
`);
const priorEndByName = new Map();
for (const row of priorRowsAll) {
  const key = String(row.player_name).trim().toLowerCase();
  const prev = priorEndByName.get(key);
  if (!prev || sortKey(row).localeCompare(sortKey(prev)) >= 0) {
    priorEndByName.set(key, row);
  }
}
for (const [key, row] of [...priorEndByName.entries()]) {
  priorEndByName.set(key, Number(row.index_after));
}

const first2025All = dbQuery(`
  select
    p.player_name,
    ha.season_year,
    ha.outing_label,
    ha.effective_date,
    ha.index_before
  from thegolfapp.handicap_adjustments ha
  join thegolfapp.players p on p.player_id = ha.player_id
  where ha.society_id='${SOCIETY_ID}'
    and ha.season_year=${seasonYear}
    and ha.outing_label <> '${esc(outingLabel)}'
`);
const first2025ByName = new Map();
for (const row of first2025All) {
  const key = String(row.player_name).trim().toLowerCase();
  const prev = first2025ByName.get(key);
  if (!prev || sortKey(row).localeCompare(sortKey(prev)) < 0) {
    first2025ByName.set(key, row);
  }
}

const valueRows = [];
const skipped = [];
const warnings = [];

for (const item of adjustments) {
  const dbName = NAME_ALIASES[item.playerName] || item.playerName;
  const key = dbName.toLowerCase();

  if (existingNames.has(key)) {
    skipped.push(`${dbName} (already imported)`);
    continue;
  }

  const playerId = idByName.get(key);
  if (!playerId) {
    warnings.push(`No player record: ${item.playerName} → ${dbName}`);
    continue;
  }

  const indexBefore = priorEndByName.get(key);
  if (indexBefore == null || !Number.isFinite(indexBefore)) {
    warnings.push(`No pre-${seasonYear} history for ${dbName} — cannot derive index_before`);
    continue;
  }

  const amount = round3(-item.discount);
  const indexAfter = round3(indexBefore + amount);
  const first = first2025ByName.get(key);
  const chainOk =
    first == null || Math.abs(Number(first.index_before) - indexAfter) <= 0.001;

  console.log(
    `${dbName}: ${indexBefore} ${amount} → ${indexAfter}` +
      (first ? ` | first 2025 (${first.outing_label}) before=${first.index_before} ${chainOk ? "OK" : "GAP"}` : " | no 2025 outings"),
  );

  if (!chainOk) {
    warnings.push(
      `${dbName}: bulk ends ${indexAfter} but first 2025 outing starts ${first.index_before} (${first.outing_label})`,
    );
  }

  const adjId = generateId("ha");
  valueRows.push(`(
    '${SOCIETY_ID}',
    '${adjId}',
    '${playerId}',
    '${effectiveDate}'::date,
    ${seasonYear},
    'historical',
    null,
    '${esc(outingLabel)}',
    null,
    ${amount},
    ${indexBefore},
    ${indexAfter},
    '${esc(outingLabel)}',
    now()
  )`);
}

console.log(`\nTo insert: ${valueRows.length}, skip: ${skipped.length}, warnings: ${warnings.length}`);
if (skipped.length) console.log("Skipped:", skipped.join("; "));
if (warnings.length) {
  console.log("\nWarnings:");
  for (const w of warnings) console.log(`  ${w}`);
}

if (!valueRows.length) {
  console.log(DRY_RUN ? "Dry run — nothing to insert." : "Nothing to insert.");
  process.exit(warnings.length ? 1 : 0);
}

if (DRY_RUN) {
  console.log("\nDry run — no database changes.");
  process.exit(0);
}

const insertSql = `
  insert into thegolfapp.handicap_adjustments (
    society_id, adjustment_id, player_id, effective_date, season_year, source,
    outing_id, outing_label, position, amount, index_before, index_after, reason, created_at
  ) values ${valueRows.join(",\n")};
`;
dbQuery(insertSql);
console.log(`\nImported ${valueRows.length} bulk discount rows for ${seasonYear}.`);
