#!/usr/bin/env node
/** Extract parsed players object from prior transcript and emit adjustment rows. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const transcriptPath =
  "C:/Users/mrjoh/.cursor/projects/c-CursorSites-theGolfApp/agent-transcripts/cfab59d9-51f2-423e-9884-e5b00b0c197f/cfab59d9-51f2-423e-9884-e5b00b0c197f.jsonl";

const lines = fs.readFileSync(transcriptPath, "utf8").split("\n");
const toolLine = lines.find((l) => {
  if (!l.includes("rounds") || !l.includes("Sean Ward")) return false;
  try {
    const obj = JSON.parse(l);
    return obj.message?.content?.some(
      (c) =>
        c.type === "tool_use" &&
        String(c.input?.command || "").includes("const players = ") &&
        String(c.input?.command || "").includes("function esc"),
    );
  } catch {
    return false;
  }
});
if (!toolLine) {
  console.error("Could not find players block in transcript");
  process.exit(1);
}

const cmd = JSON.parse(toolLine).message.content.find((c) => c.type === "tool_use").input.command;
const start = cmd.indexOf("const players = ");
const end = cmd.indexOf("};\n\nfunction esc");
if (start < 0 || end < 0) {
  console.error("Could not locate players boundaries");
  process.exit(1);
}

const players = eval(`(${cmd.slice(start + "const players = ".length, end + 1)})`);

const outings = [
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

function parseAdj(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s === "0" || s === ".") return 0;
  const m = s.match(/^([+-]?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}

function parsePos(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s === ".") return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

const adjustments = [];
for (const [playerName, data] of Object.entries(players)) {
  let index = data.start;
  data.rounds.forEach((round, i) => {
    const [pRaw, adjRaw, hcAfter] = round;
    const amount = parseAdj(adjRaw);
    if (amount === 0) {
      index = typeof hcAfter === "number" ? hcAfter : index;
      return;
    }
    const indexBefore = index;
    const indexAfter = typeof hcAfter === "number" ? hcAfter : indexBefore + amount;
    adjustments.push({
      playerName,
      outingLabel: outings[i],
      position: parsePos(pRaw),
      amount,
      indexBefore,
      indexAfter,
    });
    index = indexAfter;
  });
}

const outPath = path.join(__dirname, "data", "2021-handicap-adjustments.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ seasonYear: 2021, adjustments }, null, 2));
console.log(`Wrote ${adjustments.length} adjustments for ${Object.keys(players).length} players -> ${outPath}`);
