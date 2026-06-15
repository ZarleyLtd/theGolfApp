#!/usr/bin/env node
/** Parse 2024 text spreadsheet -> JSON; compare/fix against DB. */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEASON = 2024;

/** Nine outings — R8 not played in 2024 season. */
const OUTINGS = [
  "R1 - Co. Meath GC",
  "R2 - Royal Curragh",
  "R3 - Rathcore",
  "R4 - Kilkea Castle",
  "R5 - Royal Tara",
  "R6 - Newbridge",
  "R7 - Balcarrick",
  "R9 - Swords Open",
  "R10 - Elmgreen",
];

const ROUND_COUNT = OUTINGS.length;

const NAME_ALIASES = {
  "Mick Garrahan": "Michael Garrahan",
  "David Kernan": "Dave Kernan",
  "Gary Kelly": "Garry kelly",
  "Sean Duggan": "Seán Duggan",
};

const TEXT = fs.readFileSync(path.join(__dirname, "data", "2024-spreadsheet.txt"), "utf8");

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
  const start = Number(cols[4]);
  const roundCols = cols.slice(5);
  const rounds = [];
  for (let i = 0; i < ROUND_COUNT; i++) {
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

const jsonPath = path.join(__dirname, "data", `${SEASON}-handicap-adjustments.json`);
const adjustments = expected.map(({ dbPlayerName, ...r }) => r);

if (process.argv.includes("--import") || process.argv.includes("--fix")) {
  fs.writeFileSync(jsonPath, JSON.stringify({ seasonYear: SEASON, adjustments }, null, 2));
  console.log(`Wrote ${adjustments.length} adjustments -> ${jsonPath}`);

  const existing = dbQuery(
    `select count(*)::int as cnt from thegolfapp.handicap_adjustments where society_id='botanic' and season_year=${SEASON} and source='historical'`,
  )[0]?.cnt;
  if (Number(existing) > 0) {
    dbQuery(
      `delete from thegolfapp.handicap_adjustments where society_id='botanic' and season_year=${SEASON} and source='historical';`,
    );
    console.log(`Deleted ${existing} existing 2024 historical rows.`);
  }
} else {
  console.log(`Parsed ${adjustments.length} adjustments from text for ${SEASON}.`);
  console.log("Run with --fix to write JSON and clear DB rows, then:");
  console.log("  node scripts/verify-import-handicap.mjs 2024");
}
