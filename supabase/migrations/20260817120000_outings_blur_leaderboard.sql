-- Captain can hide outing leaderboard results until ready to reveal.
alter table thegolfapp.outings
  add column if not exists blur_leaderboard boolean not null default false;

comment on column thegolfapp.outings.blur_leaderboard is
  'When true, outing leaderboard shows entries but names/scores are blurred; excluded from Overall Leaders.';
