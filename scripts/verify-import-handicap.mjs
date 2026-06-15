#!/usr/bin/env node
/**
 * Verify handicap spreadsheet JSON vs DB; create missing visitor players; import gaps.
 *
 * Usage:
 *   node scripts/verify-import-handicap.mjs 2022 --report-only
 *   node scripts/verify-import-handicap.mjs 2022
 */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOCIETY_ID = "botanic";
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const SEASON_YEAR = Number(args[0] || 2021);
const DATA_PATH = path.join(__dirname, "data", `${SEASON_YEAR}-handicap-adjustments.json`);

const NAME_ALIASES = {
  "Mick Garrahan": "Michael Garrahan",
  "David Kernan": "Dave Kernan",
  "Gary Kelly": "Garry kelly",
  "Sean Duggan": "Seán Duggan",
};

function dbQuery(sql) {
  const tmp = path.join(os.tmpdir(), `golfapp-query-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  fs.writeFileSync(tmp, sql, "utf8");
  try {
    const out = execFileSync("supabase", ["db", "query", "--linked", "-f", tmp], {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
    const jsonStart = out.indexOf("{");
    if (jsonStart < 0) throw new Error("Unexpected supabase output:\n" + out);
    const parsed = JSON.parse(out.slice(jsonStart));
    return parsed.rows || [];
  } finally {
    fs.unlinkSync(tmp);
  }
}

function dbExecuteBatches(statements, batchSize = 25) {
  for (let i = 0; i < statements.length; i += batchSize) {
    dbQuery(statements.slice(i, i + batchSize).join("\n"));
  }
}

function key(playerName, outingLabel, amount) {
  return `${playerName.toLowerCase()}|${outingLabel.toLowerCase()}|${amount}`;
}

function esc(s) {
  return String(s).replace(/'/g, "''");
}

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

if (!fs.existsSync(DATA_PATH)) {
  console.error(`Missing data file: ${DATA_PATH}`);
  process.exit(1);
}

const { adjustments: expectedRaw } = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const expected = expectedRaw.map((a) => ({
  ...a,
  dbPlayerName: NAME_ALIASES[a.playerName] || a.playerName,
}));

const players = dbQuery(
  `select player_id, player_name, visitor, handicap_index from thegolfapp.players where society_id='${SOCIETY_ID}' order by player_name`,
);
const playerByName = new Map(players.map((p) => [String(p.player_name).trim().toLowerCase(), p]));

const existing = dbQuery(`
  select p.player_name, ha.outing_label, ha.amount, ha.index_before, ha.index_after
  from thegolfapp.handicap_adjustments ha
  join thegolfapp.players p on p.player_id = ha.player_id
  where ha.society_id='${SOCIETY_ID}'
    and ha.season_year=${SEASON_YEAR}
    and ha.source='historical'
`);

const existingKeys = new Set(
  existing.map((r) => key(r.player_name, r.outing_label, Number(r.amount))),
);

const missingRecords = expected.filter((a) => !existingKeys.has(key(a.dbPlayerName, a.outingLabel, a.amount)));

const spreadsheetPlayers = [...new Set(expected.map((a) => a.playerName))];
const missingPlayers = spreadsheetPlayers.filter((name) => {
  const dbName = NAME_ALIASES[name] || name;
  return !playerByName.has(dbName.toLowerCase());
});

console.log(`Season ${SEASON_YEAR}`);
console.log("Expected adjustments:", expected.length);
console.log("Existing adjustments:", existing.length);
console.log("Missing adjustment rows:", missingRecords.length);
console.log("Missing players:", missingPlayers.length ? missingPlayers.join(", ") : "(none)");

if (process.argv.includes("--report-only")) {
  if (missingRecords.length) {
    console.log("\nMissing records:");
    for (const r of missingRecords) {
      console.log(`  ${r.dbPlayerName} | ${r.outingLabel} | ${r.amount >= 0 ? "+" : ""}${r.amount}`);
    }
  }
  process.exit(0);
}

if (missingPlayers.length) {
  const startHcByPlayer = {};
  for (const a of expected) {
    if (!startHcByPlayer[a.playerName] || a.indexBefore < startHcByPlayer[a.playerName]) {
      startHcByPlayer[a.playerName] = a.indexBefore;
    }
  }

  const inserts = [];
  for (const name of missingPlayers) {
    const dbName = NAME_ALIASES[name] || name;
    const hc = startHcByPlayer[name] ?? 18;
    const playerId = generateId("pl");
    inserts.push(
      `('${SOCIETY_ID}', '${playerId}', '${esc(dbName)}', ${Math.round(hc)}, ${hc}, true, now(), now())`,
    );
    playerByName.set(dbName.toLowerCase(), { player_id: playerId, player_name: dbName, visitor: true });
    console.log(`Creating visitor: ${dbName} (HC ${hc})`);
  }

  dbQuery(`
    insert into thegolfapp.players (society_id, player_id, player_name, handicap, handicap_index, visitor, created_at, updated_at)
    values ${inserts.join(",\n")}
  `);
}

if (!missingRecords.length) {
  console.log("All spreadsheet adjustments are already in the database.");
  process.exit(0);
}

const playersAfter = dbQuery(
  `select player_id, player_name from thegolfapp.players where society_id='${SOCIETY_ID}'`,
);
const idByName = new Map(playersAfter.map((p) => [String(p.player_name).trim().toLowerCase(), p.player_id]));

const outings = dbQuery(`
  select outing_id, outing_date, course_name
  from thegolfapp.outings
  where society_id='${SOCIETY_ID}'
    and extract(year from outing_date)=${SEASON_YEAR}
`);

const outingByCourse = new Map(
  outings.map((o) => [String(o.course_name).trim().toLowerCase(), o]),
);

const valueRows = [];
let skipped = 0;
for (const item of missingRecords) {
  const playerId = idByName.get(item.dbPlayerName.toLowerCase());
  if (!playerId) {
    skipped++;
    console.warn(`Skip (no player): ${item.dbPlayerName}`);
    continue;
  }
  const course = item.outingLabel.replace(/^R\d+\s*[-–—]\s*/i, "").trim();
  const outing = outingByCourse.get(course.toLowerCase());
  const adjId = generateId("ha");
  valueRows.push(`(
    '${SOCIETY_ID}',
    '${adjId}',
    '${playerId}',
    ${outing ? `'${outing.outing_date}'::date` : "null"},
    ${SEASON_YEAR},
    'historical',
    ${outing ? `'${outing.outing_id}'` : "null"},
    '${esc(item.outingLabel)}',
    ${item.position != null ? item.position : "null"},
    ${item.amount},
    ${item.indexBefore},
    ${item.indexAfter},
    '${esc(`Historical import ${SEASON_YEAR}: ${item.outingLabel}`)}',
    now()
  )`);
}

if (!valueRows.length) {
  console.error("Nothing to insert after player matching.");
  process.exit(1);
}

const insertPrefix = `
  insert into thegolfapp.handicap_adjustments (
    society_id, adjustment_id, player_id, effective_date, season_year, source,
    outing_id, outing_label, position, amount, index_before, index_after, reason, created_at
  ) values `;
const insertStatements = [];
for (let i = 0; i < valueRows.length; i += 25) {
  insertStatements.push(`${insertPrefix}${valueRows.slice(i, i + 25).join(",\n")};`);
}
dbExecuteBatches(insertStatements, 1);

const finalCount = dbQuery(
  `select count(*)::int as cnt from thegolfapp.handicap_adjustments where society_id='${SOCIETY_ID}' and season_year=${SEASON_YEAR} and source='historical'`,
)[0].cnt;

console.log(`Imported ${valueRows.length} adjustments (skipped ${skipped}).`);
console.log(`Total ${SEASON_YEAR} historical rows now: ${finalCount} (expected ${expected.length}).`);

if (Number(finalCount) !== expected.length) {
  console.warn("Count mismatch — re-run with --report-only to inspect remaining gaps.");
  process.exit(2);
}

console.log("Verification complete: database matches spreadsheet adjustments.");
