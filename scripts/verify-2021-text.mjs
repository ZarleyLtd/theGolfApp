#!/usr/bin/env node
/** Parse 2021 text spreadsheet, compare to JSON/DB, optionally reload. */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEASON = 2021;

const OUTINGS = [
  "R1 - Elmgreen",
  "R2 - Beaverstown",
  "R3 - K Club",
  "R4 - Headfort",
  "R5 - Kilkea Castle",
  "R6 - Balcarrick",
  "R7 - New Forest",
  "R8 - Killeen",
  "R9 - Roganstown",
  "R10 - Powerscourt",
];

const NAME_ALIASES = {
  "Mick Garrahan": "Michael Garrahan",
  "David Kernan": "Dave Kernan",
};

const TEXT = fs.readFileSync(path.join(__dirname, "data", "2021-spreadsheet.txt"), "utf8");

function parseAdj(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s === "." || s === "0") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parsePos(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s === ".") return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function dbName(name) {
  return NAME_ALIASES[name] || name;
}

function parseRow(line) {
  const cols = line.split("\t");
  const playerName = cols[0].trim();
  const start = Number(cols[4]); // 2020 opening HC
  const roundCols = cols.slice(5);
  const rounds = [];
  for (let i = 0; i < 10; i++) {
    rounds.push([roundCols[i * 3], roundCols[i * 3 + 1], roundCols[i * 3 + 2]]);
  }
  return { playerName, start, rounds };
}

const expected = [];
for (const line of TEXT.trim().split("\n")) {
  const { playerName, start, rounds } = parseRow(line);
  let index = start;
  rounds.forEach(([pRaw, adjRaw, hcRaw], i) => {
    const amount = parseAdj(adjRaw);
    if (amount === 0) return;
    const indexBefore = index;
    const indexAfter =
      hcRaw != null && String(hcRaw).trim() !== "" ? Number(hcRaw) : Math.round((indexBefore + amount) * 1000) / 1000;
    expected.push({
      playerName,
      dbPlayerName: dbName(playerName),
      outingLabel: OUTINGS[i],
      position: parsePos(pRaw),
      amount,
      indexBefore,
      indexAfter,
    });
    index = indexAfter;
  });
}

function dbQuery(sql) {
  const tmp = path.join(os.tmpdir(), `golfapp-${Date.now()}.sql`);
  fs.writeFileSync(tmp, sql, "utf8");
  try {
    const out = execFileSync("supabase", ["db", "query", "--linked", "-f", tmp], {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
    const jsonStart = out.indexOf("{");
    return JSON.parse(out.slice(jsonStart)).rows || [];
  } finally {
    fs.unlinkSync(tmp);
  }
}

function matchKey(r) {
  return `${r.dbPlayerName.toLowerCase()}|${r.outingLabel.toLowerCase()}|${r.amount}`;
}

const jsonPath = path.join(__dirname, "data", `${SEASON}-handicap-adjustments.json`);
const loadedJson = fs.existsSync(jsonPath)
  ? JSON.parse(fs.readFileSync(jsonPath, "utf8")).adjustments.map((a) => ({
      ...a,
      dbPlayerName: dbName(a.playerName),
    }))
  : [];

const dbRows = dbQuery(`
  select p.player_name, ha.outing_label, ha.amount, ha.index_before, ha.index_after, ha.position
  from thegolfapp.handicap_adjustments ha
  join thegolfapp.players p on p.player_id = ha.player_id
  where ha.society_id='botanic' and ha.season_year=${SEASON} and ha.source='historical'
  order by p.player_name, ha.outing_label
`).map((r) => ({
  dbPlayerName: r.player_name,
  outingLabel: r.outing_label,
  amount: Number(r.amount),
  indexBefore: Number(r.index_before),
  indexAfter: Number(r.index_after),
  position: r.position != null ? Number(r.position) : null,
}));

const expectedMap = new Map(expected.map((r) => [matchKey(r), r]));
const dbMap = new Map(dbRows.map((r) => [matchKey(r), r]));

const missingFromDb = expected.filter((r) => !dbMap.has(matchKey(r)));
const extraInDb = dbRows.filter((r) => !expectedMap.has(matchKey(r)));

const indexMismatches = [];
for (const e of expected) {
  const db = dbRows.find(
    (r) =>
      r.dbPlayerName.toLowerCase() === e.dbPlayerName.toLowerCase() &&
      r.outingLabel.toLowerCase() === e.outingLabel.toLowerCase() &&
      r.amount === e.amount,
  );
  if (!db) continue;
  if (db.indexBefore !== e.indexBefore || db.indexAfter !== e.indexAfter) {
    indexMismatches.push({
      player: e.dbPlayerName,
      outing: e.outingLabel,
      amount: e.amount,
      expected: `${e.indexBefore}->${e.indexAfter}`,
      db: `${db.indexBefore}->${db.indexAfter}`,
    });
  }
}

console.log(`Expected (text): ${expected.length}`);
console.log(`In JSON file:    ${loadedJson.length}`);
console.log(`In database:     ${dbRows.length}`);
console.log(`\n=== MISSING from DB (${missingFromDb.length}) ===`);
for (const r of missingFromDb) {
  console.log(
    `  ${r.dbPlayerName} | ${r.outingLabel} | ${r.amount >= 0 ? "+" : ""}${r.amount} | ${r.indexBefore}->${r.indexAfter}`,
  );
}
console.log(`\n=== EXTRA in DB (${extraInDb.length}) ===`);
for (const r of extraInDb) {
  console.log(`  ${r.dbPlayerName} | ${r.outingLabel} | ${r.amount >= 0 ? "+" : ""}${r.amount}`);
}
console.log(`\n=== INDEX MISMATCHES (${indexMismatches.length}) ===`);
for (const m of indexMismatches) {
  console.log(`  ${m.player} | ${m.outing} | ${m.amount} | text ${m.expected} vs db ${m.db}`);
}

if (process.argv.includes("--fix")) {
  fs.writeFileSync(jsonPath, JSON.stringify({ seasonYear: SEASON, adjustments: expected.map(({ dbPlayerName, ...r }) => r) }, null, 2));
  console.log(`\nWrote ${jsonPath}`);
  if (dbRows.length) {
    dbQuery(
      `delete from thegolfapp.handicap_adjustments where society_id='botanic' and season_year=${SEASON} and source='historical';`,
    );
    console.log("Deleted existing 2021 historical rows.");
  }
  console.log("Run: node scripts/verify-import-handicap.mjs 2021");
}
