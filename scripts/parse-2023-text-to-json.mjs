#!/usr/bin/env node
/** Parse authoritative 2023 text spreadsheet -> JSON + PLAYERS source. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OUTINGS = [
  "R1 - Balcarrick",
  "R2 - Ardee",
  "R3 - Hollywood Lakes",
  "R4 - Donabate",
  "R5 - Deer Park",
  "R6 - Royal Curragh",
  "R7 - Rathsallagh",
  "R8 - Newbridge",
  "R9 - Elmgreen",
  "R10 - Sillogue",
];

const TEXT = fs.readFileSync(path.join(__dirname, "data", "2023-spreadsheet.txt"), "utf8");

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

function roundHc(n) {
  return Math.round(n * 1000) / 1000;
}

function parseRow(line) {
  const cols = line.split("\t");
  const playerName = cols[0].trim();
  const start = Number(cols[4]);
  const roundCols = cols.slice(5);
  const rounds = [];
  for (let i = 0; i < 10; i++) {
    rounds.push([roundCols[i * 3], roundCols[i * 3 + 1], roundCols[i * 3 + 2]]);
  }
  return { playerName, start, rounds };
}

const players = {};
const adjustments = [];

for (const line of TEXT.trim().split("\n")) {
  const { playerName, start, rounds } = parseRow(line);
  players[playerName] = {
    start,
    rounds: rounds.map(([p, a]) => [parsePos(p), a === "" ? "" : a]),
  };
  let index = start;
  rounds.forEach(([pRaw, adjRaw, hcRaw], i) => {
    const amount = parseAdj(adjRaw);
    if (amount === 0) return;
    const indexBefore = index;
    const hcAfter =
      hcRaw != null && String(hcRaw).trim() !== "" ? Number(hcRaw) : roundHc(indexBefore + amount);
    adjustments.push({
      playerName,
      outingLabel: OUTINGS[i],
      position: parsePos(pRaw),
      amount,
      indexBefore,
      indexAfter: hcAfter,
    });
    index = hcAfter;
  });
}

const outJson = path.join(__dirname, "data", "2023-handicap-adjustments.json");
fs.writeFileSync(outJson, JSON.stringify({ seasonYear: 2023, adjustments }, null, 2));

const playersJs = JSON.stringify(players, null, 2)
  .replace(/"rounds": \[/g, "rounds: [")
  .replace(/"start":/g, "start:")
  .replace(/"([^"]+)": \{\n    start:/g, '"$1": {\n    start:');

console.log(`Players: ${Object.keys(players).length}, Adjustments: ${adjustments.length}`);
console.log(`Wrote ${outJson}`);
