#!/usr/bin/env node
/**
 * Verify 2021 handicap spreadsheet vs DB; create missing visitor players; import gaps.
 *
 * Uses Supabase CLI (`supabase db query --linked`) for reads/writes.
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOCIETY_ID = "botanic";
const SEASON_YEAR = 2021;
const DATA_PATH = path.join(__dirname, "data", "2021-handicap-adjustments.json");

/** Spreadsheet name -> existing DB player name (when already present). */
const NAME_ALIASES = {
  "Mick Garrahan": "Michael Garrahan",
  "David Kernan": "Dave Kernan",
};

function dbQuery(sql) {
  const out = execFileSync("supabase", ["db", "query", "--linked", sql], {
    cwd: path.join(__dirname, ".."),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const jsonStart = out.indexOf("{");
  if (jsonStart < 0) throw new Error("Unexpected supabase output:\n" + out);
  const parsed = JSON.parse(out.slice(jsonStart));
  return parsed.rows || [];
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
    if (!startHcByPlayer[a.playerName]) {
      // use lowest index_before for this player as opening handicap
      startHcByPlayer[a.playerName] = a.indexBefore;
    } else {
      startHcByPlayer[a.playerName] = Math.min(startHcByPlayer[a.playerName], a.indexBefore);
    }
  }

  const inserts = [];
  for (const name of missingPlayers) {
    const hc = startHcByPlayer[name] ?? 18;
    const playerId = generateId("pl");
    inserts.push(
      `('${SOCIETY_ID}', '${playerId}', '${esc(name)}', ${hc}, ${hc}, true, now(), now())`,
    );
    playerByName.set(name.toLowerCase(), {
      player_id: playerId,
      player_name: name,
      visitor: true,
      handicap_index: hc,
    });
    console.log(`Creating visitor: ${name} (HC ${hc})`);
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

// Reload players after inserts
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

dbQuery(`
  insert into thegolfapp.handicap_adjustments (
    society_id, adjustment_id, player_id, effective_date, season_year, source,
    outing_id, outing_label, position, amount, index_before, index_after, reason, created_at
  ) values ${valueRows.join(",\n")}
`);

const finalCount = dbQuery(
  `select count(*)::int as cnt from thegolfapp.handicap_adjustments where society_id='${SOCIETY_ID}' and season_year=${SEASON_YEAR} and source='historical'`,
)[0].cnt;

console.log(`Imported ${valueRows.length} adjustments (skipped ${skipped}).`);
console.log(`Total 2021 historical rows now: ${finalCount} (expected ${expected.length}).`);

if (Number(finalCount) !== expected.length) {
  console.warn("Count mismatch — re-run with --report-only to inspect remaining gaps.");
  process.exit(2);
}

console.log("Verification complete: database matches spreadsheet adjustments.");
