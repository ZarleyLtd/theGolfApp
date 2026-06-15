#!/usr/bin/env node
/**
 * Compare final handicap chain index_after vs expected Latest values.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOCIETY_ID = "botanic";
const TOL = 0.001;

const EXPECTED = [
  ["Adam Mahon", 19],
  ["Aidan Kelly", 29.5],
  ["Alan Neary", 17.5],
  ["Andy Ryan", 14],
  ["Bill Tonge", 26],
  ["Charlie Butler", 40],
  ["Colin Moore", 39.5],
  ["Dave Doyle", 25.5],
  ["David Kernan", 32],
  ["Declan Byrne", 29.5],
  ["Frank Lynott", 40],
  ["Gary Kelly", 29.5],
  ["Jim Brennan", 18],
  ["John Barry", 28],
  ["John Donnelly", 16.5],
  ["John Power", 25],
  ["Kevin Duggan", 29.5],
  ["Key Byrne", 33.5],
  ["Lorcan Kelly", 18],
  ["Mark Fowler", 27.5],
  ["Mark Mulholland", 22.5],
  ["Michael Connolly", 27],
  ["Mick Garrahan", 21.5],
  ["Mick Gilligan", 19],
  ["Niall Cullen", 40],
  ["Noel Brady", 22],
  ["Noel Smith", 28],
  ["Paudge Neary", 28],
  ["Paul Flynn", 31],
  ["Paul Murphy", 40],
  ["Peter Glynn", 20],
  ["Sean Duggan", 25],
  ["Sean Ward", 15.5],
  ["Shay Ryan", 24.5],
  ["Stephen Hanna", 21.5],
  ["Tony Corcoran", 39],
  ["Tony Neary", 39.5],
  ["Trevor Cudden", 27],
];

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
    return JSON.parse(out.slice(jsonStart)).rows || [];
  } finally {
    fs.unlinkSync(tmp);
  }
}

function roundFromLabel(label) {
  const m = String(label || "").match(/^R(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

function historySortKey(a) {
  const eff = a.effective_date ? String(a.effective_date).trim().slice(0, 10) : "";
  const sy = a.season_year != null ? Number(a.season_year) : null;
  if (eff && sy != null) {
    const ey = parseInt(eff.slice(0, 4), 10);
    if (!isNaN(ey) && ey > sy) return eff;
  }
  if (eff) return eff;
  if (sy != null) {
    const r = roundFromLabel(a.outing_label);
    const mm = String(Math.min(12, Math.max(1, Math.ceil(r / 2) + 1))).padStart(2, "0");
    const dd = String(Math.min(28, Math.max(1, r * 2))).padStart(2, "0");
    return `${sy}-${mm}-${dd}`;
  }
  return "0000-01-01";
}

const BULK_LABEL = "Bulk discount 2025";

function sortChainRows(a, b) {
  const aBulk = a.outing_label === BULK_LABEL;
  const bBulk = b.outing_label === BULK_LABEL;
  if (aBulk && !bBulk) return -1;
  if (!aBulk && bBulk) return 1;
  const ak = historySortKey(a);
  const bk = historySortKey(b);
  if (ak !== bk) return ak.localeCompare(bk);
  const ar = roundFromLabel(a.outing_label);
  const br = roundFromLabel(b.outing_label);
  if (ar && br) return ar - br;
  return String(a.outing_label || "").localeCompare(String(b.outing_label || ""));
}

function isPost2025Row(r) {
  if (r.season_year != null && Number(r.season_year) > 2025) return true;
  const eff = r.effective_date ? String(r.effective_date).trim().slice(0, 10) : "";
  if (eff && parseInt(eff.slice(0, 4), 10) > 2025) return true;
  return false;
}

/** Chain end = index_after after Bulk discount 2025 + all other 2025 adjustments, in order. */
function chainEndThrough2025(allRows) {
  const rows = allRows.filter((r) => !isPost2025Row(r));
  const rows2025 = rows.filter((r) => Number(r.season_year) === 2025).sort(sortChainRows);
  if (!rows2025.length) {
    const pre = rows
      .filter((r) => r.season_year != null && Number(r.season_year) < 2025)
      .sort(sortChainRows);
    return pre.length ? Number(pre[pre.length - 1].index_after) : null;
  }
  const last = rows2025[rows2025.length - 1];
  const bulk = rows2025.find((r) => r.outing_label === BULK_LABEL);
  return {
    chainEnd: Number(last.index_after),
    last,
    bulk,
    rows2025,
  };
}

function eq(a, b) {
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= TOL;
}

function fmt(n) {
  if (n == null) return "—";
  return String(Math.round(n * 1000) / 1000);
}

const players = dbQuery(`
  select player_id, player_name, handicap_index
  from thegolfapp.players
  where society_id='${SOCIETY_ID}'
`);
const playerByName = new Map(players.map((p) => [String(p.player_name).trim().toLowerCase(), p]));

const adjustments = dbQuery(`
  select player_id, season_year, source, outing_label, effective_date, index_after
  from thegolfapp.handicap_adjustments
  where society_id='${SOCIETY_ID}'
`);

const byPlayer = new Map();
for (const row of adjustments) {
  const list = byPlayer.get(row.player_id) || [];
  list.push(row);
  byPlayer.set(row.player_id, list);
}

const mismatches = [];
const matches = [];
const notFound = [];
const missingBulk = [];

for (const [inputName, expected] of EXPECTED) {
  const dbName = NAME_ALIASES[inputName] || inputName;
  const p = playerByName.get(dbName.toLowerCase());
  if (!p) {
    notFound.push({ inputName, dbName, expected });
    continue;
  }

  const rows = byPlayer.get(p.player_id) || [];
  if (!rows.length) {
    const compareVal = Number(p.handicap_index);
    const entry = {
      inputName,
      dbName,
      expected,
      chainEnd: compareVal,
      delta: Math.round((compareVal - expected) * 1000) / 1000,
      lastAdjustment: "no adjustments",
      hasBulk: false,
      playersIndex: compareVal,
    };
    if (eq(compareVal, expected)) matches.push(entry);
    else mismatches.push(entry);
    continue;
  }

  const result = chainEndThrough2025(rows);
  if (result == null || typeof result === "number") {
    const chainEnd = typeof result === "number" ? result : null;
    const compareVal = chainEnd ?? Number(p.handicap_index);
    const entry = {
      inputName,
      dbName,
      expected,
      chainEnd: compareVal,
      delta: Math.round((compareVal - expected) * 1000) / 1000,
      lastAdjustment: chainEnd != null ? "pre-2025 only (no Bulk discount 2025)" : "no adjustments",
      hasBulk: false,
      playersIndex: Number(p.handicap_index),
    };
    if (eq(compareVal, expected)) {
      matches.push(entry);
    } else {
      mismatches.push(entry);
    }
    continue;
  }

  const { chainEnd, last, bulk, rows2025 } = result;
  const hasOutings2025 = rows2025.some((r) => r.outing_label !== BULK_LABEL);
  if (!bulk && rows2025.length) {
    missingBulk.push({ inputName, dbName, rows2025: rows2025.length });
  }

  const entry = {
    inputName,
    dbName,
    expected,
    chainEnd,
    delta: Math.round((chainEnd - expected) * 1000) / 1000,
    lastAdjustment: `${last.season_year ?? "?"} ${last.outing_label} (${last.source})`,
    bulkEnd: bulk ? Number(bulk.index_after) : null,
    hasBulk: !!bulk,
    hasOutings2025,
    playersIndex: Number(p.handicap_index),
  };

  if (eq(chainEnd, expected)) {
    matches.push(entry);
  } else {
    mismatches.push(entry);
  }
}

console.log("=== Final chain index vs expected Latest (2025) ===\n");
console.log(
  "Chain = Bulk discount 2025 (if present) + all other 2025 adjustments in order; excludes post-2025 rows.\n",
);
console.log(`Checked: ${EXPECTED.length}`);
console.log(`Match: ${matches.length}`);
console.log(`Mismatch: ${mismatches.length}`);
console.log(`No adjustments at all: 0`);
console.log(`Missing Bulk discount 2025 row: ${missingBulk.length}`);
console.log(`Player not found: ${notFound.length}`);

if (mismatches.length) {
  console.log("\n--- MISMATCHES (chain end ≠ expected) ---");
  for (const m of mismatches) {
    console.log(
      `  ${m.inputName.padEnd(18)} expected ${fmt(m.expected).padStart(6)} | chain ${fmt(m.chainEnd).padStart(6)} | Δ ${m.delta >= 0 ? "+" : ""}${m.delta} | last: ${m.lastAdjustment}${m.hasBulk ? "" : " | NO bulk row"}`,
    );
  }
}

if (missingBulk.length) {
  console.log("\n--- MISSING BULK DISCOUNT 2025 (has other 2025 rows) ---");
  for (const m of missingBulk) {
    console.log(`  ${m.inputName}`);
  }
}

if (notFound.length) {
  console.log("\n--- PLAYER NOT IN DATABASE ---");
  for (const n of notFound) {
    console.log(`  ${n.inputName} (looked up as ${n.dbName})`);
  }
}

if (matches.length && mismatches.length === 0 && notFound.length === 0) {
  console.log("\nAll players match.");
}
