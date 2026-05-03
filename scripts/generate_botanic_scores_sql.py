#!/usr/bin/env python3
"""Generate SQL: new thegolfapp.players for botanic + upsert all scores from CSV."""
import csv
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "docs" / "Supabase Snippet Retrieve Scores Records.csv"
OUT_SQL = ROOT / "supabase" / "seeds" / "20260503_botanic_scores_from_csv.sql"

OUTING_KEYS = {
    ("Concra Wood", "2026-05-02"): "o_vl1amc4d",
    ("Corballis", "2026-03-14"): "o_ollly7qi3",
    ("Newlands", "2026-04-10"): "o_rrb5p83gl",
}

COURSE_CSV_TO_DB = {
    "Concra Wood": "Concra Wood",
    "Corballis Links": "Corballis",
    "Newlands": "Newlands",
}

# Existing master: norm (lower, spaceless) -> player_id
PLAYER_BY_NORM = {
    "adammahon": "p_tr2zw6l1m",
    "aidankelly": "p_dfww1fg7w",
    "billtonge": "p_w97mxs6in",
    "davekernan": "p_b7xfy1nt0",
    "declanbyrne": "p_4bkprhe6i",
    "franklynott": "p_2kuydllaw",
    "jimbrennan": "p_d7yd5tktl",
    "johnpower": "p_x95jjones",
    "lorcankelly": "p_7unaoenpd",
    "mickgarrahan": "p_e6lsmqvw6",
    "mickgilligan": "p_8wm1hxstk",
    "niallcullen": "p_nj7cjlfl7",
    "paulflynn": "p_mk8tcp3on",
    "paulmurphy": "p_36eeimlun",
    "peterglynn": "p_kd72crc4m",
    "shayryan": "p_hmw6yx9mz",
    "stephenhanna": "p_dlonq44f0",
    "tonycorcoran": "p_88ln2v6gn",
    "trevorcudden": "p_wx79n7owu",
}

PLAYER_NORM_ALIASES = {
    "davidkernan": "p_b7xfy1nt0",
}

# New master rows (stable ids; format matches Edge generateId: p_ + 8 base36 chars)
NEW_PLAYER_IDS = {
    "charliebutler": "p_cm8k2n9q",
    "davedoyle": "p_dn3l4m0r",
    "johnbarry": "p_ep4m5n1s",
    "johndonnelly": "p_fq5n6o2t",
    "johnkelly": "p_gr6o7p3u",
    "leedoyle": "p_hs7p8q4v",
    "michaelconnolly": "p_it8q9r5w",
    "noelbrady": "p_ju9r0s6x",
    "paudgeneary": "p_kv0s1t7y",
    "seanduggan": "p_lw1t2u8z",
    "seanward": "p_mx2u3v9a",
}


def parse_array(cell: str) -> list[int]:
    return [int(x) for x in json.loads(cell)]


def sql_array(nums: list[int]) -> str:
    return "ARRAY[" + ",".join(str(n) for n in nums) + "]::integer[]"


def esc_ts(s: str) -> str:
    return "'" + s.strip().replace("'", "''") + "'::timestamptz"


def esc_str(s: str) -> str:
    return "'" + s.strip().replace("'", "''") + "'"


def resolve_player_id(norm: str) -> str | None:
    return PLAYER_NORM_ALIASES.get(norm) or PLAYER_BY_NORM.get(norm) or NEW_PLAYER_IDS.get(norm)


def main() -> int:
    # Per norm: name counts, and (played_on, handicap) for latest outing
    name_counts: dict[str, Counter[str]] = {n: Counter() for n in NEW_PLAYER_IDS}
    latest: dict[str, tuple[str, int]] = {}

    rows_data: list[dict] = []
    missing_outings: set[tuple[str, str]] = set()

    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            course_db = COURSE_CSV_TO_DB.get(row["course"].strip())
            if not course_db:
                print(f"Unknown course: {row['course']}", file=sys.stderr)
                return 1
            played = row["played_on"].strip()[:10]
            ok = (course_db, played)
            outing_id = OUTING_KEYS.get(ok)
            if not outing_id:
                missing_outings.add((row["course"], played))
                continue

            norm = row["player_norm"].strip().lower()
            pid = resolve_player_id(norm)
            if not pid:
                print(f"No player mapping for norm: {norm}", file=sys.stderr)
                return 1

            if norm in NEW_PLAYER_IDS:
                name_counts[norm][row["player_name"].strip()] += 1
                prev = latest.get(norm)
                if prev is None or played > prev[0]:
                    latest[norm] = (played, int(row["handicap"]))

            rows_data.append(
                {
                    "outing_id": outing_id,
                    "player_id": pid,
                    "row": row,
                }
            )

    if missing_outings:
        print("Missing outing keys:", file=sys.stderr)
        for x in sorted(missing_outings):
            print(f"  {x}", file=sys.stderr)
        return 1

    player_values: list[str] = []
    for norm, pid in sorted(NEW_PLAYER_IDS.items(), key=lambda x: x[1]):
        c = name_counts[norm]
        player_name = c.most_common(1)[0][0] if c else norm
        hc = latest.get(norm, ("", 0))[1]
        player_values.append(
            f"  ('botanic', '{pid}', {esc_str(player_name)}, {hc}, now(), now())"
        )

    score_values: list[str] = []
    for item in rows_data:
        row = item["row"]
        holes = parse_array(row["holes"])
        hp = parse_array(row["hole_points"])
        score_values.append(
            "  ('botanic', "
            f"'{item['outing_id']}', '{item['player_id']}', "
            f"{int(row['handicap'])}, "
            f"{sql_array(holes)}, {sql_array(hp)}, "
            f"{int(row['total_score'])}, {int(row['total_points'])}, "
            f"{int(row['out_score'])}, {int(row['out_points'])}, "
            f"{int(row['in_score'])}, {int(row['in_points'])}, "
            f"{int(row['back6_score'])}, {int(row['back6_points'])}, "
            f"{int(row['back3_score'])}, {int(row['back3_points'])}, "
            f"{esc_ts(row['score_timestamp'])}, "
            f"{esc_ts(row['created_at'])}, "
            f"{esc_ts(row['updated_at'])})"
        )

    OUT_SQL.parent.mkdir(parents=True, exist_ok=True)

    header = """-- Generated by scripts/generate_botanic_scores_sql.py
-- 1) Ensures missing players exist for society botanic.
-- 2) Upserts all scores from docs CSV (60 rows).
-- Safe to re-run.

"""

    players_sql = (
        "INSERT INTO thegolfapp.players (\n"
        "  society_id, player_id, player_name, handicap, created_at, updated_at\n"
        ") VALUES\n"
        + ",\n".join(player_values)
        + "\nON CONFLICT (society_id, player_id) DO UPDATE SET\n"
        "  player_name = EXCLUDED.player_name,\n"
        "  handicap = EXCLUDED.handicap,\n"
        "  updated_at = EXCLUDED.updated_at;\n\n"
    )

    scores_sql = (
        "INSERT INTO thegolfapp.scores (\n"
        "  society_id, outing_id, player_id, handicap,\n"
        "  holes, hole_points, total_score, total_points,\n"
        "  out_score, out_points, in_score, in_points,\n"
        "  back6_score, back6_points, back3_score, back3_points,\n"
        "  score_timestamp, created_at, updated_at\n"
        ") VALUES\n"
        + ",\n".join(score_values)
        + "\nON CONFLICT (society_id, outing_id, player_id) DO UPDATE SET\n"
        "  handicap = EXCLUDED.handicap,\n"
        "  holes = EXCLUDED.holes,\n"
        "  hole_points = EXCLUDED.hole_points,\n"
        "  total_score = EXCLUDED.total_score,\n"
        "  total_points = EXCLUDED.total_points,\n"
        "  out_score = EXCLUDED.out_score,\n"
        "  out_points = EXCLUDED.out_points,\n"
        "  in_score = EXCLUDED.in_score,\n"
        "  in_points = EXCLUDED.in_points,\n"
        "  back6_score = EXCLUDED.back6_score,\n"
        "  back6_points = EXCLUDED.back6_points,\n"
        "  back3_score = EXCLUDED.back3_score,\n"
        "  back3_points = EXCLUDED.back3_points,\n"
        "  score_timestamp = EXCLUDED.score_timestamp,\n"
        "  updated_at = EXCLUDED.updated_at;\n"
    )

    OUT_SQL.write_text(header + players_sql + scores_sql, encoding="utf-8")
    print(f"Wrote {OUT_SQL} ({len(player_values)} players, {len(score_values)} scores)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
