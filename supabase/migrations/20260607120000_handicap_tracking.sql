 -- Handicap index, per-society rules, and adjustment audit log

alter table thegolfapp.players
  add column if not exists handicap_index numeric(5, 3);

update thegolfapp.players
  set handicap_index = handicap
  where handicap_index is null;

alter table thegolfapp.players
  alter column handicap_index set not null,
  alter column handicap_index set default 0;

comment on column thegolfapp.players.handicap_index is
  'Decimal handicap index; players.handicap is playing handicap = round(handicap_index).';

create table if not exists thegolfapp.handicap_rules (
  society_id text primary key,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint handicap_rules_society_fk foreign key (society_id)
    references thegolfapp.societies (society_id) on delete cascade
);

comment on table thegolfapp.handicap_rules is
  'Per-society automatic handicap adjustment rules (JSON config).';

create table if not exists thegolfapp.handicap_adjustments (
  society_id text not null,
  adjustment_id text not null,
  player_id text not null,
  effective_date date,
  season_year integer,
  source text not null,
  outing_id text,
  outing_label text not null default '',
  position integer,
  amount numeric(5, 3) not null,
  index_before numeric(5, 3) not null,
  index_after numeric(5, 3) not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  primary key (society_id, adjustment_id),
  constraint handicap_adjustments_player_fk foreign key (society_id, player_id)
    references thegolfapp.players (society_id, player_id) on delete cascade,
  constraint handicap_adjustments_outing_fk foreign key (society_id, outing_id)
    references thegolfapp.outings (society_id, outing_id) on delete set null,
  constraint handicap_adjustments_source_check check (
    source in ('automatic', 'manual', 'historical')
  )
);

create index if not exists idx_handicap_adj_player_date
  on thegolfapp.handicap_adjustments (society_id, player_id, effective_date);

create index if not exists idx_handicap_adj_player_year
  on thegolfapp.handicap_adjustments (society_id, player_id, season_year);

create index if not exists idx_handicap_adj_outing
  on thegolfapp.handicap_adjustments (society_id, outing_id);

create unique index if not exists idx_handicap_adj_auto_player_outing
  on thegolfapp.handicap_adjustments (society_id, outing_id, player_id)
  where source = 'automatic' and outing_id is not null;

comment on column thegolfapp.handicap_adjustments.season_year is
  'Calendar year for historical imports; optional for automatic/manual.';

alter table thegolfapp.handicap_rules enable row level security;
alter table thegolfapp.handicap_adjustments enable row level security;

-- Default Botanic rules (third place bands all zero)
insert into thegolfapp.handicap_rules (society_id, enabled, config)
values (
  'botanic',
  true,
  '{
    "enabled": true,
    "outsideTop10": 1,
    "maxIndex": 40,
    "positionGroups": {
      "winner": [
        {"minIndex": 30, "maxIndex": null, "amount": -4},
        {"minIndex": 18, "maxIndex": 30, "amount": -2},
        {"minIndex": null, "maxIndex": 18, "amount": -1}
      ],
      "runnerUp": [
        {"minIndex": 30, "maxIndex": null, "amount": -2},
        {"minIndex": 18, "maxIndex": 30, "amount": -1},
        {"minIndex": null, "maxIndex": 18, "amount": -0.5}
      ],
      "thirdPlace": [
        {"minIndex": 30, "maxIndex": null, "amount": 0},
        {"minIndex": 18, "maxIndex": 30, "amount": 0},
        {"minIndex": null, "maxIndex": 18, "amount": 0}
      ]
    }
  }'::jsonb
)
on conflict (society_id) do nothing;
