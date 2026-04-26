#!/usr/bin/env node
/**
 * Reconcile high-level counts between legacy Google backend and Supabase.
 *
 * Env:
 * - LEGACY_API_URL
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

const LEGACY = process.env.LEGACY_API_URL?.replace(/\/$/, "");
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!LEGACY || !SUPABASE_URL || !KEY) {
  console.error("Missing required env: LEGACY_API_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sbHeaders = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Accept-Profile": "thegolfapp",
};

function legacyUrl(action, params = {}) {
  const u = new URL(LEGACY);
  u.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) u.searchParams.set(k, String(v));
  }
  return u.toString();
}

async function legacyGet(action, params = {}) {
  const res = await fetch(legacyUrl(action, params));
  const json = await res.json();
  if (!json?.success) throw new Error(`Legacy ${action} failed: ${json?.error || "unknown"}`);
  return json;
}

async function sbCount(table, filter = "") {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&${filter}`.replace(/&$/, "");
  const res = await fetch(url, { headers: { ...sbHeaders, Prefer: "count=exact", Range: "0-0" } });
  if (!res.ok) throw new Error(`Supabase count failed ${table}: ${res.status} ${await res.text()}`);
  const count = res.headers.get("content-range")?.split("/")?.[1];
  return parseInt(count || "0", 10) || 0;
}

const societies = (await legacyGet("getAllSocieties")).societies || [];
const legacyTotals = { societies: societies.length, players: 0, outings: 0, scores: 0 };

for (const s of societies) {
  const societyId = String(s.societyId || "").trim().toLowerCase();
  if (!societyId) continue;
  legacyTotals.players += ((await legacyGet("getPlayers", { societyId })).players || []).length;
  legacyTotals.outings += ((await legacyGet("getOutings", { societyId })).outings || []).length;
  legacyTotals.scores += ((await legacyGet("loadScores", { societyId, limit: 5000 })).scores || []).length;
}

const supabaseTotals = {
  societies: await sbCount("societies"),
  players: await sbCount("players"),
  outings: await sbCount("outings"),
  scores: await sbCount("scores"),
};

console.log(JSON.stringify({ legacyTotals, supabaseTotals }, null, 2));
