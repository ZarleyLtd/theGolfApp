#!/usr/bin/env node
/** Parse 2025 text spreadsheet -> JSON; import via verify-import-handicap.mjs */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEASON = 2025;

/** Eight outings — R7 and R10 not played in 2025 season. */
const OUTINGS = [
  "R1 - Concra Wood",
  "R2 - Millicent",
  "R3 - St Margarets",
  "R4 - Rathsallagh",
  "R5 - Powerscourt West",
  "R6 - Newbridge",
  "R8 - Elmgreen",
  "R9 - Swords Open",
];

const ROUND_COUNT = OUTINGS.length;

const NAME_ALIASES = {
  "Mick Garrahan": "Michael Garrahan",
  "David Kernan": "Dave Kernan",
  "Gary Kelly": "Garry kelly",
  "Sean Duggan": "Seán Duggan",
};

const TEXT = fs.readFileSync(path.join(__dirname, "data", "2025-spreadsheet.txt"), "utf8");

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

if (process.argv.includes("--import") || process.argv.includes("--fix")) {
  fs.writeFileSync(jsonPath, JSON.stringify({ seasonYear: SEASON, adjustments: expected }, null, 2));
  console.log(`Wrote ${expected.length} adjustments -> ${jsonPath}`);

  const existing = dbQuery(
    `select count(*)::int as cnt from thegolfapp.handicap_adjustments where society_id='botanic' and season_year=${SEASON} and source='historical'`,
  )[0]?.cnt;
  if (Number(existing) > 0) {
    dbQuery(
      `delete from thegolfapp.handicap_adjustments where society_id='botanic' and season_year=${SEASON} and source='historical';`,
    );
    console.log(`Deleted ${existing} existing ${SEASON} historical rows.`);
  }
} else {
  console.log(`Parsed ${expected.length} adjustments from text for ${SEASON}.`);
  console.log("Run with --fix then: node scripts/verify-import-handicap.mjs 2025");
}
