/**
 * Season leaderboard facts for AI commentary.
 *
 * Mirrors the public Overall leaderboard: outing order is chronological, a tie on
 * Stableford is split by back-9 / back-6 / back-3 / last-hole countback, and the
 * overall table is ranked on total points only (OAP = Stableford, O10 = 1st-to-10th
 * place points). OBN:n keeps each player's best n outings. Visitors follow the
 * society's OAP / OAPV / O10 / O10V flag.
 */

export const SEASON_COMMENTARY_SOCIETY_ID = "botanic";

export const SEASON_COMMENTARY_INSTRUCTIONS =
  "Write a season commentary about how the competition was won and lost. " +
  "Do not describe individual holes. Write about how players finished each outing and how they climbed or fell on the overall leaderboard.\n\n" +
  "Really lay on the praise or criticism, comparing the twists and turns of the season to major sporting events throughout history. " +
  "When a player surges, collapses, clings on, or snatches the title, name a real historical sporting moment that fits and say whether this season earns that comparison as praise or as criticism. " +
  "Be lavish with the players who climbed and with the champion. Be sharp about fades, missed chances, and players who watched the lead slip away. " +
  "Stay affectionate enough for a golf society, but do not soften a collapse into a compliment.\n\n" +
  "Accuracy is essential. Use only the standings in the facts below. Do not invent players, outings, positions, point totals, or lead changes. " +
  "If the facts do not support a claim, leave it out. Do not mention handicaps. Do not narrate hole-by-hole golf.\n\n" +
  "Write in plain prose, as a commentator looking back on the season. A few substantial paragraphs. No headings, no bullet list, no markdown.";

export type SeasonOuting = {
  outingId: string;
  courseName: string;
  date: string;
  time: string;
  blurLeaderboard: boolean;
};

export type SeasonScore = {
  outingId: string;
  playerName: string;
  totalPoints: number;
  holePoints: number[];
  visitor: boolean;
};

export type SeasonInput = {
  status: string;
  outings: SeasonOuting[];
  scores: SeasonScore[];
};

export type OverallRules = {
  mode: "" | "OAP" | "O10";
  overallEnabled: boolean;
  excludeVisitors: boolean;
  bestN: number;
};

const MAX_PLACES = 99;
const O10_POINTS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const COUNTBACK_RANGES = [
  [9, 10, 11, 12, 13, 14, 15, 16, 17],
  [12, 13, 14, 15, 16, 17],
  [15, 16, 17],
  [17],
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Card = {
  playerKey: string;
  playerName: string;
  totalPoints: number;
  holePoints: number[];
};

type Contribution = {
  roundNumber: number;
  points: number;
};

type PlayerState = {
  key: string;
  name: string;
  rounds: Contribution[];
};

export function isSeasonCommentarySociety(societyId: string): boolean {
  return String(societyId || "").trim().toLowerCase() === SEASON_COMMENTARY_SOCIETY_ID;
}

export function parseOverallRules(status: string): OverallRules {
  const parts = String(status || "")
    .trim()
    .toUpperCase()
    .split(/[,\s]+/)
    .filter(Boolean);
  let mode: "" | "OAP" | "O10" = "";
  let includeVisitors = false;
  let bestN = 0;
  for (const p of parts) {
    if (p === "OAPV") {
      mode = "OAP";
      includeVisitors = true;
    } else if (p === "O10V") {
      mode = "O10";
      includeVisitors = true;
    } else if (p === "OAP" || p === "O10") {
      mode = p;
    } else if (p.startsWith("OBN:")) {
      const n = parseInt(p.slice(4), 10);
      bestN = Math.min(MAX_PLACES, Math.max(0, Number.isFinite(n) ? n : 0));
    }
  }
  if (!includeVisitors && (mode === "OAP" || mode === "O10") && parts.includes("V")) {
    includeVisitors = true;
  }
  const overallEnabled = mode === "OAP" || mode === "O10";
  return {
    mode,
    overallEnabled,
    excludeVisitors: overallEnabled ? !includeVisitors : true,
    bestN,
  };
}

function norm(n: number): number {
  return Math.round((Number(n) || 0) * 1000) / 1000;
}

function sumHoles(holePoints: number[], indices: number[]): number {
  let sum = 0;
  for (const idx of indices) {
    const p = parseFloat(String(holePoints?.[idx]));
    if (!Number.isNaN(p)) sum += p;
  }
  return sum;
}

function compareOuting(a: Card, b: Card): number {
  const pa = norm(a.totalPoints);
  const pb = norm(b.totalPoints);
  if (pa !== pb) return pb - pa;
  for (const range of COUNTBACK_RANGES) {
    const sa = sumHoles(a.holePoints, range);
    const sb = sumHoles(b.holePoints, range);
    if (sa !== sb) return sb - sa;
  }
  return 0;
}

function ordinal(n: number): string {
  const suf = n % 10 === 1 && n !== 11
    ? "st"
    : n % 10 === 2 && n !== 12
    ? "nd"
    : n % 10 === 3 && n !== 13
    ? "rd"
    : "th";
  return `${n}${suf}`;
}

function formatPts(n: number): string {
  const rounded = norm(n);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const month = MONTHS[parseInt(m[2], 10) - 1];
  if (!month) return iso;
  return `${parseInt(m[3], 10)} ${month} ${m[1]}`;
}

function playerKey(name: string): string {
  return String(name || "").trim().toLowerCase();
}

function o10Points(position: number): number {
  return position >= 1 && position <= 10 ? O10_POINTS[position - 1] : 0;
}

function countingTotal(rounds: Contribution[], bestN: number): { total: number; counting: boolean[] } {
  const counting = rounds.map(() => true);
  if (bestN > 0 && rounds.length > bestN) {
    const order = rounds.map((r, idx) => ({ idx, pts: norm(r.points) }));
    order.sort((a, b) => b.pts - a.pts);
    counting.fill(false);
    for (let k = 0; k < bestN; k++) counting[order[k].idx] = true;
  }
  let total = 0;
  for (let i = 0; i < rounds.length; i++) {
    if (counting[i]) total += norm(rounds[i].points);
  }
  return { total: norm(total), counting };
}

function rulesParagraph(rules: OverallRules): string {
  const lines: string[] = [];
  if (!rules.overallEnabled) {
    lines.push(
      "The Overall competition is switched off for this society. The table below is still the season story: combined Stableford points for members across every scored outing.",
    );
  } else if (rules.mode === "O10") {
    lines.push(
      "Overall scoring is the 1st-to-10th method: 1st = 10 points, 2nd = 9, down to 10th = 1. Ties share that place's points and the next place is skipped. Players outside the top 10 get 0 from that outing.",
    );
  } else {
    lines.push("Overall scoring is aggregate Stableford points.");
  }
  if (rules.bestN > 0) {
    lines.push(
      `Only each player's best ${rules.bestN} ${rules.bestN === 1 ? "outing counts" : "outings count"} toward the overall total. Other outings are listed as not counting.`,
    );
  } else {
    lines.push("Every scored outing counts toward the overall total.");
  }
  lines.push(
    rules.excludeVisitors
      ? "Visitors are excluded from these standings."
      : "Visitors are included in these standings.",
  );
  return lines.join(" ");
}

function outingHeading(outing: SeasonOuting, roundNumber: number): string {
  const course = outing.courseName.trim() || "Outing";
  const date = formatDate(outing.date.trim());
  const when = date ? `${course} (${date})` : course;
  const hidden = outing.blurLeaderboard ? " — hidden on the public leaderboard" : "";
  return `Round ${roundNumber} — ${when}${hidden}`;
}

export function buildSeasonCommentaryFacts(
  input: SeasonInput,
): { ok: true; facts: string } | { ok: false; error: string } {
  const rules = parseOverallRules(input.status || "");
  const outings = (input.outings || [])
    .filter((o) => o && String(o.outingId || "").trim())
    .slice()
    .sort((a, b) => {
      const da = `${a.date || ""}|${a.time || ""}|${a.outingId}`;
      const db = `${b.date || ""}|${b.time || ""}|${b.outingId}`;
      return da < db ? -1 : da > db ? 1 : 0;
    });
  const outingById = new Map<string, SeasonOuting>();
  for (const outing of outings) {
    if (!outingById.has(outing.outingId)) outingById.set(outing.outingId, outing);
  }

  const byOuting = new Map<string, Card[]>();
  for (const raw of input.scores || []) {
    if (rules.excludeVisitors && raw.visitor) continue;
    const name = String(raw.playerName || "").trim();
    const key = playerKey(name);
    if (!key) continue;
    const outing = outingById.get(String(raw.outingId || "").trim());
    if (!outing) continue;
    const card: Card = {
      playerKey: key,
      playerName: name,
      totalPoints: norm(raw.totalPoints),
      holePoints: Array.isArray(raw.holePoints) ? raw.holePoints.map((n) => norm(n)) : [],
    };
    const list = byOuting.get(outing.outingId) || [];
    const existing = list.findIndex((c) => c.playerKey === key);
    if (existing === -1) list.push(card);
    else if (compareOuting(card, list[existing]) < 0) list[existing] = card;
    byOuting.set(outing.outingId, list);
  }

  const played = outings.filter((o) => (byOuting.get(o.outingId) || []).length > 0);
  if (!played.length) {
    return { ok: false, error: "No scores recorded for this season." };
  }

  const players = new Map<string, PlayerState>();
  const previous = new Map<string, number>();
  const firstPlace = new Map<string, number>();
  const roundBlocks: string[] = [];
  const leaderLines: string[] = [];
  let previousLeaders: string[] | null = null;
  const useO10 = rules.mode === "O10";

  played.forEach((outing, index) => {
    const roundNumber = index + 1;
    const cards = (byOuting.get(outing.outingId) || []).slice().sort(compareOuting);
    const finish: string[] = [];
    let i = 0;
    let running = 0;
    while (i < cards.length) {
      let j = i + 1;
      while (j < cards.length && compareOuting(cards[i], cards[j]) === 0) j++;
      const group = cards.slice(i, j).sort((a, b) => a.playerName.localeCompare(b.playerName));
      const position = running + 1;
      const tied = group.length > 1;
      const place = `${tied ? "tied " : ""}${ordinal(position)}`;
      for (let g = 0; g < group.length; g++) {
        const card = group[g];
        const points = useO10 ? o10Points(position) : card.totalPoints;
        let state = players.get(card.playerKey);
        if (!state) {
          state = { key: card.playerKey, name: card.playerName, rounds: [] };
          players.set(card.playerKey, state);
        }
        state.name = card.playerName;
        state.rounds.push({ roundNumber, points });
        const next = cards[j];
        const countback = !tied && next && norm(next.totalPoints) === card.totalPoints;
        const o10Bit = useO10 ? `, ${formatPts(points)} position points` : "";
        const cbBit = countback ? " (same Stableford as the next player, ahead on countback)" : "";
        finish.push(
          `${place} ${card.playerName} — ${formatPts(card.totalPoints)} Stableford${o10Bit}${cbBit}`,
        );
      }
      running += group.length;
      i = j;
    }

    const boardRows: { key: string; name: string; total: number; detail: string }[] = [];
    for (const state of players.values()) {
      const counted = countingTotal(state.rounds, rules.bestN);
      if (counted.total <= 0) continue;
      let detail = "";
      if (rules.bestN > 0 && counted.counting.some((on) => !on)) {
        const on: string[] = [];
        const off: string[] = [];
        state.rounds.forEach((round, idx) => {
          const bit = `Round ${round.roundNumber} (${formatPts(round.points)})`;
          if (counted.counting[idx]) on.push(bit);
          else off.push(bit);
        });
        detail = `; counting ${on.join(", ")}`;
        if (off.length) detail += `; not counting ${off.join(", ")}`;
      }
      boardRows.push({ key: state.key, name: state.name, total: counted.total, detail });
    }
    boardRows.sort((a, b) => {
      if (a.total !== b.total) return b.total - a.total;
      return a.name.localeCompare(b.name);
    });

    const boardLines: string[] = [];
    let b = 0;
    let bRunning = 0;
    const leaders: string[] = [];
    while (b < boardRows.length) {
      let c = b + 1;
      while (c < boardRows.length && boardRows[c].total === boardRows[b].total) c++;
      const group = boardRows.slice(b, c);
      const position = bRunning + 1;
      const tied = group.length > 1;
      const place = `${tied ? "tied " : ""}${ordinal(position)}`;
      for (const row of group) {
        if (!firstPlace.has(row.key)) firstPlace.set(row.key, position);
        const prev = previous.has(row.key) ? previous.get(row.key)! : null;
        let move = "new on the board";
        if (prev != null && prev === position) move = `held ${ordinal(position)}`;
        else if (prev != null && prev > position) move = `up from ${ordinal(prev)}`;
        else if (prev != null) move = `down from ${ordinal(prev)}`;
        const unit = useO10 ? "position points" : "points";
        boardLines.push(`${place} ${row.name} — ${formatPts(row.total)} ${unit} (${move}${row.detail})`);
        if (position === 1) leaders.push(row.name);
      }
      bRunning += group.length;
      b = c;
    }

    previous.clear();
    b = 0;
    bRunning = 0;
    while (b < boardRows.length) {
      let c = b + 1;
      while (c < boardRows.length && boardRows[c].total === boardRows[b].total) c++;
      const position = bRunning + 1;
      for (const row of boardRows.slice(b, c)) previous.set(row.key, position);
      bRunning += c - b;
      b = c;
    }

    const leaderNames = leaders.slice().sort((a, b2) => a.localeCompare(b2));
    const leaderLabel = leaderNames.join(" and ");
    const pluralLeaders = leaderNames.length > 1;
    let leaderNote = `${leaderLabel} ${pluralLeaders ? "lead" : "leads"}`;
    if (previousLeaders) {
      const same = previousLeaders.length === leaderNames.length &&
        previousLeaders.every((name, idx) => name === leaderNames[idx]);
      if (same) leaderNote = `${leaderLabel} still ${pluralLeaders ? "lead" : "leads"}`;
      else if (leaderNames.length === 1 && previousLeaders.length === 1) {
        leaderNote = `${leaderNames[0]} takes the lead from ${previousLeaders[0]}`;
      } else leaderNote = `${leaderLabel} lead, after ${previousLeaders.join(" and ")}`;
    }
    leaderLines.push(`After ${outingHeading(outing, roundNumber)}: ${leaderNote}`);
    previousLeaders = leaderNames;

    const pointsWord = useO10 ? "Overall leaderboard after this round (1st-to-10th points)" : "Overall leaderboard after this round";
    roundBlocks.push(
      [
        outingHeading(outing, roundNumber),
        "How they finished:",
        finish.join("\n"),
        `${pointsWord}:`,
        boardLines.join("\n"),
      ].join("\n"),
    );
  });

  const finalRows: { name: string; key: string; position: number; total: number }[] = [];
  const finalSource: { key: string; name: string; total: number }[] = [];
  for (const state of players.values()) {
    const counted = countingTotal(state.rounds, rules.bestN);
    if (counted.total <= 0) continue;
    finalSource.push({ key: state.key, name: state.name, total: counted.total });
  }
  finalSource.sort((a, b) => (a.total !== b.total ? b.total - a.total : a.name.localeCompare(b.name)));
  let f = 0;
  let fRunning = 0;
  while (f < finalSource.length) {
    let g = f + 1;
    while (g < finalSource.length && finalSource[g].total === finalSource[f].total) g++;
    const position = fRunning + 1;
    for (const row of finalSource.slice(f, g)) finalRows.push({ ...row, position });
    fRunning += g - f;
    f = g;
  }

  const climbs = finalRows
    .map((row) => {
      const start = firstPlace.get(row.key);
      if (start == null) return null;
      return { name: row.name, start, end: row.position, delta: start - row.position };
    })
    .filter((row): row is { name: string; start: number; end: number; delta: number } => !!row && row.delta >= 1)
    .sort((a, b) => b.delta - a.delta || a.name.localeCompare(b.name))
    .slice(0, 5);
  const falls = finalRows
    .map((row) => {
      const start = firstPlace.get(row.key);
      if (start == null) return null;
      return { name: row.name, start, end: row.position, delta: row.position - start };
    })
    .filter((row): row is { name: string; start: number; end: number; delta: number } => !!row && row.delta >= 1)
    .sort((a, b) => b.delta - a.delta || a.name.localeCompare(b.name))
    .slice(0, 5);

  function movementLines(
    rows: { name: string; start: number; end: number }[],
    empty: string,
  ): string {
    if (!rows.length) return empty;
    return rows.map((row) => `${row.name}: ${ordinal(row.start)} → ${ordinal(row.end)}`).join("\n");
  }

  const facts = [
    rulesParagraph(rules),
    "",
    `Scored rounds: ${played.length}`,
    "",
    "Leaders through the season:",
    leaderLines.join("\n"),
    "",
    "Biggest climbs (place on first appearance → final place):",
    movementLines(climbs, "Nobody climbed from their first appearance."),
    "",
    "Biggest falls (place on first appearance → final place):",
    movementLines(falls, "Nobody fell from their first appearance."),
    "",
    "Round by round:",
    "",
    roundBlocks.join("\n\n"),
  ].join("\n");

  return { ok: true, facts };
}

export function buildSeasonReportPrompt(args: {
  societyName: string;
  facts: string;
  styleHint: string;
  contentHint: string;
}): string {
  const styleHint = args.styleHint.trim() || "none";
  const contentHint = args.contentHint.trim() || "none";
  const societyName = args.societyName.trim() || "the society";
  return (
    "You are a sports commentator writing the season review of a golf society Stableford competition.\n\n" +
    `Society: ${societyName}\n\n` +
    `${SEASON_COMMENTARY_INSTRUCTIONS}\n\n` +
    `Style hints (optional — follow if provided, but do not drop the historical comparisons or the praise and criticism): ${styleHint}\n` +
    `Content hints (optional — follow if provided): ${contentHint}\n\n` +
    "Season facts (use only these):\n\n" +
    args.facts +
    "\n\nReturn plain text commentary only. Do not wrap the response in markdown code fences."
  );
}
