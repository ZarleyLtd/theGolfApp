create schema if not exists thegolfapp;

create table if not exists thegolfapp.societies (
  society_id text primary key,
  society_name text not null,
  contact_person text not null default '',
  number_of_players integer not null default 0,
  number_of_outings integer not null default 0,
  status text not null default 'Active',
  created_date date,
  captains_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists thegolfapp.players (
  society_id text not null,
  player_id text not null,
  player_name text not null,
  handicap integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (society_id, player_id),
  constraint players_society_fk foreign key (society_id)
    references thegolfapp.societies (society_id) on delete cascade
);

create table if not exists thegolfapp.courses (
  course_name text primary key,
  par_indx text not null default '',
  course_url text not null default '',
  course_maploc text not null default '',
  club_name text not null default '',
  course_image text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists thegolfapp.outings (
  society_id text not null,
  outing_id text not null,
  outing_date date not null,
  outing_time text not null default '',
  course_name text not null,
  comps text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (society_id, outing_id),
  constraint outings_society_fk foreign key (society_id)
    references thegolfapp.societies (society_id) on delete cascade,
  constraint outings_course_fk foreign key (course_name)
    references thegolfapp.courses (course_name) on update cascade
);

create table if not exists thegolfapp.scores (
  society_id text not null,
  outing_id text not null,
  player_id text not null,
  handicap integer not null default 0,
  holes integer[] not null default '{}',
  hole_points integer[] not null default '{}',
  total_score integer not null default 0,
  total_points integer not null default 0,
  out_score integer not null default 0,
  out_points integer not null default 0,
  in_score integer not null default 0,
  in_points integer not null default 0,
  back6_score integer not null default 0,
  back6_points integer not null default 0,
  back3_score integer not null default 0,
  back3_points integer not null default 0,
  score_timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (society_id, outing_id, player_id),
  constraint scores_outing_fk foreign key (society_id, outing_id)
    references thegolfapp.outings (society_id, outing_id) on delete cascade,
  constraint scores_player_fk foreign key (society_id, player_id)
    references thegolfapp.players (society_id, player_id) on delete cascade
);

create table if not exists thegolfapp.teams (
  society_id text not null,
  outing_id text not null,
  team_id text not null,
  team_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (society_id, outing_id, team_id),
  constraint teams_outing_fk foreign key (society_id, outing_id)
    references thegolfapp.outings (society_id, outing_id) on delete cascade
);

create table if not exists thegolfapp.team_members (
  society_id text not null,
  outing_id text not null,
  team_id text not null,
  player_id text not null,
  created_at timestamptz not null default now(),
  primary key (society_id, outing_id, team_id, player_id),
  constraint team_members_team_fk foreign key (society_id, outing_id, team_id)
    references thegolfapp.teams (society_id, outing_id, team_id) on delete cascade,
  constraint team_members_player_fk foreign key (society_id, player_id)
    references thegolfapp.players (society_id, player_id) on delete cascade
);

create index if not exists idx_players_society on thegolfapp.players (society_id);
create index if not exists idx_outings_society_date on thegolfapp.outings (society_id, outing_date);
create index if not exists idx_scores_society_outing on thegolfapp.scores (society_id, outing_id);
create index if not exists idx_scores_society_timestamp on thegolfapp.scores (society_id, score_timestamp desc);
create index if not exists idx_teams_society_outing on thegolfapp.teams (society_id, outing_id);
create index if not exists idx_team_members_society_player on thegolfapp.team_members (society_id, player_id);

alter table thegolfapp.societies enable row level security;
alter table thegolfapp.players enable row level security;
alter table thegolfapp.courses enable row level security;
alter table thegolfapp.outings enable row level security;
alter table thegolfapp.scores enable row level security;
alter table thegolfapp.teams enable row level security;
alter table thegolfapp.team_members enable row level security;
