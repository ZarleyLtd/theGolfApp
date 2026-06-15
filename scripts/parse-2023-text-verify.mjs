#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
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

const NAME_ALIASES = {
  "Mick Garrahan": "Michael Garrahan",
  "David Kernan": "Dave Kernan",
  "Gary Kelly": "Garry kelly",
  "Sean Duggan": "Seán Duggan",
};

const TEXT = `John Barry	John	Barry	28	25		0	25		0	25		0	25	.	1	26	.	1	27	.	1	28	3	0	28		0	28		0	28		0	28
Noel Brady	Noel	Brady	22	22	2	0	22	.	1	23	8	0	23		0	23	.	1	24		0	24	6	0	24	8	0	24		0	24	10	-2	22
Jim Brennan	Jim	Brennan	21	21		0	21		0	21		0	21		0	21		0	21	.	1	22		0	22		0	22		0	22		0	22
Charlie Butler	Charlie	Butler	41.5	41	9	-2.5	38.5	6	0	38.5	.	1	39.5	3	0	39.5	.	1	40.5	5	0	40.5		0	40.5	.	1	41.5		0	41.5	3	0	41.5
Declan Byrne	Declan	Byrne	28.5	27.5	.	1	28.5	.	1	29.5		0	29.5	9	-1.5	28	.	1	29	9	-1.5	27.5	.	1	28.5	9	-1	27.5	.	1	28.5		0	28.5
Key Byrne	Key	Byrne	37	21	.	7	28	.	5	33		0	33	.	1	34	.	1	35		0	35	.	1	36	.	1	37		0	37		0	37
Michael Connolly	Michael	Connolly	40	37	.	1	38	.	1	39		0	39	.	1	40		0	40	1	0	40		0	40	1	0	40		0	40	5	0	40
Tony Corcoran	Tony	Corcoran	42	39	.	1	40	.	1	41		0	41	7	-0.5	40.5	9	-2.5	38	.	1	39		0	39	.	1	40	.	1	41	.	1	42
Rory Cronin	Rory	Cronin	23	22		0	22		0	22		0	22		0	22		0	22	.	1	23		0	23		0	23		0	23		0	23
Niall Cullen	Niall	Cullen	40.5	42	.	1	43	1	0	43	4	0	43	6	0	43	10	-4.5	38.5	.	1	39.5		0	39.5		0	39.5	.	1	40.5		0	40.5
Kevin Daly		Daly	18	18		0	18		0	18		0	18		0	18		0	18		0	18		0	18		0	18		0	18		0	18
John Donnelly	John	Donnelly	15	15.5	1	0	15.5		0	15.5	10	-1	14.5	5	0	14.5	3	0	14.5	2	0	14.5	5	0	14.5	.	1	15.5	6	-0.5	15	6	0	15
Dave Doyle	Dave	Doyle	24	23	.	1	24	10	-2.5	21.5		0	21.5	.	1	22.5	8	-0.5	22	3	0	22	.	1	23	6	0	23	.	1	24		0	24
Gerry Duffy	Gerry	Duffy	31	31		0	31		0	31		0	31		0	31		0	31		0	31		0	31		0	31		0	31		0	31
Kevin Duggan	Kevin	Duggan	34.5	34	.	1	35	9	-2.5	32.5	.	1	33.5		0	33.5	5	0	33.5	8	0	33.5		0	33.5	.	1	34.5		0	34.5		0	34.5
Sean Duggan	Sean	Duggan	26	21		0	21		0	21		0	21	.	1	22	.	1	23	.	1	24	7	0	24	.	1	25	.	1	26		0	26
Paul Flynn	Paul	Flynn	28.5	31		0	31	.	1	32		0	32	.	1	33	1	0	33		0	33		0	33	5	0	33	10	-4.5	28.5	7	0	28.5
Mark Fowler	Mark	Fowler	28	25		0	25	.	1	26	6	0	26		0	26		0	26	.	1	27		0	27		0	27	.	1	28		0	28
Mick Garrahan	Mick	Garrahan	21	18.5	5	0	18.5	8	-0.5	18	3	0	18	.	1	19		0	19	7	0	19	1	0	19	.	1	20	.	1	21		0	21
Mick Gilligan		Gilligan	18.5	19.5	4	0	19.5	4	0	19.5		0	19.5	.	1	20.5		0	20.5	.	1	21.5	10	-2.5	19	4	0	19	7	-0.5	18.5	2	0	18.5
Stephen Hanna		Hanna	23	20		0	20	.	1	21		0	21	1	0	21		0	21	.	1	22		0	22		0	22	.	1	23		0	23
Aidan Kelly	Aidan	Kelly	27.5	27.5	10	-2.5	25	.	1	26	.	1	27	8	-0.5	26.5		0	26.5	.	1	27.5	9	-1.5	26	.	1	27	5	-0.5	26.5	.	1	27.5
Gary Kelly			33	18	.	0	18	.	1	19	.	7	26	.	1	27	.	1	28	.	1	29	.	1	30	.	1	31	.	1	32	.	1	33
David Kernan	David	Kernan	30.5	32	.	1	33	.	1	34		0	34	10	-4.5	29.5		0	29.5	.	1	30.5		0	30.5		0	30.5		0	30.5		0	30.5
Frank Lynott	Frank	Lynott	48.5	44	3	0	44	.	1	45	5	0	45		0	45	.	1	46	.	1	47	.	1	48	.	1	49	3	-0.5	48.5	1	0	48.5
Colin Moore	Colin	Moore	42	42		0	42		0	42		0	42		0	42		0	42		0	42		0	42		0	42		0	42		0	42
Mark Mulholland	Mark	Mulholland	25	22	.	1	23	5	0	23		0	23	.	1	24		0	24	.	1	25		0	25		0	25		0	25		0	25
Paul Murphy	Paul	Murphy	38.5	34	.	1	35	2	0	35	7	0	35	.	1	36	4	0	36	.	1	37	.	1	38	2	0	38	4	-0.5	37.5	.	1	38.5
Alan Neary	Alan	Neary	18.5	16	.	1	17	7	-0.5	16.5	1	0	16.5	4	0	16.5	7	0	16.5	4	0	16.5	8	0	16.5	.	1	17.5	2	0	17.5	.	1	18.5
Paudge Neary	Paudge	Neary	25	18	.	0	18	.	0	18		0	18	.	1	19	.	2	21	.	1	22		0	22	.	1	23	.	1	24	.	1	25
Tony Neary	Tony	Neary	44	43	.	1	44	.	1	45	.	1	46	.	1	47	6	0	47	10	-4.5	42.5	.	1	43.5	.	1	44.5	8	-0.5	44	4	0	44
John Power	John	Power	31	26		0	26		0	26		0	26		0	26		0	26	.	1	27	.	1	28	.	1	29	.	1	30	.	1	31
Andy Ryan	Andy	Ryan	13	13		0	13		0	13		0	13		0	13		0	13		0	13		0	13		0	13		0	13		0	13
Shay Ryan	Shay	Ryan	26	25.5	8	0	25.5	3	0	25.5	.	1	26.5		0	26.5		0	26.5		0	26.5	4	0	26.5	10	-2.5	24	.	1	25	.	1	26
Bill Tonge	Bill	Tonge	24.5	24	7	0	24		0	24	9	-1	23	.	1	24	2	0	24	.	1	25	.	1	26	3	0	26	9	-1.5	24.5	8	0	24.5
Sean Ward	Sean	Ward	18.5	17.5	6	0	17.5	.	1	18.5	2	0	18.5	2	0	18.5	.	1	19.5	6	0	19.5	2	0	19.5	7	0	19.5	1	0	19.5	9	-1	18.5`;

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
    const p = roundCols[i * 3];
    const adj = roundCols[i * 3 + 1];
    const hc = roundCols[i * 3 + 2];
    rounds.push([p, adj, hc]);
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
    const hcAfter = hcRaw != null && String(hcRaw).trim() !== "" ? Number(hcRaw) : roundHc(indexBefore + amount);
    expected.push({
      playerName,
      dbPlayerName: NAME_ALIASES[playerName] || playerName,
      outingLabel: OUTINGS[i],
      position: parsePos(pRaw),
      amount,
      indexBefore,
      indexAfter: hcAfter,
    });
    index = hcAfter;
  });
}

const loadedPath = path.join(__dirname, "data", "2023-handicap-adjustments.json");
const loaded = JSON.parse(fs.readFileSync(loadedPath, "utf8")).adjustments.map((a) => ({
  ...a,
  dbPlayerName: NAME_ALIASES[a.playerName] || a.playerName,
}));

function key(r) {
  return `${r.dbPlayerName.toLowerCase()}|${r.outingLabel.toLowerCase()}|${r.amount}`;
}

const expectedKeys = new Map(expected.map((r) => [key(r), r]));
const loadedKeys = new Map(loaded.map((r) => [key({ ...r, dbPlayerName: NAME_ALIASES[r.playerName] || r.playerName }), r]));

const missingFromDb = expected.filter((r) => !loadedKeys.has(key(r)));
const extraInDb = loaded.filter((r) => !expectedKeys.has(key({ ...r, dbPlayerName: NAME_ALIASES[r.playerName] || r.playerName })));

const valueMismatches = [];
for (const e of expected) {
  const k = key(e);
  const l = loaded.find(
    (r) =>
      (NAME_ALIASES[r.playerName] || r.playerName).toLowerCase() === e.dbPlayerName.toLowerCase() &&
      r.outingLabel.toLowerCase() === e.outingLabel.toLowerCase(),
  );
  if (l && Number(l.amount) !== e.amount) {
    valueMismatches.push({ player: e.dbPlayerName, outing: e.outingLabel, expected: e.amount, loaded: l.amount });
  } else if (l && (Number(l.indexBefore) !== e.indexBefore || Number(l.indexAfter) !== e.indexAfter)) {
    valueMismatches.push({
      player: e.dbPlayerName,
      outing: e.outingLabel,
      type: "index",
      expected: `${e.indexBefore}->${e.indexAfter}`,
      loaded: `${l.indexBefore}->${l.indexAfter}`,
    });
  }
}

console.log("Expected adjustments (from text):", expected.length);
console.log("Loaded in JSON:", loaded.length);
console.log("\n=== MISSING from load (in text, not in JSON) ===");
for (const r of missingFromDb) {
  console.log(`  ${r.dbPlayerName} | ${r.outingLabel} | ${r.amount >= 0 ? "+" : ""}${r.amount} | pos ${r.position ?? "-"} | ${r.indexBefore}->${r.indexAfter}`);
}
console.log("\n=== EXTRA in load (in JSON, not in text) ===");
for (const r of extraInDb) {
  const db = NAME_ALIASES[r.playerName] || r.playerName;
  console.log(`  ${db} | ${r.outingLabel} | ${r.amount >= 0 ? "+" : ""}${r.amount}`);
}
if (valueMismatches.length) {
  console.log("\n=== VALUE MISMATCHES (same outing, different amount/index) ===");
  for (const m of valueMismatches) console.log(" ", JSON.stringify(m));
}
