import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { decode as base64Decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

/** Private Storage bucket for golf-app scorecard photos (signed URLs only). */
const IMAGE_BUCKET = "golf-scorecards";
/** Legacy BGS botanic objects live here (`scores/{outingId}-{playerId}.jpg`). */
const LEGACY_IMAGE_BUCKET = "bgs-scorecards";
/** Seconds a signed image URL stays valid (6 hours — covers a full outing session). */
const IMAGE_SIGNED_URL_TTL = 21600;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function toDateString(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v || "").trim();
  return d.toISOString().slice(0, 10);
}

function toInt(v: unknown, fallback = 0): number {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Coerce DB/form/string values to boolean for players.visitor */
function toBoolVisitor(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  return false;
}

function parseTeamMemberIds(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v ?? "")
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

function toNum(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function roundHandicapValue(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return parseFloat(n.toFixed(3));
}

function addHandicapValues(a: number, b: number): number {
  return roundHandicapValue(roundHandicapValue(a) + roundHandicapValue(b));
}

function playingHandicapFromIndex(index: number): number {
  return Math.round(index);
}

function isBulkDiscountRow(row: {
  outingLabel?: string;
  outing_label?: string;
  reason?: string;
}): boolean {
  const label = String(row.outingLabel || row.outing_label || row.reason || "");
  return /bulk\s*discount/i.test(label);
}

function historySortKey(row: {
  effectiveDate?: string;
  effective_date?: string;
  seasonYear?: number | null;
  season_year?: number | null;
  outingLabel?: string;
  outing_label?: string;
  reason?: string;
}): string {
  const syRaw = row.seasonYear ?? row.season_year;
  const sy = syRaw != null ? Number(syRaw) : null;
  if (isBulkDiscountRow(row) && sy != null) {
    return `${sy}-01-01`;
  }
  const effRaw = row.effectiveDate || row.effective_date;
  const eff = effRaw ? String(effRaw).trim().slice(0, 10) : "";
  if (eff && sy != null) {
    const ey = parseInt(eff.slice(0, 4), 10);
    if (!isNaN(ey) && ey > sy) return eff;
  }
  if (eff) return eff;
  if (sy != null) {
    const label = String(row.outingLabel || row.outing_label || "");
    const r = label.match(/^R(\d+)/i);
    const round = r ? parseInt(r[1], 10) : 0;
    const mm = String(Math.min(12, Math.max(1, Math.ceil(round / 2) + 1))).padStart(2, "0");
    const dd = String(Math.min(28, Math.max(1, round * 2))).padStart(2, "0");
    return `${sy}-${mm}-${dd}`;
  }
  return "0000-01-01";
}

function historySortTiebreaker(
  a: { outingLabel?: string; outing_label?: string; reason?: string },
  b: { outingLabel?: string; outing_label?: string; reason?: string },
): number {
  const aBulk = isBulkDiscountRow(a);
  const bBulk = isBulkDiscountRow(b);
  if (aBulk !== bBulk) return aBulk ? -1 : 1;
  const aLabel = String(a.outingLabel || a.outing_label || "");
  const bLabel = String(b.outingLabel || b.outing_label || "");
  const ar = aLabel.match(/^R(\d+)/i);
  const br = bLabel.match(/^R(\d+)/i);
  if (ar && br) return parseInt(ar[1], 10) - parseInt(br[1], 10);
  if (ar) return 1;
  if (br) return -1;
  return aLabel.localeCompare(bLabel);
}

function historyCreatedAtKey(row: { createdAt?: string; created_at?: string }): string {
  const c = String(row.createdAt || row.created_at || "").trim();
  return c || "0000-00-00T00:00:00.000Z";
}

function sortHandicapHistoryChronological(rows: unknown[]): unknown[] {
  return rows.slice().sort((a: any, b: any) => {
    const ak = historySortKey(a);
    const bk = historySortKey(b);
    if (ak !== bk) return ak.localeCompare(bk);
    // Same effective date: earlier recorded adjustment first
    const ac = historyCreatedAtKey(a);
    const bc = historyCreatedAtKey(b);
    if (ac !== bc) return ac.localeCompare(bc);
    return historySortTiebreaker(a, b);
  });
}

function defaultHandicapRuleConfig() {
  const bands = (amounts: number[]) => [
    { minIndex: 30, maxIndex: null, amount: amounts[0] },
    { minIndex: 18, maxIndex: 30, amount: amounts[1] },
    { minIndex: null, maxIndex: 18, amount: amounts[2] },
  ];
  return {
    enabled: true,
    outsideTop10: 1,
    maxIndex: 40,
    positionGroups: {
      winner: bands([-4, -2, -1]),
      runnerUp: bands([-2, -1, -0.5]),
      thirdPlace: bands([0, 0, 0]),
    },
    highScoreRules: {
      rule4a: {
        enabled: true,
        minPoints: 40,
        minLeadOverSecond: 5,
        minCompetitors: 12,
        amount: -1,
      },
      rule4b: {
        enabled: true,
        minPoints: 40,
        amount: -0.5,
      },
    },
  };
}

function mapHandicapAdjustmentRow(row: any, playerNames: Record<string, string> = {}) {
  const playerId = String(row.player_id || "");
  const outingLabel = String(row.outing_label || "");
  return {
    adjustmentId: row.adjustment_id,
    playerId,
    playerName: playerNames[playerId] || row.players?.player_name || playerId,
    effectiveDate: row.effective_date ? toDateString(row.effective_date) : "",
    seasonYear: row.season_year ?? null,
    source: row.source || "",
    outingId: row.outing_id || "",
    outingLabel,
    courseName: row.outings?.course_name || outingLabel.replace(/^R\d+\s*[-–—]\s*/i, "").trim(),
    position: row.position ?? null,
    amount: row.amount != null ? String(row.amount) : "0",
    indexBefore: row.index_before != null ? String(row.index_before) : "0",
    indexAfter: row.index_after != null ? String(row.index_after) : "0",
    reason: row.reason || "",
    createdAt: row.created_at || "",
  };
}

async function resolvePlayerId(
  sb: ReturnType<typeof createClient>,
  societyId: string,
  args: Record<string, unknown>,
): Promise<string> {
  const playerId = String(args.playerId || "").trim();
  if (playerId) return playerId;
  const playerName = String(args.playerName || "").trim();
  if (!playerName) return "";
  const { data: rows, error } = await sb
    .from("players")
    .select("player_id, player_name")
    .eq("society_id", societyId)
    .ilike("player_name", playerName)
    .limit(2);
  if (error) throw new Error(error.message);
  if (!rows?.length) return "";
  if (rows.length > 1) {
    const exact = rows.find((r: any) =>
      String(r.player_name || "").trim().toLowerCase() === playerName.toLowerCase()
    );
    if (exact) return String(exact.player_id || "").trim();
    throw new Error(`Multiple players match "${playerName}"; use playerId`);
  }
  return String(rows[0].player_id || "").trim();
}

async function getHandicapRules(sb: ReturnType<typeof createClient>, societyId: string) {
  const { data, error } = await sb
    .from("handicap_rules")
    .select("*")
    .eq("society_id", societyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    return { success: true, enabled: false, config: defaultHandicapRuleConfig() };
  }
  const config = typeof data.config === "object" && data.config !== null
    ? { ...defaultHandicapRuleConfig(), ...(data.config as Record<string, unknown>) }
    : defaultHandicapRuleConfig();
  if (config.maxIndex == null || config.maxIndex === "") {
    config.maxIndex = 40;
  }
  return {
    success: true,
    enabled: !!data.enabled,
    config,
    updatedAt: data.updated_at || "",
  };
}

async function saveHandicapRules(sb: ReturnType<typeof createClient>, societyId: string, args: Record<string, unknown>) {
  const enabled = args.enabled === true || args.enabled === "true";
  const config = args.config && typeof args.config === "object" ? args.config : defaultHandicapRuleConfig();
  const now = new Date().toISOString();
  const { error } = await sb.from("handicap_rules").upsert({
    society_id: societyId,
    enabled,
    config,
    updated_at: now,
  }, { onConflict: "society_id" });
  if (error) throw new Error(error.message);
  return { success: true };
}

async function getHandicapHistory(
  sb: ReturnType<typeof createClient>,
  societyId: string,
  args: Record<string, unknown>,
) {
  const filterPlayerId = await resolvePlayerId(sb, societyId, args);
  const requestedPlayer = String(args.playerId || args.playerName || "").trim();
  if (requestedPlayer && !filterPlayerId) {
    return { success: true, adjustments: [], playerId: null };
  }
  let query = sb
    .from("handicap_adjustments")
    .select("*")
    .eq("society_id", societyId);
  if (filterPlayerId) query = query.eq("player_id", filterPlayerId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const playerNames: Record<string, string> = {};
  const { data: playerRows, error: pErr } = await sb
    .from("players")
    .select("player_id, player_name")
    .eq("society_id", societyId);
  if (pErr) throw new Error(pErr.message);
  (playerRows || []).forEach((p: any) => {
    playerNames[p.player_id] = p.player_name;
  });

  const rows = (data || []).map((row) => mapHandicapAdjustmentRow(row, playerNames));
  return { success: true, adjustments: sortHandicapHistoryChronological(rows), playerId: filterPlayerId || null };
}

async function updatePlayerHandicapIndex(
  sb: ReturnType<typeof createClient>,
  societyId: string,
  playerId: string,
  newIndex: number,
) {
  const playing = playingHandicapFromIndex(newIndex);
  const { error } = await sb.from("players").update({
    handicap_index: newIndex,
    handicap: playing,
    updated_at: new Date().toISOString(),
  }).eq("society_id", societyId).eq("player_id", playerId);
  if (error) throw new Error(error.message);
  return { handicapIndex: newIndex, handicap: playing };
}

async function saveHandicapAdjustment(
  sb: ReturnType<typeof createClient>,
  societyId: string,
  args: Record<string, unknown>,
) {
  const playerId = String(args.playerId || "").trim();
  const amount = toNum(args.amount, NaN);
  const reason = String(args.reason || "").trim();
  if (!playerId) throw new Error("playerId is required");
  if (!Number.isFinite(amount)) throw new Error("amount is required");
  if (!reason) throw new Error("reason is required");

  const { data: player, error: pErr } = await sb
    .from("players")
    .select("handicap_index")
    .eq("society_id", societyId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!player) throw new Error("Player not found");

  const indexBefore = toNum(player.handicap_index, 0);
  const indexAfter = addHandicapValues(indexBefore, amount);
  const effectiveDate = args.effectiveDate ? toDateString(args.effectiveDate) : toDateString(new Date());
  const seasonYear = args.seasonYear != null && String(args.seasonYear) !== ""
    ? toInt(args.seasonYear, 0)
    : null;
  const adjustmentId = generateId("ha");

  const { error: insErr } = await sb.from("handicap_adjustments").insert({
    society_id: societyId,
    adjustment_id: adjustmentId,
    player_id: playerId,
    effective_date: effectiveDate || null,
    season_year: seasonYear,
    source: "manual",
    outing_id: null,
    outing_label: "",
    position: null,
    amount,
    index_before: indexBefore,
    index_after: indexAfter,
    reason,
  });
  if (insErr) throw new Error(insErr.message);

  const updated = await updatePlayerHandicapIndex(sb, societyId, playerId, indexAfter);
  return { success: true, adjustmentId, ...updated };
}

async function mergeScores(
  sb: ReturnType<typeof createClient>,
  societyId: string,
  args: Record<string, unknown>,
) {
  const fromPlayer = String(args.fromPlayer ?? args.fromPlayerName ?? "").trim();
  const toPlayer = String(args.toPlayer ?? args.toPlayerName ?? "").trim();
  if (!fromPlayer || !toPlayer) {
    throw new Error("fromPlayer and toPlayer are required");
  }

  const { data, error } = await sb.rpc("merge_scores", {
    p_society_id: societyId,
    p_from_player_name: fromPlayer,
    p_to_player_name: toPlayer,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object") {
    throw new Error("merge_scores returned no result");
  }
  return data as Record<string, unknown>;
}

async function applyOutingAdjustments(
  sb: ReturnType<typeof createClient>,
  societyId: string,
  args: Record<string, unknown>,
) {
  const outingId = String(args.outingId || "").trim();
  if (!outingId) throw new Error("outingId is required");

  const { data: existing, error: exErr } = await sb
    .from("handicap_adjustments")
    .select("adjustment_id")
    .eq("society_id", societyId)
    .eq("outing_id", outingId)
    .eq("source", "automatic")
    .limit(1);
  if (exErr) throw new Error(exErr.message);
  if (existing?.length) {
    throw new Error("Automatic handicap adjustments already applied for this outing");
  }

  const { data: outing, error: oErr } = await sb
    .from("outings")
    .select("outing_date, course_name")
    .eq("society_id", societyId)
    .eq("outing_id", outingId)
    .maybeSingle();
  if (oErr) throw new Error(oErr.message);
  if (!outing) throw new Error("Outing not found");

  const effectiveDate = toDateString(args.effectiveDate || outing.outing_date);
  const items = Array.isArray(args.adjustments) ? args.adjustments : [];
  if (!items.length) throw new Error("adjustments array is required");

  const playerIds = items.map((it: any) => String(it.playerId || "").trim()).filter(Boolean);
  const { data: playerRows, error: pErr } = await sb
    .from("players")
    .select("player_id, handicap_index")
    .eq("society_id", societyId)
    .in("player_id", playerIds);
  if (pErr) throw new Error(pErr.message);
  const indexByPlayer: Record<string, number> = {};
  (playerRows || []).forEach((p: any) => {
    indexByPlayer[p.player_id] = toNum(p.handicap_index, 0);
  });

  const now = new Date().toISOString();
  const inserts: Record<string, unknown>[] = [];
  const updates: { playerId: string; indexAfter: number }[] = [];

  for (const raw of items) {
    const item = raw as Record<string, unknown>;
    const playerId = String(item.playerId || "").trim();
    const amount = toNum(item.amount, 0);
    if (!playerId) continue;
    const indexBefore = indexByPlayer[playerId] ?? 0;
    const indexAfter = addHandicapValues(indexBefore, amount);
    indexByPlayer[playerId] = indexAfter;
    const reason = String(item.reason || "").trim() ||
      `Automatic adjustment after ${outing.course_name || "outing"}`;
    inserts.push({
      society_id: societyId,
      adjustment_id: generateId("ha"),
      player_id: playerId,
      effective_date: effectiveDate || null,
      season_year: effectiveDate ? parseInt(String(effectiveDate).slice(0, 4), 10) : null,
      source: "automatic",
      outing_id: outingId,
      outing_label: String(outing.course_name || ""),
      position: item.position != null ? toInt(item.position, 0) : null,
      amount,
      index_before: indexBefore,
      index_after: indexAfter,
      reason,
      created_at: now,
    });
    updates.push({ playerId, indexAfter });
  }

  if (!inserts.length) throw new Error("No valid adjustments to apply");

  const { error: insErr } = await sb.from("handicap_adjustments").insert(inserts);
  if (insErr) throw new Error(insErr.message);

  for (const u of updates) {
    await updatePlayerHandicapIndex(sb, societyId, u.playerId, u.indexAfter);
  }

  return { success: true, applied: inserts.length };
}

async function getHandicapAppliedOutingIds(
  sb: ReturnType<typeof createClient>,
  societyId: string,
) {
  const { data, error } = await sb
    .from("handicap_adjustments")
    .select("outing_id")
    .eq("society_id", societyId)
    .eq("source", "automatic");
  if (error) throw new Error(error.message);
  const outingIds = [
    ...new Set(
      (data || [])
        .map((row: any) => String(row.outing_id || "").trim())
        .filter(Boolean),
    ),
  ];
  return { success: true, outingIds };
}

async function getOutingHandicapAdjustments(
  sb: ReturnType<typeof createClient>,
  societyId: string,
  args: Record<string, unknown>,
) {
  const outingId = String(args.outingId || "").trim();
  if (!outingId) throw new Error("outingId is required");

  const { data, error } = await sb
    .from("handicap_adjustments")
    .select("*")
    .eq("society_id", societyId)
    .eq("outing_id", outingId)
    .eq("source", "automatic");
  if (error) throw new Error(error.message);

  const playerNames: Record<string, string> = {};
  const { data: playerRows, error: pErr } = await sb
    .from("players")
    .select("player_id, player_name")
    .eq("society_id", societyId);
  if (pErr) throw new Error(pErr.message);
  (playerRows || []).forEach((p: any) => {
    playerNames[p.player_id] = p.player_name;
  });

  const adjustments = (data || [])
    .map((row: any) => ({
      playerId: String(row.player_id || ""),
      playerName: playerNames[row.player_id] || String(row.player_id || ""),
      position: row.position ?? null,
      amount: toNum(row.amount, 0),
      indexBefore: toNum(row.index_before, 0),
      indexAfter: toNum(row.index_after, 0),
      reason: row.reason || "",
    }))
    .sort((a: any, b: any) =>
      String(a.playerName || "").localeCompare(String(b.playerName || ""), undefined, { sensitivity: "base" })
    );

  return { success: true, applied: adjustments.length > 0, adjustments };
}

async function importHistoricalAdjustments(
  sb: ReturnType<typeof createClient>,
  societyId: string,
  args: Record<string, unknown>,
) {
  const seasonYear = toInt(args.seasonYear, 0);
  if (!seasonYear || seasonYear < 1900 || seasonYear > 2100) {
    throw new Error("seasonYear is required (e.g. 2020)");
  }

  const items = Array.isArray(args.adjustments) ? args.adjustments : [];
  if (!items.length) throw new Error("adjustments array is required");

  const [{ data: playerRows, error: pErr }, { data: outingRows, error: oErr }] = await Promise.all([
    sb.from("players").select("player_id, player_name").eq("society_id", societyId),
    sb.from("outings").select("outing_id, outing_date, course_name").eq("society_id", societyId),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (oErr) throw new Error(oErr.message);

  const playerByName: Record<string, string> = {};
  (playerRows || []).forEach((p: any) => {
    const key = String(p.player_name || "").trim().toLowerCase();
    if (key) playerByName[key] = p.player_id;
  });

  const outingByLabel: Record<string, { outingId: string; date: string }> = {};
  (outingRows || []).forEach((o: any) => {
    const course = String(o.course_name || "").trim();
    const date = toDateString(o.outing_date);
    const year = date ? toInt(date.slice(0, 4), 0) : 0;
    if (year === seasonYear && course) {
      outingByLabel[course.toLowerCase()] = { outingId: o.outing_id, date };
    }
  });

  const inserts: Record<string, unknown>[] = [];
  const now = new Date().toISOString();
  let skipped = 0;

  for (const raw of items) {
    const item = raw as Record<string, unknown>;
    let playerId = String(item.playerId || "").trim();
    if (!playerId) {
      const nameKey = String(item.playerName || "").trim().toLowerCase();
      playerId = playerByName[nameKey] || "";
    }
    if (!playerId) {
      skipped++;
      continue;
    }

    const outingLabel = String(item.outingLabel || "").trim();
    const courseFromLabel = outingLabel.replace(/^R\d+\s*[-–—]\s*/i, "").trim();
    const match = outingByLabel[courseFromLabel.toLowerCase()];
    const amount = toNum(item.amount, 0);
    const indexBefore = toNum(item.indexBefore, 0);
    const indexAfter = item.indexAfter != null ? roundHandicapValue(toNum(item.indexAfter, indexBefore + amount)) :
      addHandicapValues(indexBefore, amount);

    inserts.push({
      society_id: societyId,
      adjustment_id: generateId("ha"),
      player_id: playerId,
      effective_date: match?.date || null,
      season_year: seasonYear,
      source: "historical",
      outing_id: match?.outingId || null,
      outing_label: outingLabel,
      position: item.position != null && String(item.position) !== "" ? toInt(item.position, 0) : null,
      amount,
      index_before: indexBefore,
      index_after: indexAfter,
      reason: String(item.reason || "").trim() ||
        `Historical import ${seasonYear}${outingLabel ? ": " + outingLabel : ""}`,
      created_at: now,
    });
  }

  if (!inserts.length) throw new Error("No adjustments could be matched to players");

  const { error: insErr } = await sb.from("handicap_adjustments").insert(inserts);
  if (insErr) throw new Error(insErr.message);

  return { success: true, imported: inserts.length, skipped };
}

const SCORECARD_AI_MODEL = "gemini-2.5-flash";
const COURSE_LOOKUP_AI_MODEL = "gemini-2.5-flash";
const OUTING_REPORT_AI_MODEL = "gemini-2.5-flash";

/**
 * Free-tier limits per model. Google's models.list endpoint does not expose quota,
 * so these are maintained by hand and surfaced to the admin UI as indicative values.
 */
const FREE_TIER_MODELS: Record<string, { rpm: number; rpd: number; tpm?: number }> = {
  "gemini-2.5-flash": { rpm: 10, rpd: 250, tpm: 250000 },
  "gemini-2.5-flash-lite": { rpm: 15, rpd: 1000, tpm: 250000 },
  "gemini-2.5-pro": { rpm: 5, rpd: 100, tpm: 250000 },
  "gemini-2.0-flash": { rpm: 15, rpd: 200, tpm: 1000000 },
  "gemini-2.0-flash-lite": { rpm: 30, rpd: 200, tpm: 1000000 },
  "gemini-3-flash-preview": { rpm: 10, rpd: 250, tpm: 250000 },
  "gemini-3-pro-preview": { rpm: 5, rpd: 100, tpm: 250000 },
  "gemini-3.1-flash-lite-preview": { rpm: 15, rpd: 1000, tpm: 250000 },
  "gemma-3-27b-it": { rpm: 30, rpd: 14400, tpm: 15000 },
  "gemma-3-12b-it": { rpm: 30, rpd: 14400, tpm: 15000 },
  "gemma-3-4b-it": { rpm: 30, rpd: 14400, tpm: 15000 },
  "gemma-3-1b-it": { rpm: 30, rpd: 14400, tpm: 15000 },
  "gemma-3n-e4b-it": { rpm: 30, rpd: 14400, tpm: 15000 },
  "gemma-3n-e2b-it": { rpm: 30, rpd: 14400, tpm: 15000 },
};

/** Fallback chain used until an admin saves a priority order on admin/settings.html. */
const DEFAULT_AI_MODEL_PRIORITY = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
];

const APP_SETTINGS_KEYS = ["ai_models", "commentary_ai_prompt", "course_lookup_prompt"];

const DEFAULT_COURSE_LOOKUP_GUIDANCE =
  "SOURCE (in this order):\n" +
  "1. Official club website. Look up the course, find its official website, and get the full scorecard (par and stroke index for holes 1–18) from that site. Use this if available.\n" +
  "2. Only if the official website does not have the scorecard or you cannot find it, use Hole19 to get the 18 pars and 18 stroke indexes.\n\n";

const COURSE_LOOKUP_PROMPT_PART_C =
  "Reply with a single JSON object only (no markdown, no explanation). Valid JSON with these keys:\n" +
  '"pars" = array of 18 integers (par per hole), "indexes" = array of 18 integers (stroke index per hole), "website" = club URL or "", "clubName" = official name or "", "courseMapLoc" = Google Maps directions/search URL or "".\n' +
  'Example: {"pars":[4,4,3,4,5,4,3,4,5,4,4,3,4,5,4,3,4,5],"indexes":[5,13,17,9,1,11,15,7,3,10,16,6,2,14,18,8,4,12],"website":"https://example.com","clubName":"Club Name","courseMapLoc":"https://www.google.com/maps/search/Club+Name"}';

const DEFAULT_COMMENTARY_AI_PROMPT =
  "Write a commentary-style narrative that describes the drama of the competition. Focus mostly but not exclusively on the top three golfers, " +
  "but also mention any other players who make especially good scores on any holes " +
  "(e.g. actual birdies, high Stableford points on a hole, twos, net birdies) or who are strong early on even if they fade later on.\n\n" +
  "Accuracy is essential when making direct claims about actual scores achieved — for example birdies, pars, eagles, or numbers of points. " +
  "Only call a hole a birdie, par, eagle, bogey, or similar if the player's recorded strokes versus that hole's par support it; " +
  "do not infer a gross birdie or par from Stableford points alone. " +
  "It is OK to refer to a \"Net Birdie\" (one under par after applying handicap; 3 Stableford points), " +
  "a \"Net Eagle\" (two under par after applying handicap; 4 Stableford points), or a \"Net Albatross\" (three under par after applying handicap; 5 Stableford points).\n\n" +
  "Don't mention players' handicaps directly unless it is extra relevant to the story.";

type ApiContext = {
  sb: ReturnType<typeof createClient>;
  action: string;
  societyId: string;
  params: URLSearchParams;
  body: Record<string, unknown>;
  data: Record<string, unknown>;
};

function extractGeminiText(json: any): string {
  const parts = json?.candidates?.[0]?.content?.parts || [];
  return parts.map((p: any) => String(p?.text || "")).join("\n").trim();
}

function parseScoreCell(raw: string): number | null {
  const val = String(raw || "").trim();
  if (!val || val === "-" || val === "/") return null;
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n >= 0 && n <= 9 ? n : null;
}

function parseGeminiScorecardCsv(text: string) {
  const cleaned = String(text || "").replace(/```[\w]*\s*/g, "").trim();
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const result: { success: boolean; strokes: Array<number | null> } = { success: true, strokes: [] };
  const strokesByHole: Record<number, number | null> = {};
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes("hole") && lower.includes("score")) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex >= 0) {
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim());
      if (parts.length < 2) continue;
      const holeNum = parseInt(parts[0], 10);
      if (holeNum >= 1 && holeNum <= 18) strokesByHole[holeNum] = parseScoreCell(parts[1]);
    }
  }
  if (Object.keys(strokesByHole).length === 0) {
    const rowWith18 = lines.find((l) => l.split(",").length >= 18);
    if (!rowWith18) throw new Error("Could not find 18 stroke values in AI response");
    const parts = rowWith18.split(",");
    for (let i = 0; i < 18; i++) result.strokes.push(parseScoreCell(parts[i] ?? ""));
    return result;
  }
  for (let h = 1; h <= 18; h++) result.strokes.push(strokesByHole[h] !== undefined ? strokesByHole[h] : null);
  return result;
}

function extractFirstJsonObject(text: string): string {
  const cleaned = String(text || "").replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace < 0) return cleaned;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = firstBrace; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return cleaned.substring(firstBrace, i + 1);
    }
  }
  return cleaned;
}

function parseAiCourseJson(text: string): any {
  if (!text) return null;
  const normalized = String(text || "").replace(/[“”]/g, "\"").replace(/[‘’]/g, "'");
  try {
    return JSON.parse(normalized);
  } catch {
    const extracted = extractFirstJsonObject(normalized).replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(extracted);
    } catch {
      return null;
    }
  }
}

function normalizeCourseLookupResult(result: any, fallbackCourseName: string) {
  const parsRaw = Array.isArray(result?.pars) ? result.pars : [];
  const indexesRaw = Array.isArray(result?.indexes) ? result.indexes : [];
  const pars: number[] = [];
  const indexes: number[] = [];
  for (let i = 0; i < 18; i++) {
    pars.push(toInt(parsRaw[i], 0));
    indexes.push(toInt(indexesRaw[i], 0));
  }
  return {
    courseName: String(result?.courseName || fallbackCourseName || "").trim(),
    clubName: String(result?.clubName || "").trim(),
    website: String(result?.website || "").trim(),
    courseMapLoc: String(result?.courseMapLoc || result?.courseMaploc || "").trim(),
    pars,
    indexes,
  };
}

function buildCourseLookupPromptPartA(courseName: string): string {
  return (
    `Get 18-hole par and stroke index (Men's Championship tees) for: ${String(courseName || "").trim()}\n` +
    "Use the following guidance...\n"
  );
}

function buildCourseLookupPrompt(courseName: string, guidanceText: string): string {
  let guidance = String(guidanceText || "").trim() || DEFAULT_COURSE_LOOKUP_GUIDANCE;
  if (!guidance.endsWith("\n")) guidance += "\n";
  return buildCourseLookupPromptPartA(courseName) + guidance + COURSE_LOOKUP_PROMPT_PART_C;
}

function buildDefaultCourseLookupPrompt(courseName: string): string {
  return buildCourseLookupPrompt(courseName, DEFAULT_COURSE_LOOKUP_GUIDANCE);
}

async function callGemini(model: string, payload: Record<string, unknown>) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = `Gemini API error: ${res.status}`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {
      // noop
    }
    throw new Error(msg);
  }
  return JSON.parse(text);
}

async function analyzeScorecardImage(data: Record<string, unknown>) {
  const base64 = String(data.base64 || "").trim();
  const mimeType = String(data.mimeType || "image/jpeg");
  if (!base64) throw new Error("Missing image data");
  const context = (data.context as Record<string, unknown>) || {};
  let prompt =
    'Objective: Extract hole-by-hole gross scores for "Player A" from the provided golf scorecard image.\n\n' +
    "Return only CSV format with header Hole,Score and 18 rows.";
  if (context.currentCourseName != null || context.currentPlayerName != null || context.currentHandicap != null) {
    prompt += `\n\nContext: course=${String(context.currentCourseName || "")}, player=${String(context.currentPlayerName || "")}, handicap=${String(context.currentHandicap ?? "")}.`;
  }
  const payload = {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: base64 } },
        { text: prompt },
      ],
    }],
    generationConfig: { temperature: 0, topP: 1 },
  };
  const model = String(data.model || "").trim() || SCORECARD_AI_MODEL;
  const json = await callGemini(model, payload);
  const extractedText = extractGeminiText(json);
  if (!extractedText) throw new Error("No extraction result from Gemini");
  return { ...parseGeminiScorecardCsv(extractedText), model };
}

async function lookupCourseWithAi(sb: ReturnType<typeof createClient>, data: Record<string, unknown>) {
  const courseName = String(data.courseName || "").trim();
  if (!courseName) throw new Error("Course name is required");
  const explicitPrompt = String(data.prompt || "").trim();
  const prompt = explicitPrompt || await buildCourseLookupPromptFromSettings(sb, courseName);
  const model = String(data.model || "").trim() || COURSE_LOOKUP_AI_MODEL;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.2, topP: 0.95 },
  };
  const json = await callGemini(model, payload);
  const rawText = extractGeminiText(json);
  if (!rawText) throw new Error("No course data returned from Gemini");
  const parsed = parseAiCourseJson(rawText);
  if (!parsed || typeof parsed !== "object") throw new Error("AI response was not valid JSON");
  const normalized = normalizeCourseLookupResult(parsed, courseName);
  return { success: true, data: normalized, model };
}

async function getAppSettings(sb: ReturnType<typeof createClient>, data: Record<string, unknown>) {
  const key = String(data.key || "").trim() || "ai_models";
  if (!APP_SETTINGS_KEYS.includes(key)) throw new Error(`Unknown settings key: ${key}`);

  const { data: row, error } = await sb
    .from("app_settings")
    .select("setting_key, setting_value, updated_at")
    .eq("setting_key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);

  return {
    success: true,
    key,
    value: (row?.setting_value as Record<string, unknown>) || null,
    updatedAt: row?.updated_at || null,
    ...(key === "ai_models" ? { defaultPriority: DEFAULT_AI_MODEL_PRIORITY } : {}),
    ...(key === "commentary_ai_prompt" ? { defaultText: DEFAULT_COMMENTARY_AI_PROMPT } : {}),
    ...(key === "course_lookup_prompt" ? { defaultText: DEFAULT_COURSE_LOOKUP_GUIDANCE } : {}),
  };
}

async function saveAppSettings(sb: ReturnType<typeof createClient>, data: Record<string, unknown>) {
  const key = String(data.key || "").trim();
  if (!key) throw new Error("key is required");
  if (!APP_SETTINGS_KEYS.includes(key)) throw new Error(`Unknown settings key: ${key}`);

  let value = data.value;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      throw new Error("value must be a JSON object");
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("value must be a JSON object");
  }

  if (key === "ai_models") {
    const raw = (value as Record<string, unknown>).priority;
    if (!Array.isArray(raw)) throw new Error("priority must be an array of model ids");
    const priority: string[] = [];
    for (const entry of raw) {
      const id = String(entry || "").trim();
      if (!id) throw new Error("priority contains an empty model id");
      if (!priority.includes(id)) priority.push(id);
    }
    (value as Record<string, unknown>).priority = priority;
  }

  if (key === "commentary_ai_prompt") {
    const text = String((value as Record<string, unknown>).text || "").trim();
    if (!text) throw new Error("text is required");
    (value as Record<string, unknown>).text = text;
  }

  if (key === "course_lookup_prompt") {
    const text = String((value as Record<string, unknown>).text || "").trim();
    if (!text) throw new Error("text is required");
    (value as Record<string, unknown>).text = text;
  }

  const { error } = await sb
    .from("app_settings")
    .upsert(
      { setting_key: key, setting_value: value, updated_at: new Date().toISOString() },
      { onConflict: "setting_key" },
    );
  if (error) throw new Error(error.message);

  return { success: true, key, value };
}

/**
 * Resolved priority chain for server-side use: saved order if present, otherwise the default.
 * Client callers orchestrate their own fallback, but this keeps the server able to pick a model.
 */
async function resolveAiModelPriority(sb: ReturnType<typeof createClient>): Promise<string[]> {
  try {
    const { data: row } = await sb
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "ai_models")
      .maybeSingle();
    const saved = (row?.setting_value as Record<string, unknown> | undefined)?.priority;
    if (Array.isArray(saved) && saved.length) {
      const ids = saved.map((m) => String(m || "").trim()).filter(Boolean);
      if (ids.length) return ids;
    }
  } catch {
    // Settings table missing or unreadable — fall through to the default chain.
  }
  return DEFAULT_AI_MODEL_PRIORITY;
}

async function resolveCommentaryAiPrompt(sb: ReturnType<typeof createClient>): Promise<string> {
  try {
    const { data: row } = await sb
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "commentary_ai_prompt")
      .maybeSingle();
    const text = String((row?.setting_value as Record<string, unknown> | undefined)?.text || "").trim();
    if (text) return text;
  } catch {
    // Settings table missing or unreadable — fall through to the default prompt.
  }
  return DEFAULT_COMMENTARY_AI_PROMPT;
}

async function resolveCourseLookupGuidance(sb: ReturnType<typeof createClient>): Promise<string> {
  try {
    const { data: row } = await sb
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "course_lookup_prompt")
      .maybeSingle();
    const text = String((row?.setting_value as Record<string, unknown> | undefined)?.text || "").trim();
    if (text) return text;
  } catch {
    // Settings table missing or unreadable — fall through to the default guidance.
  }
  return DEFAULT_COURSE_LOOKUP_GUIDANCE;
}

async function buildCourseLookupPromptFromSettings(
  sb: ReturnType<typeof createClient>,
  courseName: string,
): Promise<string> {
  const guidance = await resolveCourseLookupGuidance(sb);
  return buildCourseLookupPrompt(courseName, guidance);
}

/**
 * Model ids that advertise generateContent but cannot serve our text/vision prompts
 * (image, audio, music, robotics and computer-use models).
 */
const AI_MODEL_ID_EXCLUDE = [
  "embedding",
  "aqa",
  "imagen",
  "veo",
  "-tts",
  "-image",
  "image-generation",
  "-live-",
  "learnlm",
  "lyria",
  "nano-banana",
  "transcribe",
  "robotics",
  "computer-use",
];

type AiModelCacheEntry = { at: number; models: unknown[] };
let aiModelCache: AiModelCacheEntry | null = null;
const AI_MODEL_CACHE_TTL_MS = 10 * 60 * 1000;

async function listAiModels(data: Record<string, unknown>) {
  const refresh = String(data.refresh || "") === "true" || data.refresh === true;
  if (!refresh && aiModelCache && Date.now() - aiModelCache.at < AI_MODEL_CACHE_TTL_MS) {
    return { success: true, models: aiModelCache.models, cached: true };
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const collected: any[] = [];
  let pageToken = "";
  for (let page = 0; page < 10; page++) {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), { method: "GET" });
    const text = await res.text();
    if (!res.ok) {
      let msg = `Gemini API error: ${res.status}`;
      try {
        const parsed = JSON.parse(text);
        if (parsed?.error?.message) msg = parsed.error.message;
      } catch {
        // noop
      }
      throw new Error(msg);
    }
    const json = JSON.parse(text);
    for (const m of json?.models || []) collected.push(m);
    pageToken = String(json?.nextPageToken || "");
    if (!pageToken) break;
  }

  const models = collected
    .filter((m) => {
      const methods = (m?.supportedGenerationMethods || []) as string[];
      if (!methods.includes("generateContent")) return false;
      const id = String(m?.name || "").replace(/^models\//, "").toLowerCase();
      if (!id) return false;
      return !AI_MODEL_ID_EXCLUDE.some((frag) => id.includes(frag));
    })
    .map((m) => {
      const id = String(m.name || "").replace(/^models\//, "");
      const limits = FREE_TIER_MODELS[id] || null;
      return {
        id,
        displayName: String(m.displayName || id),
        description: String(m.description || ""),
        version: String(m.version || ""),
        inputTokenLimit: toInt(m.inputTokenLimit, 0),
        outputTokenLimit: toInt(m.outputTokenLimit, 0),
        freeTier: !!limits,
        freeTierLimits: limits,
      };
    })
    .sort((a, b) => {
      if (a.freeTier !== b.freeTier) return a.freeTier ? -1 : 1;
      return a.id.localeCompare(b.id);
    });

  aiModelCache = { at: Date.now(), models };
  return { success: true, models, cached: false };
}

function parseParIndx(parIndx: string): { pars: number[]; indexes: number[] } {
  const nums = String(parIndx || "")
    .split(",")
    .map((s) => parseInt(String(s).trim(), 10))
    .filter((n) => Number.isFinite(n));
  return {
    pars: nums.slice(0, 18),
    indexes: nums.slice(18, 36),
  };
}

function formatOutingReportHoleScore(raw: unknown): string {
  if (raw === "" || raw == null) return "scratch";
  const n = Number(raw);
  if (Number.isFinite(n) && n === 0) return "scratch";
  return String(raw);
}

function buildOutingReportPrompt(args: {
  societyName: string;
  courseName: string;
  date: string;
  commentaryInstructions: string;
  styleHint: string;
  contentHint: string;
  pars: number[];
  indexes: number[];
  scores: Array<{
    playerName: string;
    handicap: number;
    totalPoints: number;
    totalScore: number;
    outPoints: number;
    inPoints: number;
    back6Points: number;
    back3Points: number;
    holes: unknown[];
    holePoints: unknown[];
  }>;
}): string {
  const styleHint = args.styleHint.trim() || "none";
  const contentHint = args.contentHint.trim() || "none";
  const parsLine = args.pars.length ? args.pars.join(",") : "(unknown)";
  const idxLine = args.indexes.length ? args.indexes.join(",") : "(unknown)";

  const ranked = [...args.scores].sort(
    (a, b) => (Number(b.totalPoints) || 0) - (Number(a.totalPoints) || 0),
  );

  const scoreBlocks = ranked.map((s) => {
    const holes = Array.isArray(s.holes)
      ? s.holes.map((h) => formatOutingReportHoleScore(h)).join(",")
      : "";
    const pts = Array.isArray(s.holePoints) ? s.holePoints.join(",") : "";
    return (
      `Player: ${s.playerName} | Handicap: ${s.handicap} | Total points: ${s.totalPoints} | Total strokes: ${s.totalScore}\n` +
      `Out points: ${s.outPoints} | In points: ${s.inPoints} | Back 6 points: ${s.back6Points} | Back 3 points: ${s.back3Points}\n` +
      `Holes: ${holes}\n` +
      `Points: ${pts}`
    );
  }).join("\n\n");

  return (
    "You are a sports commentator writing about a golf society Stableford competition.\n\n" +
    `Society: ${args.societyName}\n` +
    `Outing: ${args.courseName} on ${args.date}\n\n` +
    `${args.commentaryInstructions.trim()}\n\n` +
    `Style hints (optional — follow if provided): ${styleHint}\n` +
    `Content hints (optional — follow if provided): ${contentHint}\n\n` +
    `Course pars (holes 1–18): ${parsLine}\n` +
    `Stroke indexes (holes 1–18): ${idxLine}\n\n` +
    "Scorecards (one per player; scratch means no score recorded on that hole — do not treat as zero strokes or NR):\n\n" +
    scoreBlocks +
    "\n\nReturn plain text commentary only. Do not wrap the response in markdown code fences."
  );
}

async function generateOutingReport(
  sb: ReturnType<typeof createClient>,
  societyId: string,
  data: Record<string, unknown>,
) {
  const outingId = String(data.outingId || "").trim();
  if (!outingId) return { success: false, error: "outingId is required" };
  if (!societyId) return { success: false, error: "societyId is required" };

  const styleHint = String(data.styleHint || "").trim();
  const contentHint = String(data.contentHint || "").trim();

  const [{ data: outingRow, error: outingErr }, { data: societyRow, error: societyErr }] =
    await Promise.all([
      sb.from("outings").select("*").eq("society_id", societyId).eq("outing_id", outingId).maybeSingle(),
      sb.from("societies").select("society_name").eq("society_id", societyId).maybeSingle(),
    ]);
  if (outingErr) throw new Error(outingErr.message);
  if (societyErr) throw new Error(societyErr.message);
  if (!outingRow) return { success: false, error: "Outing not found" };

  const societyName = String(societyRow?.society_name || "").trim() || societyId;
  const courseName = String(outingRow.course_name || "").trim();
  const date = outingRow.outing_date ? toDateString(outingRow.outing_date) : "";

  const scoresRes = await loadScores(sb, societyId, { outingId, limit: 5000 });
  const scores = (scoresRes as any).scores || [];
  if (!scores.length) {
    return { success: false, error: "No scores recorded for this outing." };
  }

  let pars: number[] = [];
  let indexes: number[] = [];
  if (courseName) {
    const { data: courseRow, error: courseErr } = await sb
      .from("courses")
      .select("par_indx, course_name")
      .ilike("course_name", courseName)
      .limit(5);
    if (courseErr) throw new Error(courseErr.message);
    const exact = (courseRow || []).find(
      (c: any) => String(c.course_name || "").trim().toLowerCase() === courseName.toLowerCase(),
    ) || (courseRow || [])[0];
    if (exact) {
      const parsed = parseParIndx(String(exact.par_indx || ""));
      pars = parsed.pars;
      indexes = parsed.indexes;
    }
  }

  const prompt = buildOutingReportPrompt({
    societyName,
    courseName,
    date,
    commentaryInstructions: await resolveCommentaryAiPrompt(sb),
    styleHint,
    contentHint,
    pars,
    indexes,
    scores,
  });

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8, topP: 0.95 },
  };
  let model = String(data.model || "").trim();
  if (!model) {
    const chain = await resolveAiModelPriority(sb);
    model = chain[0] || OUTING_REPORT_AI_MODEL;
  }
  const json = await callGemini(model, payload);
  const report = extractGeminiText(json);
  if (!report) throw new Error("No commentary returned from Gemini");

  return { success: true, report, model };
}

async function getAllSocieties(sb: ReturnType<typeof createClient>) {
  const { data, error } = await sb
    .from("societies")
    .select("*")
    .order("society_name");
  if (error) throw new Error(error.message);
  return {
    success: true,
    societies: (data || []).map((row) => ({
      societyId: row.society_id,
      societyName: row.society_name,
      contactPerson: row.contact_person,
      numberOfPlayers: row.number_of_players,
      numberOfOutings: row.number_of_outings,
      status: row.status,
      createdDate: row.created_date ? toDateString(row.created_date) : "",
      captainsNotes: row.captains_notes || "",
    })),
  };
}

async function getSociety(sb: ReturnType<typeof createClient>, societyId: string) {
  const { data, error } = await sb
    .from("societies")
    .select("*")
    .eq("society_id", societyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { success: false, error: "Society not found" };
  return {
    success: true,
    society: {
      societyId: data.society_id,
      societyName: data.society_name,
      contactPerson: data.contact_person,
      numberOfPlayers: data.number_of_players,
      numberOfOutings: data.number_of_outings,
      status: data.status,
      createdDate: data.created_date ? toDateString(data.created_date) : "",
      captainsNotes: data.captains_notes || "",
    },
  };
}

async function getPlayers(sb: ReturnType<typeof createClient>, societyId: string) {
  const { data, error } = await sb
    .from("players")
    .select("*")
    .eq("society_id", societyId)
    .order("player_name");
  if (error) throw new Error(error.message);
  return {
    success: true,
    players: (data || []).map((row) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      handicap: row.handicap ?? 0,
      handicapIndex: toNum(row.handicap_index, row.handicap ?? 0),
      visitor: toBoolVisitor(row.visitor),
    })),
  };
}

async function getCourses(sb: ReturnType<typeof createClient>) {
  const { data, error } = await sb.from("courses").select("*").order("course_name");
  if (error) throw new Error(error.message);
  return {
    success: true,
    courses: (data || []).map((row) => ({
      courseName: row.course_name,
      parIndx: row.par_indx || "",
      courseURL: row.course_url || "",
      courseMaploc: row.course_maploc || "",
      clubName: row.club_name || "",
      courseImage: row.course_image || "",
    })),
  };
}

async function getOutings(sb: ReturnType<typeof createClient>, societyId: string) {
  const { data, error } = await sb
    .from("outings")
    .select("*")
    .eq("society_id", societyId)
    .order("outing_date")
    .order("outing_time");
  if (error) throw new Error(error.message);
  return {
    success: true,
    outings: (data || []).map((row) => ({
      outingId: row.outing_id,
      date: toDateString(row.outing_date),
      time: row.outing_time || "",
      courseName: row.course_name || "",
      comps: row.comps || "",
      blurLeaderboard: !!row.blur_leaderboard,
    })),
  };
}

async function getSocietyAdminData(sb: ReturnType<typeof createClient>, societyId: string) {
  const [society, players, outings] = await Promise.all([
    getSociety(sb, societyId),
    getPlayers(sb, societyId),
    getOutings(sb, societyId),
  ]);
  if (!society.success) return society;
  return {
    success: true,
    society: (society as any).society,
    players: (players as any).players || [],
    outings: (outings as any).outings || [],
  };
}

async function getScorecardData(sb: ReturnType<typeof createClient>, societyId: string) {
  const [outingsRes, coursesRes, playersRes] = await Promise.all([
    getOutings(sb, societyId),
    getCourses(sb),
    getPlayers(sb, societyId),
  ]);
  const outings = (outingsRes as any).outings || [];
  const courses = (coursesRes as any).courses || [];
  const players = (playersRes as any).players || [];
  const outingCourseNorm = new Set(
    outings.map((o: any) => String(o.courseName || "").toLowerCase().replace(/\s+/g, "")),
  );
  return {
    success: true,
    outings,
    courses: courses.filter((c: any) =>
      outingCourseNorm.has(String(c.courseName || "").toLowerCase().replace(/\s+/g, ""))),
    players,
  };
}

function mapScoreRow(row: any) {
  return {
    outingId: row.outing_id,
    playerId: row.player_id,
    playerName: row.players?.player_name || row.player_id,
    course: row.outings?.course_name || "",
    date: row.outings?.outing_date ? toDateString(row.outings.outing_date) : "",
    handicap: row.handicap ?? 0,
    holes: Array.isArray(row.holes) ? row.holes : [],
    holePoints: Array.isArray(row.hole_points) ? row.hole_points : [],
    totalScore: row.total_score ?? 0,
    totalPoints: row.total_points ?? 0,
    outScore: row.out_score ?? 0,
    outPoints: row.out_points ?? 0,
    inScore: row.in_score ?? 0,
    inPoints: row.in_points ?? 0,
    back6Score: row.back6_score ?? 0,
    back6Points: row.back6_points ?? 0,
    back3Score: row.back3_score ?? 0,
    back3Points: row.back3_points ?? 0,
    timestamp: row.score_timestamp || row.updated_at || row.created_at || "",
    imagePath: row.image_path || null,
    imageMime: row.image_mime || null,
  };
}

/** Legacy BGS paths (`scores/...`) stay in bgs-scorecards; new uploads use golf-scorecards. */
function imageBucketForPath(imagePath: string): string {
  return imagePath.startsWith("scores/") ? LEGACY_IMAGE_BUCKET : IMAGE_BUCKET;
}

async function signPathsInBucket(
  sb: ReturnType<typeof createClient>,
  bucket: string,
  paths: string[],
): Promise<Record<string, string>> {
  const byPath: Record<string, string> = {};
  if (!paths.length) return byPath;
  const { data, error } = await sb.storage.from(bucket).createSignedUrls(paths, IMAGE_SIGNED_URL_TTL);
  if (error) {
    console.warn("Failed to batch-sign scorecard image URLs:", error.message);
    return byPath;
  }
  for (const item of data || []) {
    if (item.path && item.signedUrl) byPath[item.path] = item.signedUrl;
  }
  return byPath;
}

/** Batch-sign `imageUrl` for many mapped score rows. */
async function attachSignedImageUrls(
  sb: ReturnType<typeof createClient>,
  scores: Record<string, unknown>[],
): Promise<void> {
  const paths = [
    ...new Set(scores.map((s) => s.imagePath as string | null).filter((p): p is string => !!p)),
  ];
  const legacyPaths = paths.filter((p) => imageBucketForPath(p) === LEGACY_IMAGE_BUCKET);
  const newPaths = paths.filter((p) => imageBucketForPath(p) === IMAGE_BUCKET);
  const byPath = {
    ...(await signPathsInBucket(sb, LEGACY_IMAGE_BUCKET, legacyPaths)),
    ...(await signPathsInBucket(sb, IMAGE_BUCKET, newPaths)),
  };
  for (const s of scores) {
    s.imageUrl = (s.imagePath && byPath[s.imagePath as string]) || null;
  }
}

async function getSignedImageUrl(
  sb: ReturnType<typeof createClient>,
  imagePath: string | null | undefined,
): Promise<string | null> {
  if (!imagePath) return null;
  const { data, error } = await sb.storage
    .from(imageBucketForPath(imagePath))
    .createSignedUrl(imagePath, IMAGE_SIGNED_URL_TTL);
  if (error) {
    console.warn("Failed to sign scorecard image URL:", error.message);
    return null;
  }
  return data?.signedUrl || null;
}

function decodeImagePayload(base64: unknown, mimeType: unknown): { bytes: Uint8Array; mime: string } | null {
  const raw = String(base64 || "").replace(/^data:[^,]+,/, "").replace(/\s/g, "");
  if (!raw) return null;
  return { bytes: base64Decode(raw), mime: String(mimeType || "image/jpeg") };
}

/** Upload (or replace) the scorecard photo. Reuses `existingPath` when set so merge/replace does not orphan. */
async function uploadScorecardImageBytes(
  sb: ReturnType<typeof createClient>,
  societyId: string,
  outingId: string,
  playerId: string,
  bytes: Uint8Array,
  mime: string,
  existingPath?: string | null,
): Promise<string> {
  const path = (existingPath && String(existingPath).trim()) || `${societyId}/${outingId}-${playerId}.jpg`;
  const { error } = await sb.storage.from(imageBucketForPath(path)).upload(path, bytes, {
    contentType: mime,
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return path;
}

async function deleteScorecardImage(
  sb: ReturnType<typeof createClient>,
  imagePath: string | null | undefined,
): Promise<void> {
  if (!imagePath) return;
  const { error } = await sb.storage.from(imageBucketForPath(imagePath)).remove([imagePath]);
  if (error) console.warn("Failed to delete scorecard image:", error.message);
}

async function uploadScoreImage(
  sb: ReturnType<typeof createClient>,
  societyId: string,
  data: Record<string, unknown>,
) {
  const outingId = String(data.outingId || "").trim();
  const playerId = String(data.playerId || "").trim();
  if (!outingId || !playerId) throw new Error("outingId and playerId are required");

  const imagePayload = decodeImagePayload(data.base64, data.mimeType);
  if (!imagePayload) throw new Error("No image supplied");

  const { data: existing, error: exErr } = await sb
    .from("scores")
    .select("outing_id, image_path")
    .eq("society_id", societyId)
    .eq("outing_id", outingId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);
  if (!existing) {
    throw new Error("Enter and submit at least one hole score before attaching a photo");
  }

  const imagePath = await uploadScorecardImageBytes(
    sb,
    societyId,
    outingId,
    playerId,
    imagePayload.bytes,
    imagePayload.mime,
    existing.image_path as string | null,
  );
  const { error } = await sb
    .from("scores")
    .update({ image_path: imagePath, image_mime: imagePayload.mime, updated_at: new Date().toISOString() })
    .eq("society_id", societyId)
    .eq("outing_id", outingId)
    .eq("player_id", playerId);
  if (error) throw new Error(error.message);

  const imageUrl = await getSignedImageUrl(sb, imagePath);
  return { success: true, imagePath, imageUrl };
}

async function removeScoreImage(
  sb: ReturnType<typeof createClient>,
  societyId: string,
  data: Record<string, unknown>,
) {
  const outingId = String(data.outingId || "").trim();
  const playerId = String(data.playerId || "").trim();
  if (!outingId || !playerId) throw new Error("outingId and playerId are required");

  const { data: existing, error: exErr } = await sb
    .from("scores")
    .select("image_path")
    .eq("society_id", societyId)
    .eq("outing_id", outingId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);
  if (!existing) return { success: true, message: "No score found for this player/outing" };

  await deleteScorecardImage(sb, existing.image_path as string | null);

  const { error } = await sb
    .from("scores")
    .update({ image_path: null, image_mime: null, updated_at: new Date().toISOString() })
    .eq("society_id", societyId)
    .eq("outing_id", outingId)
    .eq("player_id", playerId);
  if (error) throw new Error(error.message);
  return { success: true, message: "Photo removed" };
}

async function loadScores(sb: ReturnType<typeof createClient>, societyId: string, args: Record<string, unknown>) {
  const limit = Math.max(1, Math.min(5000, toInt(args.limit, 50)));
  let query = sb
    .from("scores")
    .select("*, outings!scores_outing_fk(course_name, outing_date, outing_time), players!scores_player_fk(player_name)")
    .eq("society_id", societyId)
    .order("score_timestamp", { ascending: false })
    .limit(limit);

  const outingId = String(args.outingId || "").trim();
  const playerId = String(args.playerId || "").trim();
  if (outingId) query = query.eq("outing_id", outingId);
  if (playerId) query = query.eq("player_id", playerId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const scores = (data || []).map(mapScoreRow);
  await attachSignedImageUrls(sb, scores);
  return { success: true, scores };
}

async function checkExistingScore(
  sb: ReturnType<typeof createClient>,
  societyId: string,
  args: Record<string, unknown>,
) {
  const outingId = String(args.outingId || "").trim();
  const playerId = String(args.playerId || "").trim();
  if (!outingId || !playerId) return { success: true, exists: false };
  const { data, error } = await sb
    .from("scores")
    .select("*, outings!scores_outing_fk(course_name, outing_date, outing_time), players!scores_player_fk(player_name)")
    .eq("society_id", societyId)
    .eq("outing_id", outingId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { success: true, exists: false };
  const scores = [mapScoreRow(data)];
  await attachSignedImageUrls(sb, scores);
  return { success: true, exists: true, score: scores[0] };
}

async function getOutingTeams(sb: ReturnType<typeof createClient>, societyId: string, args: Record<string, unknown>) {
  const outingId = String(args.outingId || "").trim();
  let query = sb
    .from("teams")
    .select("team_id, team_name, outing_id, team_members(player_id)")
    .eq("society_id", societyId)
    .order("team_name");
  if (outingId) query = query.eq("outing_id", outingId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const { data: players, error: pErr } = await sb
    .from("players")
    .select("player_id, player_name")
    .eq("society_id", societyId);
  if (pErr) throw new Error(pErr.message);
  const playerMap: Record<string, string> = {};
  (players || []).forEach((p) => (playerMap[p.player_id] = p.player_name));

  const mapped = (data || []).map((row: any) => {
    const playerIds = (row.team_members || []).map((m: any) => m.player_id);
    return {
      teamId: row.team_id,
      teamName: row.team_name,
      outingId: row.outing_id,
      playerIds,
      playerNames: playerIds.map((id: string) => playerMap[id] || id),
    };
  });

  if (outingId) return { success: true, teams: mapped };
  const teamsByOuting: Record<string, any[]> = {};
  mapped.forEach((team: any) => {
    if (!teamsByOuting[team.outingId]) teamsByOuting[team.outingId] = [];
    teamsByOuting[team.outingId].push({
      teamId: team.teamId,
      teamName: team.teamName,
      playerIds: team.playerIds,
      playerNames: team.playerNames,
    });
  });
  return { success: true, teamsByOuting };
}

async function saveOutingTeam(sb: ReturnType<typeof createClient>, societyId: string, args: Record<string, unknown>) {
  const outingId = String(args.outingId || "").trim();
  if (!outingId) throw new Error("outingId is required");
  const deleting = !!args.delete;
  const teamObj = (args.team as Record<string, unknown>) || {};
  // Prefer top-level teamId (delete path); upsert sends teamId inside data.team (Apps Script contract).
  const teamId = String(args.teamId || teamObj.teamId || "").trim();

  if (deleting) {
    if (!teamId) throw new Error("teamId is required for delete");
    const { error } = await sb
      .from("teams")
      .delete()
      .eq("society_id", societyId)
      .eq("outing_id", outingId)
      .eq("team_id", teamId);
    if (error) throw new Error(error.message);
    return { success: true, teamId };
  }

  const finalTeamId = teamId || generateId("t");
  const teamName = String(teamObj.teamName || "").trim();
  if (!teamName) throw new Error("teamName is required");
  const playerIds = parseTeamMemberIds(teamObj.playerIds || teamObj.playerNames || []);

  const { error: upsertErr } = await sb.from("teams").upsert(
    { society_id: societyId, outing_id: outingId, team_id: finalTeamId, team_name: teamName, updated_at: new Date().toISOString() },
    { onConflict: "society_id,outing_id,team_id" },
  );
  if (upsertErr) throw new Error(upsertErr.message);

  const { error: delMembersErr } = await sb
    .from("team_members")
    .delete()
    .eq("society_id", societyId)
    .eq("outing_id", outingId)
    .eq("team_id", finalTeamId);
  if (delMembersErr) throw new Error(delMembersErr.message);

  if (playerIds.length > 0) {
    const rows = playerIds.map((playerId) => ({
      society_id: societyId,
      outing_id: outingId,
      team_id: finalTeamId,
      player_id: playerId,
    }));
    const { error: insErr } = await sb.from("team_members").insert(rows);
    if (insErr) throw new Error(insErr.message);
  }
  return { success: true, teamId: finalTeamId };
}

async function dispatchGet(ctx: ApiContext) {
  const { sb, action, societyId, params } = ctx;
  if (action === "getAllSocieties") return await getAllSocieties(sb);
  if (action === "getSociety") return await getSociety(sb, societyId);
  if (action === "getPlayers") return await getPlayers(sb, societyId);
  if (action === "getCourses") return await getCourses(sb);
  if (action === "getOutings") return await getOutings(sb, societyId);
  if (action === "getSocietyAdminData") return await getSocietyAdminData(sb, societyId);
  if (action === "getScorecardData") return await getScorecardData(sb, societyId);
  if (action === "getOutingTeams") return await getOutingTeams(sb, societyId, Object.fromEntries(params.entries()));
  if (action === "loadScores") return await loadScores(sb, societyId, Object.fromEntries(params.entries()));
  if (action === "checkExistingScore") return await checkExistingScore(sb, societyId, Object.fromEntries(params.entries()));
  if (action === "getHandicapRules") return await getHandicapRules(sb, societyId);
  if (action === "getHandicapHistory") {
    return await getHandicapHistory(sb, societyId, Object.fromEntries(params.entries()));
  }
  if (action === "getHandicapAppliedOutingIds") {
    return await getHandicapAppliedOutingIds(sb, societyId);
  }
  if (action === "getOutingHandicapAdjustments") {
    return await getOutingHandicapAdjustments(sb, societyId, Object.fromEntries(params.entries()));
  }
  if (action === "getAppSettings") return await getAppSettings(sb, Object.fromEntries(params.entries()));
  if (action === "listAiModels") return await listAiModels(Object.fromEntries(params.entries()));
  if (action === "backfillPlayerAndOutingIds") return { success: true, message: "No-op in Supabase backend" };
  return { success: false, error: `Unknown action: ${action}` };
}

async function dispatchPost(ctx: ApiContext) {
  const { sb, action, societyId, data } = ctx;
  if (action === "createSociety") {
    const sid = String(data.societyId || "").trim().toLowerCase();
    if (!sid) throw new Error("societyId is required");
    const { error } = await sb.from("societies").insert({
      society_id: sid,
      society_name: String(data.societyName || ""),
      contact_person: String(data.contactPerson || ""),
      number_of_players: toInt(data.numberOfPlayers, 0),
      number_of_outings: toInt(data.numberOfOutings, 0),
      status: String(data.status || ""),
      created_date: toDateString(new Date()),
      captains_notes: String(data.captainsNotes || ""),
    });
    if (error) throw new Error(error.message);
    return { success: true };
  }
  if (action === "updateSociety") {
    const sid = String(data.societyId || "").trim().toLowerCase();
    if (!sid) throw new Error("societyId is required");
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.societyName != null && String(data.societyName).trim() !== "") {
      updates.society_name = String(data.societyName);
    }
    if (data.contactPerson != null && String(data.contactPerson).trim() !== "") {
      updates.contact_person = String(data.contactPerson);
    }
    if (data.numberOfPlayers != null && String(data.numberOfPlayers) !== "") {
      updates.number_of_players = toInt(data.numberOfPlayers, 0);
    }
    if (data.numberOfOutings != null && String(data.numberOfOutings) !== "") {
      updates.number_of_outings = toInt(data.numberOfOutings, 0);
    }
    if (data.status != null && String(data.status).trim() !== "") {
      updates.status = String(data.status);
    }
    if (data.captainsNotes != null) {
      updates.captains_notes = String(data.captainsNotes);
    }
    const { error } = await sb
      .from("societies")
      .update(updates)
      .eq("society_id", sid);
    if (error) throw new Error(error.message);
    return { success: true };
  }
  if (action === "deleteSociety") {
    const sid = String(data.societyId || "").trim().toLowerCase();
    if (!sid) throw new Error("societyId is required");
    const { error } = await sb
      .from("societies")
      .delete()
      .eq("society_id", sid);
    if (error) throw new Error(error.message);
    return { success: true };
  }
  if (action === "savePlayer" || action === "updatePlayer") {
    const playerName = String(data.playerName || "").trim();
    if (!playerName) throw new Error("playerName is required");

    let playerId = String(data.playerId ?? "").trim();
    if (!playerId) {
      if (action === "updatePlayer") {
        const lookupName = String(data.previousPlayerName ?? "").trim();
        if (!lookupName) {
          throw new Error("previousPlayerName is required when playerId is missing for update");
        }
        const { data: rows, error: qErr } = await sb
          .from("players")
          .select("player_id")
          .eq("society_id", societyId)
          .eq("player_name", lookupName)
          .limit(2);
        if (qErr) throw new Error(qErr.message);
        if (!rows?.length) throw new Error("Player not found for update (missing playerId)");
        if (rows.length > 1) {
          throw new Error("Multiple players share that name; assign distinct player ids before editing");
        }
        playerId = String(rows[0].player_id ?? "").trim();
        if (!playerId) throw new Error("Player row has empty player_id; repair data or recreate the player");
      } else {
        playerId = generateId("p");
      }
    }

    const visitor = toBoolVisitor(data.visitor);
    const handicapIndex = data.handicapIndex != null && String(data.handicapIndex) !== ""
      ? toNum(data.handicapIndex, 0)
      : toNum(data.handicap, 0);
    const playingHandicap = playingHandicapFromIndex(handicapIndex);
    const { error } = await sb.from("players").upsert({
      society_id: societyId,
      player_id: playerId,
      player_name: playerName,
      handicap: playingHandicap,
      handicap_index: handicapIndex,
      visitor,
      updated_at: new Date().toISOString(),
    }, { onConflict: "society_id,player_id" });
    if (error) throw new Error(error.message);
    return { success: true, playerId };
  }
  if (action === "deletePlayer") {
    const playerId = String(data.playerId || "").trim();
    if (!playerId) throw new Error("playerId is required");
    const { error } = await sb.from("players").delete().eq("society_id", societyId).eq("player_id", playerId);
    if (error) throw new Error(error.message);
    return { success: true };
  }
  if (action === "saveCourse" || action === "updateCourse") {
    const courseName = String(data.courseName || "").trim();
    if (!courseName) throw new Error("courseName is required");
    const { error } = await sb.from("courses").upsert({
      course_name: courseName,
      par_indx: String(data.parIndx || ""),
      course_url: String(data.courseURL || ""),
      course_maploc: String(data.courseMaploc || ""),
      club_name: String(data.clubName || ""),
      course_image: String(data.courseImage || ""),
      updated_at: new Date().toISOString(),
    }, { onConflict: "course_name" });
    if (error) throw new Error(error.message);
    return { success: true };
  }
  if (action === "deleteCourse") {
    const courseName = String(data.courseName || "").trim();
    if (!courseName) throw new Error("courseName is required");
    const { error } = await sb.from("courses").delete().eq("course_name", courseName);
    if (error) throw new Error(error.message);
    return { success: true };
  }
  if (action === "saveOuting" || action === "updateOuting") {
    const outingId = String(data.outingId || generateId("o")).trim();
    const outingDate = toDateString(data.date);
    const courseName = String(data.courseName || "").trim();
    if (!outingDate || !courseName) throw new Error("date and courseName are required");
    const { error } = await sb.from("outings").upsert({
      society_id: societyId,
      outing_id: outingId,
      outing_date: outingDate,
      outing_time: String(data.time || ""),
      course_name: courseName,
      comps: String(data.comps || ""),
      blur_leaderboard: data.blurLeaderboard === true || data.blurLeaderboard === "true",
      updated_at: new Date().toISOString(),
    }, { onConflict: "society_id,outing_id" });
    if (error) throw new Error(error.message);
    return { success: true, outingId };
  }
  if (action === "deleteOuting") {
    const outingId = String(data.outingId || "").trim();
    if (!outingId) throw new Error("outingId is required");
    const { error } = await sb.from("outings").delete().eq("society_id", societyId).eq("outing_id", outingId);
    if (error) throw new Error(error.message);
    return { success: true };
  }
  if (action === "saveOutingTeam") return await saveOutingTeam(sb, societyId, data);
  if (action === "saveScore") {
    const outingId = String(data.outingId || "").trim();
    const playerId = String(data.playerId || "").trim();
    if (!outingId || !playerId) throw new Error("outingId and playerId are required");
    const now = new Date().toISOString();
    const rowBody: Record<string, unknown> = {
      society_id: societyId,
      outing_id: outingId,
      player_id: playerId,
      handicap: toInt(data.handicap, 0),
      holes: Array.isArray(data.holes) ? data.holes.map((v) => toInt(v, 0)) : [],
      hole_points: Array.isArray(data.holePoints) ? data.holePoints.map((v) => toInt(v, 0)) : [],
      total_score: toInt(data.totalScore, 0),
      total_points: toInt(data.totalPoints, 0),
      out_score: toInt(data.outScore, 0),
      out_points: toInt(data.outPoints, 0),
      in_score: toInt(data.inScore, 0),
      in_points: toInt(data.inPoints, 0),
      back6_score: toInt(data.back6Score, 0),
      back6_points: toInt(data.back6Points, 0),
      back3_score: toInt(data.back3Score, 0),
      back3_points: toInt(data.back3Points, 0),
      score_timestamp: now,
      updated_at: now,
    };
    // Optional first-save attach. Omit image columns on a normal resubmit so an existing photo is kept.
    let imagePath: string | null = null;
    const imagePayload = decodeImagePayload(data.imageBase64, data.imageMimeType);
    if (imagePayload) {
      const { data: existing } = await sb
        .from("scores")
        .select("image_path")
        .eq("society_id", societyId)
        .eq("outing_id", outingId)
        .eq("player_id", playerId)
        .maybeSingle();
      imagePath = await uploadScorecardImageBytes(
        sb,
        societyId,
        outingId,
        playerId,
        imagePayload.bytes,
        imagePayload.mime,
        existing?.image_path as string | null,
      );
      rowBody.image_path = imagePath;
      rowBody.image_mime = imagePayload.mime;
    }
    const { error } = await sb.from("scores").upsert(rowBody, { onConflict: "society_id,outing_id,player_id" });
    if (error) throw new Error(error.message);
    const imageUrl = imagePath ? await getSignedImageUrl(sb, imagePath) : null;
    return { success: true, timestamp: now, imagePath, imageUrl };
  }
  if (action === "deleteScore") {
    const outingId = String(data.outingId || "").trim();
    const playerId = String(data.playerId || "").trim();
    if (!outingId || !playerId) throw new Error("outingId and playerId are required");
    const { data: existing, error: fetchErr } = await sb
      .from("scores")
      .select("image_path")
      .eq("society_id", societyId)
      .eq("outing_id", outingId)
      .eq("player_id", playerId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    await deleteScorecardImage(sb, existing?.image_path as string | null);
    const { error } = await sb
      .from("scores")
      .delete()
      .eq("society_id", societyId)
      .eq("outing_id", outingId)
      .eq("player_id", playerId);
    if (error) throw new Error(error.message);
    return { success: true };
  }
  if (action === "uploadScoreImage") return await uploadScoreImage(sb, societyId, data);
  if (action === "removeScoreImage") return await removeScoreImage(sb, societyId, data);
  if (action === "loadScores") return await loadScores(sb, societyId, data);
  if (action === "checkExistingScore") return await checkExistingScore(sb, societyId, data);
  if (action === "saveHandicapRules") return await saveHandicapRules(sb, societyId, data);
  if (action === "saveHandicapAdjustment") return await saveHandicapAdjustment(sb, societyId, data);
  if (action === "applyOutingAdjustments") return await applyOutingAdjustments(sb, societyId, data);
  if (action === "mergeScores") return await mergeScores(sb, societyId, data);
  if (action === "importHistoricalAdjustments") {
    return await importHistoricalAdjustments(sb, societyId, data);
  }
  if (action === "analyzeScorecardImage") return await analyzeScorecardImage(data);
  if (action === "lookupCourseWithAi") return await lookupCourseWithAi(sb, data);
  if (action === "generateOutingReport") return await generateOutingReport(sb, societyId, data);
  if (action === "getAppSettings") return await getAppSettings(sb, data);
  if (action === "saveAppSettings") return await saveAppSettings(sb, data);
  if (action === "listAiModels") return await listAiModels(data);
  return { success: false, error: `Unknown action: ${action}` };
}

async function parsePostBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const form = new URLSearchParams(text);
    const dataBlob = form.get("data");
    if (!dataBlob) return {};
    try {
      return JSON.parse(dataBlob);
    } catch {
      return {};
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ success: false, error: "Missing Supabase credentials" }, 500);
  }

  const sb = createClient(supabaseUrl, serviceRoleKey, { db: { schema: "thegolfapp" } });
  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const action = url.searchParams.get("action") || "";
      const societyId = String(url.searchParams.get("societyId") || "").trim().toLowerCase();
      const result = await dispatchGet({
        sb,
        action,
        societyId,
        params: url.searchParams,
        body: {},
        data: {},
      });
      return jsonResponse(result);
    }
    if (req.method === "POST") {
      const body = await parsePostBody(req);
      const action = String(body.action || "");
      const societyId = String(body.societyId || "").trim().toLowerCase();
      const data = (body.data as Record<string, unknown>) || body;
      const result = await dispatchPost({
        sb,
        action,
        societyId,
        params: new URLSearchParams(),
        body,
        data,
      });
      return jsonResponse(result);
    }
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
