#!/usr/bin/env node
/**
 * Build handicap adjustment JSON for a season from structured round data.
 * Usage: node scripts/build-handicap-season-data.mjs 2022
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seasonYear = Number(process.argv[2] || 2022);

const OUTINGS_2022 = [
  "R1 - Hollywood Lakes",
  "R2 - Moyvalley",
  "R3 - Newbridge",
  "R4 - St Margaret's",
  "R5 - Co Meath (Trim)",
  "R6 - Tulfarris",
  "R7 - Headfort (old)",
  "R8 - Kilkea Castle",
  "R9 - New Forest",
  "R10 - Balcarrick",
];

const OUTINGS_2023 = [
  "R1 - Balcarrick",
  "R2 - Ardee",
  "R3 - Hollywood Lakes",
  "R4 - Donabate",
  "R5 - Deer Park",
  "R6 - Royal Curragh",
  "R7 - Rathallagh",
  "R8 - Newbridge",
  "R9 - Elmgreen",
  "R10 - Sillogue",
];

/** start HC (c/f 2022) and per-round [position, adjustment] — blank adj omitted. */
const PLAYERS_2022 = {
  "John Barry": {
    start: 21,
    rounds: [[null, 1], [null, ""], [null, ""], [null, ""], [null, 1], [null, ""], [null, ""], [null, ""], [null, 1], [null, ""]],
  },
  "Noel Brady": {
    start: 20,
    rounds: [[9, -1], [null, 1], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""], [null, 1], [null, ""], [null, ""]],
  },
  "Jim Brennan": {
    start: 19,
    rounds: [[null, 1], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""], [null, 1], [null, ""], [null, 1], [10, -2]],
  },
  "Charlie Butler": {
    start: 36,
    rounds: [[null, 1], [null, 1], [9, -2], [null, 1], [null, 1], [null, ""], [null, 1], [null, ""], [null, 1], [null, 1]],
  },
  "Declan Byrne": {
    start: 32,
    rounds: [[null, ""], [null, 1], [null, ""], [null, ""], [3, -2.5], [10, -4], [null, ""], [null, ""], [null, 1], [null, ""]],
  },
  "Michael Connolly": {
    start: 35,
    rounds: [[null, 1], [null, ""], [null, ""], [null, 1], [null, 1], [null, ""], [null, ""], [null, 1], [9, -2], [null, ""]],
  },
  "Tony Corcoran": {
    start: 36,
    rounds: [[null, ""], [null, ""], [null, 1], [null, 1], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""], [null, ""]],
  },
  "Rory Cronin": {
    start: 18,
    rounds: [[null, 1], [null, 1], [null, ""], [null, ""], [null, 1], [null, ""], [null, 1], [null, ""], [null, ""], [null, ""]],
  },
  "Niall Cullen": {
    start: 40,
    rounds: [[null, 1], [null, 1], [null, 1], [null, 1], [null, 1], [10, -4], [null, ""], [null, 1], [null, ""], [null, ""]],
  },
  "Kevin Daly": {
    start: 18,
    rounds: [[8, -1], [null, ""], [null, ""], [null, ""], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""], [null, ""]],
  },
  "John Donnelly": {
    start: 14,
    rounds: [[null, ""], [null, ""], [null, 1], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""], [null, ""], [9, -0.5]],
  },
  "Dave Doyle": {
    start: 19,
    rounds: [[null, ""], [null, ""], [null, 1], [null, 1], [null, 1], [null, 1], [null, 1], [9, -1], [null, ""], [null, ""]],
  },
  "Gerry Duffy": {
    start: 22,
    rounds: [[null, 1], [null, 1], [null, ""], [null, 1], [null, 1], [null, 1], [null, 1], [null, 1], [null, 1], [null, 1]],
  },
  "Kevin Duggan": {
    start: 30,
    rounds: [[null, 1], [null, ""], [null, ""], [null, 1], [null, ""], [null, 1], [null, 1], [null, ""], [null, ""], [null, ""]],
  },
  "Paul Flynn": {
    start: 33,
    rounds: [[10, -5], [null, 1], [null, ""], [9, -1], [null, 1], [null, ""], [null, 1], [null, ""], [null, ""], [null, 1]],
  },
  "Kevin Foley": {
    start: 16,
    rounds: [[null, ""], [null, ""], [null, ""], [null, ""], [null, 1], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""]],
  },
  "Mark Fowler": {
    start: 20,
    rounds: [[null, ""], [null, ""], [null, ""], [null, ""], [null, 1], [null, 1], [null, ""], [null, 1], [null, 1], [null, 1]],
  },
  "Mick Garrahan": {
    start: 18,
    rounds: [[null, 1], [null, ""], [null, ""], [null, 1], [10, -2.5], [null, 1], [null, ""], [null, ""], [null, ""], [null, 1]],
  },
  "Mick Gilligan": {
    start: 18,
    rounds: [[null, ""], [null, ""], [8, -2], [null, 1], [null, 1], [9, -0.5], [null, ""], [null, 1], [null, ""], [null, 1]],
  },
  "Stephen Hanna": {
    start: 16,
    rounds: [[null, ""], [null, ""], [null, 1], [null, ""], [null, 1], [null, 1], [9, -1], [null, 1], [null, ""], [null, 1]],
  },
  "Aidan Kelly": {
    start: 26,
    rounds: [[null, 1], [9, -1.5], [null, ""], [null, ""], [null, ""], [null, ""], [null, ""], [null, 1], [null, ""], [null, 1]],
  },
  "David Kernan": {
    start: 26,
    rounds: [[null, 1], [null, 1], [null, 1], [null, ""], [null, 1], [null, 1], [null, 1], [null, ""], [null, ""], [null, ""]],
  },
  "Frank Lynott": {
    start: 35,
    rounds: [[null, 1], [null, 1], [null, 1], [null, 1], [null, 1], [null, 1], [null, 1], [null, 1], [null, 1], [null, ""]],
  },
  "Colin Moore": {
    start: 35,
    rounds: [[null, 1], [null, 1], [null, 1], [null, 1], [null, ""], [null, 1], [null, ""], [null, 1], [null, ""], [null, 1]],
  },
  "Mark Mulholland": {
    start: 16,
    rounds: [[null, ""], [null, 1], [null, ""], [null, 1], [null, ""], [null, 1], [null, 1], [null, 1], [null, ""], [null, 1]],
  },
  "Paul Murphy": {
    start: 32,
    rounds: [[null, ""], [null, 1], [null, 1], [10, -4], [null, 1], [null, ""], [null, 1], [null, 1], [null, 1], [null, ""]],
  },
  "Alan Neary": {
    start: 15,
    rounds: [[null, ""], [null, ""], [null, 1], [null, ""], [null, 1], [null, ""], [null, ""], [10, -1], [null, ""], [null, ""]],
  },
  "Tony Neary": {
    start: 38,
    rounds: [[null, 1], [null, ""], [null, 1], [null, 1], [null, ""], [null, ""], [null, 1], [null, 1], [null, ""], [null, ""]],
  },
  "John Power": {
    start: 22,
    rounds: [[null, 1], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""], [null, ""], [null, 1], [null, 1], [null, ""]],
  },
  "Andy Ryan": {
    start: 12,
    rounds: [[null, ""], [null, ""], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""], [null, ""], [null, ""], [null, ""]],
  },
  "Shay Ryan": {
    start: 26,
    rounds: [[null, 1], [10, -2.5], [null, ""], [null, ""], [null, ""], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""]],
  },
  "Bill Tonge": {
    start: 23,
    rounds: [[null, 1], [null, ""], [null, ""], [null, ""], [null, 1], [null, ""], [null, ""], [null, ""], [10, -2], [null, ""]],
  },
  "Sean Ward": {
    start: 18,
    rounds: [[null, ""], [null, ""], [10, -1.5], [null, ""], [null, ""], [null, ""], [null, 1], [null, ""], [null, ""], [null, ""]],
  },
};

const PLAYERS_2023 = {
  "John Barry": {
    start: 25,
    rounds: [[null, ""], [null, ""], [null, ""], [1, 1], [null, 1], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""]],
  },
  "Noel Brady": {
    start: 22,
    rounds: [[null, ""], [null, 1], [null, ""], [null, ""], [null, 1], [null, 1], [null, ""], [null, ""], [null, ""], [10, -2]],
  },
  "Jim Brennan": {
    start: 21,
    rounds: [[null, ""], [null, ""], [null, ""], [null, ""], [null, ""], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""]],
  },
  "Charlie Butler": {
    start: 41,
    rounds: [[9, -2.5], [null, ""], [null, 1], [null, ""], [null, 1], [null, ""], [null, ""], [null, 1], [null, ""], [null, ""]],
  },
  "Declan Byrne": {
    start: 27.5,
    rounds: [[null, 1], [null, 1], [null, ""], [9, -1.5], [null, 1], [9, -1.5], [null, 1], [9, -1], [null, 1], [null, ""]],
  },
  "Key Byrne": {
    start: 21,
    rounds: [[null, 7], [null, 5], [null, ""], [null, 1], [null, 1], [null, 1], [null, 1], [null, ""], [null, ""], [null, ""]],
  },
  "Michael Connolly": {
    start: 37,
    rounds: [[null, 1], [null, 1], [null, ""], [null, 1], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""], [null, ""]],
  },
  "Tony Corcoran": {
    start: 39,
    rounds: [[null, 1], [null, 1], [null, ""], [7, -0.5], [9, -2.5], [null, 1], [null, ""], [null, ""], [null, ""], [null, 1]],
  },
  "Rory Cronin": {
    start: 22,
    rounds: [[null, ""], [null, ""], [null, ""], [null, ""], [null, ""], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""]],
  },
  "Niall Cullen": {
    start: 42,
    rounds: [[null, 1], [null, ""], [null, ""], [null, ""], [10, -4.5], [null, 1], [null, ""], [null, ""], [null, 1], [null, ""]],
  },
  "John Donnelly": {
    start: 15.5,
    rounds: [[null, ""], [null, ""], [10, -1], [null, ""], [null, ""], [null, ""], [null, ""], [null, 1], [6, -0.5], [null, ""]],
  },
  "Dave Doyle": {
    start: 23,
    rounds: [[null, 1], [10, -2.5], [null, ""], [null, 1], [8, -0.5], [null, ""], [null, 1], [null, ""], [null, ""], [null, ""]],
  },
  "Kevin Duggan": {
    start: 34,
    rounds: [[null, ""], [9, -2.5], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""], [null, 1], [null, ""], [null, ""]],
  },
  "Sean Duggan": {
    start: 21,
    rounds: [[null, ""], [null, ""], [null, ""], [null, 1], [null, 1], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""]],
  },
  "Paul Flynn": {
    start: 31,
    rounds: [[null, ""], [null, 1], [null, ""], [null, 1], [null, 1], [null, 1], [null, ""], [null, ""], [10, -4.5], [null, ""]],
  },
  "Mark Fowler": {
    start: 25,
    rounds: [[null, ""], [null, 1], [null, ""], [null, ""], [null, ""], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""]],
  },
  "Mick Garrahan": {
    start: 18.5,
    rounds: [[null, ""], [8, -0.5], [null, ""], [null, 1], [null, ""], [null, 1], [null, ""], [null, 1], [null, ""], [null, ""]],
  },
  "Mick Gilligan": {
    start: 19.5,
    rounds: [[null, ""], [null, ""], [null, ""], [null, 1], [null, ""], [null, 1], [10, -2.5], [null, ""], [7, -0.5], [null, ""]],
  },
  "Stephen Hanna": {
    start: 20,
    rounds: [[null, ""], [null, ""], [null, ""], [null, ""], [null, ""], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""]],
  },
  "Aidan Kelly": {
    start: 27.5,
    rounds: [[10, -2.5], [null, 1], [null, 1], [8, -0.5], [null, ""], [null, ""], [9, -1.5], [null, ""], [5, -0.5], [null, 1]],
  },
  "Gary Kelly": {
    start: 18,
    rounds: [[null, ""], [null, 1], [null, 7], [null, 1], [null, ""], [null, 1], [null, ""], [null, 1], [null, ""], [null, 1]],
  },
  "David Kernan": {
    start: 32,
    rounds: [[null, 1], [null, 1], [null, ""], [10, -4.5], [null, ""], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""]],
  },
  "Frank Lynott": {
    start: 44,
    rounds: [[null, ""], [null, 1], [null, ""], [null, ""], [null, 1], [null, ""], [null, 1], [null, ""], [3, -0.5], [null, ""]],
  },
  "Mark Mulholland": {
    start: 22,
    rounds: [[null, 1], [null, ""], [null, ""], [null, 1], [null, ""], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""]],
  },
  "Paul Murphy": {
    start: 34,
    rounds: [[null, 1], [null, ""], [null, 1], [null, 1], [null, 1], [null, 1], [null, ""], [null, ""], [4, -0.5], [null, 1]],
  },
  "Alan Neary": {
    start: 16,
    rounds: [[null, ""], [7, -0.5], [null, ""], [null, ""], [null, ""], [null, ""], [null, ""], [null, 1], [null, ""], [null, 1]],
  },
  "Paudge Neary": {
    start: 18,
    rounds: [[null, ""], [null, ""], [null, ""], [null, 1], [2, 2], [null, ""], [null, ""], [null, 1], [null, 1], [null, 1]],
  },
  "Tony Neary": {
    start: 43,
    rounds: [[null, 1], [null, 1], [null, 1], [null, 1], [10, -4.5], [null, ""], [null, 1], [null, 1], [4, -0.5], [null, ""]],
  },
  "John Power": {
    start: 26,
    rounds: [[null, ""], [null, ""], [null, ""], [null, ""], [null, ""], [null, ""], [null, 1], [null, ""], [null, ""], [null, 1]],
  },
  "Shay Ryan": {
    start: 25.5,
    rounds: [[null, ""], [null, ""], [null, ""], [null, ""], [null, ""], [null, ""], [null, ""], [10, -2.5], [null, ""], [null, ""]],
  },
  "Bill Tonge": {
    start: 24,
    rounds: [[null, ""], [null, ""], [9, -1], [null, ""], [null, ""], [null, ""], [null, 1], [null, ""], [9, -1.5], [null, ""]],
  },
  "Sean Ward": {
    start: 17.5,
    rounds: [[null, ""], [null, 1], [null, ""], [null, 1], [null, 1], [null, ""], [null, ""], [null, ""], [null, ""], [null, -1]],
  },
};

const SEASON_DATA = {
  2022: { outings: OUTINGS_2022, players: PLAYERS_2022 },
  2023: { outings: OUTINGS_2023, players: PLAYERS_2023 },
};
const season = SEASON_DATA[seasonYear];
if (!season) {
  console.error(`No structured data for season ${seasonYear}`);
  process.exit(1);
}
const { outings: OUTINGS, players } = season;

function parseAdj(raw) {
  if (raw === "" || raw == null) return 0;
  return Number(raw);
}

function roundHc(n) {
  return Math.round(n * 1000) / 1000;
}

const adjustments = [];
for (const [playerName, data] of Object.entries(players)) {
  let index = data.start;
  data.rounds.forEach(([pos, adjRaw], i) => {
    const amount = parseAdj(adjRaw);
    if (amount === 0) return;
    const indexBefore = index;
    const indexAfter = roundHc(indexBefore + amount);
    adjustments.push({
      playerName,
      outingLabel: OUTINGS[i],
      position: pos,
      amount,
      indexBefore,
      indexAfter,
    });
    index = indexAfter;
  });
}

const outPath = path.join(__dirname, "data", `${seasonYear}-handicap-adjustments.json`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ seasonYear, adjustments }, null, 2));
console.log(`Wrote ${adjustments.length} adjustments for ${Object.keys(players).length} players -> ${outPath}`);
