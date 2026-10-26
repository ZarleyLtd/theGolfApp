import assert from "node:assert/strict";
import test from "node:test";
import {
  SEASON_COMMENTARY_INSTRUCTIONS,
  buildSeasonCommentaryFacts,
  buildSeasonReportPrompt,
  isSeasonCommentarySociety,
  parseOverallRules,
  type SeasonInput,
} from "../supabase/functions/golfapp-api/season-standings.ts";

function outing(id: string, course: string, date: string, blur = false) {
  return { outingId: id, courseName: course, date, time: "10:00", blurLeaderboard: blur };
}

function score(
  outingId: string,
  playerName: string,
  totalPoints: number,
  holePoints?: number[],
  visitor = false,
) {
  return { outingId, playerName, totalPoints, holePoints: holePoints || [], visitor };
}

function facts(input: SeasonInput): string {
  const result = buildSeasonCommentaryFacts(input);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error);
  return result.facts;
}

test("season commentary is only for botanic", () => {
  assert.equal(isSeasonCommentarySociety("botanic"), true);
  assert.equal(isSeasonCommentarySociety(" Botanic "), true);
  assert.equal(isSeasonCommentarySociety("elmgreen"), false);
});

test("parses overall status the same way as the leaderboard", () => {
  assert.deepEqual(parseOverallRules("OAP OBN:6"), {
    mode: "OAP",
    overallEnabled: true,
    excludeVisitors: true,
    bestN: 6,
  });
  assert.deepEqual(parseOverallRules("O10V"), {
    mode: "O10",
    overallEnabled: true,
    excludeVisitors: false,
    bestN: 0,
  });
  assert.equal(parseOverallRules("oap, v").excludeVisitors, false);
  assert.equal(parseOverallRules("").overallEnabled, false);
  assert.equal(parseOverallRules("").excludeVisitors, true);
});

test("aggregate season tracks the lead change and the climbs", () => {
  const text = facts({
    status: "OAP",
    outings: [outing("o1", "Elmgreen", "2025-04-12"), outing("o2", "Portmarnock", "2025-05-03")],
    scores: [
      score("o1", "Ann", 30),
      score("o1", "Bob", 20),
      score("o2", "Bob", 40),
    ],
  });
  assert.match(text, /Overall scoring is aggregate Stableford points/);
  assert.match(text, /Visitors are excluded/);
  assert.match(text, /After Round 1 — Elmgreen \(12 Apr 2025\): Ann leads/);
  assert.match(text, /After Round 2 — Portmarnock \(3 May 2025\): Bob takes the lead from Ann/);
  assert.match(text, /Bob: 2nd → 1st/);
  assert.match(text, /Ann: 1st → 2nd/);
  assert.match(text, /1st Bob — 60 points \(up from 2nd\)/);
  assert.match(text, /2nd Ann — 30 points \(down from 1st\)/);
  assert.match(text, /1st Ann — 30 Stableford/);
  assert.doesNotMatch(text, /hidden on the public leaderboard/);
});

test("best-n drops the worst outing and says so", () => {
  const text = facts({
    status: "OAP OBN:1",
    outings: [outing("o1", "Elmgreen", "2025-04-12"), outing("o2", "Portmarnock", "2025-05-03")],
    scores: [
      score("o1", "Ann", 40),
      score("o1", "Bob", 10),
      score("o2", "Ann", 15),
      score("o2", "Bob", 30),
    ],
  });
  assert.match(text, /best 1 outing counts/);
  assert.match(text, /1st Ann — 40 points \(held 1st; counting Round 1 \(40\); not counting Round 2 \(15\)\)/);
  assert.match(text, /2nd Bob — 30 points \(held 2nd; counting Round 2 \(30\); not counting Round 1 \(10\)\)/);
});

test("equal points keep the earlier outing when only the best one counts", () => {
  const text = facts({
    status: "OBN:1",
    outings: [outing("o1", "Elmgreen", "2025-04-12"), outing("o2", "Portmarnock", "2025-05-03")],
    scores: [
      score("o1", "Ann", 10),
      score("o2", "Ann", 10),
    ],
  });
  assert.match(text, /counting Round 1 \(10\); not counting Round 2 \(10\)/);
});

test("1st-to-10th points, not Stableford, decide the overall table", () => {
  const text = facts({
    status: "O10",
    outings: [outing("o1", "Elmgreen", "2025-04-12"), outing("o2", "Portmarnock", "2025-05-03")],
    scores: [
      score("o1", "Ann", 40),
      score("o1", "Bob", 30),
      score("o1", "Cam", 20),
      score("o2", "Cam", 42),
      score("o2", "Bob", 35),
    ],
  });
  assert.match(text, /1st-to-10th method/);
  assert.match(text, /1st Ann — 40 Stableford, 10 position points/);
  assert.match(text, /2nd Bob — 30 Stableford, 9 position points/);
  assert.match(text, /Bob and Cam lead, after Ann/);
  assert.match(text, /tied 1st Bob — 18 position points \(up from 2nd\)/);
  assert.match(text, /tied 1st Cam — 18 position points \(up from 3rd\)/);
  assert.match(text, /3rd Ann — 10 position points \(down from 1st\)/);
  assert.match(text, /Cam: 3rd → 1st/);
  assert.match(text, /Ann: 1st → 3rd/);
});

test("countback separates equal Stableford and ties share a place", () => {
  const ann = Array(9).fill(0).concat(Array(9).fill(2));
  const bob = Array(9).fill(2).concat(Array(9).fill(0));
  const text = facts({
    status: "OAP",
    outings: [outing("o1", "Elmgreen", "2025-04-12")],
    scores: [
      score("o1", "Ann", 18, ann),
      score("o1", "Bob", 18, bob),
      score("o1", "Cam", 18, ann),
      score("o1", "Dee", 10),
    ],
  });
  assert.match(text, /tied 1st Ann — 18 Stableford/);
  assert.match(text, /tied 1st Cam — 18 Stableford/);
  assert.match(text, /3rd Bob — 18 Stableford/);
  assert.match(text, /4th Dee — 10 Stableford/);
  assert.doesNotMatch(text, /2nd /);
});

test("a player ahead of the next on countback is labelled", () => {
  const ann = Array(9).fill(0).concat(Array(9).fill(2));
  const bob = Array(9).fill(2).concat(Array(9).fill(0));
  const text = facts({
    status: "OAP",
    outings: [outing("o1", "Elmgreen", "2025-04-12")],
    scores: [score("o1", "Ann", 18, ann), score("o1", "Bob", 18, bob)],
  });
  assert.match(text, /1st Ann — 18 Stableford \(same Stableford as the next player, ahead on countback\)/);
  assert.match(text, /2nd Bob — 18 Stableford/);
});

test("visitors are dropped unless the society includes them", () => {
  const excluded = facts({
    status: "OAP",
    outings: [outing("o1", "Elmgreen", "2025-04-12")],
    scores: [score("o1", "Ann", 30), score("o1", "Vic", 50, [], true)],
  });
  assert.match(excluded, /1st Ann — 30 points/);
  assert.doesNotMatch(excluded, /\bVic\b/);

  const included = facts({
    status: "OAPV",
    outings: [outing("o1", "Elmgreen", "2025-04-12")],
    scores: [score("o1", "Ann", 30), score("o1", "Vic", 50, [], true)],
  });
  assert.match(included, /Visitors are included/);
  assert.match(included, /1st Vic — 50 points/);
});

test("a hidden outing is still in the season story and labelled", () => {
  const text = facts({
    status: "OAP",
    outings: [outing("o1", "Elmgreen", "2025-04-12", true)],
    scores: [score("o1", "Ann", 33)],
  });
  assert.match(text, /hidden on the public leaderboard/);
  assert.match(text, /1st Ann — 33 Stableford/);
});

test("the higher card is kept when a player has two scores on one outing", () => {
  const text = facts({
    status: "OAP",
    outings: [outing("o1", "Elmgreen", "2025-04-12")],
    scores: [score("o1", "Ann", 20), score("o1", "Ann", 35)],
  });
  assert.match(text, /1st Ann — 35 Stableford/);
  assert.doesNotMatch(text, /20 Stableford/);
});

test("no scores is an error rather than an empty commentary", () => {
  const result = buildSeasonCommentaryFacts({ status: "OAP", outings: [], scores: [] });
  assert.equal(result.ok, false);
});

test("the prompt lays on praise and criticism against sporting history", () => {
  assert.match(SEASON_COMMENTARY_INSTRUCTIONS, /praise or criticism/i);
  assert.match(SEASON_COMMENTARY_INSTRUCTIONS, /major sporting events throughout history/i);
  assert.match(SEASON_COMMENTARY_INSTRUCTIONS, /twists and turns/i);
  assert.match(SEASON_COMMENTARY_INSTRUCTIONS, /Do not invent/);
  const prompt = buildSeasonReportPrompt({
    societyName: "Botanic",
    facts: "Round 1 — Ann leads",
    styleHint: "keep the also-rans in",
    contentHint: "",
  });
  assert.match(prompt, /Society: Botanic/);
  assert.match(prompt, /major sporting events throughout history/);
  assert.match(prompt, /keep the also-rans in/);
  assert.match(prompt, /Round 1 — Ann leads/);
  assert.match(prompt, /Content hints \(optional — follow if provided\): none/);
});
