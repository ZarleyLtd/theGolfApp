#!/usr/bin/env node
/**
 * Migrate theGolfApp data from Google Apps Script backend to Supabase schema `thegolfapp`.
 *
 * Env:
 * - LEGACY_API_URL
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/migrate-google-to-supabase.mjs --dry-run
 *   node scripts/migrate-google-to-supabase.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";

const LEGACY = process.env.LEGACY_API_URL?.replace(/\/$/, "");
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

if (!LEGACY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required env: LEGACY_API_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const reportDir = path.resolve(process.cwd(), "scripts", "migration-reports");
await fs.mkdir(reportDir, { recursive: true });

const sbHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  "Accept-Profile": "thegolfapp",
  "Content-Profile": "thegolfapp",
  Prefer: "resolution=merge-duplicates,return=minimal",
};

function getLegacyUrl(action, extra = {}) {
  const u = new URL(LEGACY);
  u.searchParams.set("action", action);
  for (const [k, v] of Object.entries(extra)) {
    if (v != null && v !== "") u.searchParams.set(k, String(v));
  }
  return u.toString();
}

async function legacyGet(action, extra = {}) {
  const res = await fetch(getLegacyUrl(action, extra));
  const json = await res.json();
  if (!json?.success) {
    throw new Error(`Legacy action ${action} failed: ${json?.error || "unknown error"}`);
  }
  return json;
}

async function sbUpsert(table, rows, onConflict) {
  if (!rows.length) return;
  if (DRY_RUN) return;
  const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`;
  const res = await fetch(url, { method: "POST", headers: sbHeaders, body: JSON.stringify(rows) });
  if (!res.ok) throw new Error(`Supabase upsert ${table} failed: ${res.status} ${await res.text()}`);
}

async function sbDelete(table, filterQuery) {
  if (DRY_RUN) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filterQuery}`, {
    method: "DELETE",
    headers: sbHeaders,
  });
  if (!res.ok) throw new Error(`Supabase delete ${table} failed: ${res.status} ${await res.text()}`);
}

function normDate(v) {
  if (!v) return null;
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toInt(v, fallback = 0) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function id(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const report = {
  dryRun: DRY_RUN,
  startedAt: new Date().toISOString(),
  counts: {},
  warnings: [],
};

const societiesRes = await legacyGet("getAllSocieties");
const societies = societiesRes.societies || [];
report.counts.societies = societies.length;

const societyRows = societies.map((s) => ({
  society_id: String(s.societyId || "").trim().toLowerCase(),
  society_name: s.societyName || "",
  contact_person: s.contactPerson || "",
  number_of_players: toInt(s.numberOfPlayers, 0),
  number_of_outings: toInt(s.numberOfOutings, 0),
  status: s.status || "Active",
  created_date: normDate(s.createdDate),
  captains_notes: s.captainsNotes || "",
}));
await sbUpsert("societies", societyRows, "society_id");

const allCoursesRes = await legacyGet("getCourses");
const allCourses = allCoursesRes.courses || [];
report.counts.courses = allCourses.length;
await sbUpsert(
  "courses",
  allCourses.map((c) => ({
    course_name: c.courseName || "",
    par_indx: c.parIndx || "",
    course_url: c.courseURL || "",
    course_maploc: c.courseMaploc || "",
    club_name: c.clubName || "",
    course_image: c.courseImage || "",
  })),
  "course_name",
);

let playersTotal = 0;
let outingsTotal = 0;
let teamsTotal = 0;
let teamMembersTotal = 0;
let scoresTotal = 0;

for (const s of societies) {
  const societyId = String(s.societyId || "").trim().toLowerCase();
  if (!societyId) continue;

  const playersRes = await legacyGet("getPlayers", { societyId });
  const players = playersRes.players || [];
  playersTotal += players.length;
  const playerRows = players.map((p) => ({
    society_id: societyId,
    player_id: String(p.playerId || id("p")),
    player_name: p.playerName || "",
    handicap: toInt(p.handicap, 0),
  }));
  await sbUpsert("players", playerRows, "society_id,player_id");

  const outingsRes = await legacyGet("getOutings", { societyId });
  const outings = outingsRes.outings || [];
  outingsTotal += outings.length;
  const outingRows = outings.map((o) => ({
    society_id: societyId,
    outing_id: String(o.outingId || id("o")),
    outing_date: normDate(o.date),
    outing_time: o.time || "",
    course_name: o.courseName || "",
    comps: o.comps || "",
  }));
  await sbUpsert("outings", outingRows, "society_id,outing_id");

  const teamsRes = await legacyGet("getOutingTeams", { societyId });
  const teamsByOuting = teamsRes.teamsByOuting || {};
  const teamRows = [];
  const teamMemberRows = [];
  for (const [outingId, teams] of Object.entries(teamsByOuting)) {
    for (const t of teams || []) {
      const teamId = String(t.teamId || id("t"));
      teamRows.push({
        society_id: societyId,
        outing_id: outingId,
        team_id: teamId,
        team_name: t.teamName || "",
      });
      const playerIds = Array.isArray(t.playerIds) ? t.playerIds : [];
      for (const playerId of playerIds) {
        teamMemberRows.push({
          society_id: societyId,
          outing_id: outingId,
          team_id: teamId,
          player_id: String(playerId || "").trim(),
        });
      }
    }
  }
  teamsTotal += teamRows.length;
  teamMembersTotal += teamMemberRows.length;
  await sbUpsert("teams", teamRows, "society_id,outing_id,team_id");
  if (teamRows.length > 0) {
    await sbDelete("team_members", `society_id=eq.${encodeURIComponent(societyId)}`);
    await sbUpsert("team_members", teamMemberRows, "society_id,outing_id,team_id,player_id");
  }

  const scoresRes = await legacyGet("loadScores", { societyId, limit: 5000 });
  const scores = scoresRes.scores || [];
  scoresTotal += scores.length;
  const scoreRows = scores.map((sc) => ({
    society_id: societyId,
    outing_id: String(sc.outingId || "").trim(),
    player_id: String(sc.playerId || "").trim(),
    handicap: toInt(sc.handicap, 0),
    holes: Array.isArray(sc.holes) ? sc.holes.map((v) => toInt(v, 0)) : [],
    hole_points: Array.isArray(sc.holePoints) ? sc.holePoints.map((v) => toInt(v, 0)) : [],
    total_score: toInt(sc.totalScore, 0),
    total_points: toInt(sc.totalPoints, 0),
    out_score: toInt(sc.outScore, 0),
    out_points: toInt(sc.outPoints, 0),
    in_score: toInt(sc.inScore, 0),
    in_points: toInt(sc.inPoints, 0),
    back6_score: toInt(sc.back6Score, 0),
    back6_points: toInt(sc.back6Points, 0),
    back3_score: toInt(sc.back3Score, 0),
    back3_points: toInt(sc.back3Points, 0),
    score_timestamp: sc.timestamp || new Date().toISOString(),
  })).filter((r) => r.outing_id && r.player_id);
  await sbUpsert("scores", scoreRows, "society_id,outing_id,player_id");
}

report.counts.players = playersTotal;
report.counts.outings = outingsTotal;
report.counts.teams = teamsTotal;
report.counts.teamMembers = teamMembersTotal;
report.counts.scores = scoresTotal;
report.completedAt = new Date().toISOString();

const reportFile = path.join(reportDir, `migration-report-${Date.now()}.json`);
await fs.writeFile(reportFile, JSON.stringify(report, null, 2), "utf8");
console.log(`Migration ${DRY_RUN ? "dry-run " : ""}complete. Report: ${reportFile}`);
