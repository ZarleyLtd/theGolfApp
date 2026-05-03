import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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

const SCORECARD_AI_MODEL = "gemini-2.5-flash";
const COURSE_LOOKUP_AI_MODEL = "gemini-2.5-flash";

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

function buildDefaultCourseLookupPrompt(courseName: string): string {
  return (
    `Get 18-hole par and stroke index (Men's/Championship tees) for: ${courseName}.\n\n` +
    "SOURCE (in this order):\n" +
    "1. Official club website scorecard.\n" +
    "2. If unavailable, use reputable golf listings.\n\n" +
    "Return only one JSON object with keys:\n" +
    '{"pars":[18 ints],"indexes":[18 ints],"website":"...","clubName":"...","courseMapLoc":"...","courseName":"..."}'
  );
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
  const json = await callGemini(SCORECARD_AI_MODEL, payload);
  const extractedText = extractGeminiText(json);
  if (!extractedText) throw new Error("No extraction result from Gemini");
  return parseGeminiScorecardCsv(extractedText);
}

async function lookupCourseWithAi(data: Record<string, unknown>) {
  const courseName = String(data.courseName || "").trim();
  if (!courseName) throw new Error("Course name is required");
  const prompt = String(data.prompt || "").trim() || buildDefaultCourseLookupPrompt(courseName);
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
  return { success: true, data: normalized };
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
      visitor: row.visitor === true,
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
  };
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
  return { success: true, scores: (data || []).map(mapScoreRow) };
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
  return { success: true, exists: true, score: mapScoreRow(data) };
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
  const teamId = String(args.teamId || "").trim();

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

  const teamObj = (args.team as Record<string, unknown>) || {};
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
    const playerId = String(data.playerId || generateId("p")).trim();
    const playerName = String(data.playerName || "").trim();
    if (!playerName) throw new Error("playerName is required");
    const visitor = data.visitor === true;
    const { error } = await sb.from("players").upsert({
      society_id: societyId,
      player_id: playerId,
      player_name: playerName,
      handicap: toInt(data.handicap, 0),
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
    const { error } = await sb.from("scores").upsert({
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
    }, { onConflict: "society_id,outing_id,player_id" });
    if (error) throw new Error(error.message);
    return { success: true, timestamp: now };
  }
  if (action === "deleteScore") {
    const outingId = String(data.outingId || "").trim();
    const playerId = String(data.playerId || "").trim();
    if (!outingId || !playerId) throw new Error("outingId and playerId are required");
    const { error } = await sb
      .from("scores")
      .delete()
      .eq("society_id", societyId)
      .eq("outing_id", outingId)
      .eq("player_id", playerId);
    if (error) throw new Error(error.message);
    return { success: true };
  }
  if (action === "loadScores") return await loadScores(sb, societyId, data);
  if (action === "checkExistingScore") return await checkExistingScore(sb, societyId, data);
  if (action === "analyzeScorecardImage") return await analyzeScorecardImage(data);
  if (action === "lookupCourseWithAi") return await lookupCourseWithAi(data);
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
