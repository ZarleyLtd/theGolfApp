-- Player visitor flag (society guest / non-member); default false for existing rows.
alter table thegolfapp.players
  add column if not exists visitor boolean not null default false;

comment on column thegolfapp.players.visitor is 'True when the player is a visitor (e.g. guest); default false for regular members.';
