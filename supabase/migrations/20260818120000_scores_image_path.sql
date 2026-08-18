-- Scorecard photos: metadata on scores + private Storage bucket.
-- image_path / image_mime already exist in some live DBs (BGS); IF NOT EXISTS keeps this idempotent.

alter table thegolfapp.scores
  add column if not exists image_path text;

alter table thegolfapp.scores
  add column if not exists image_mime text;

comment on column thegolfapp.scores.image_path is
  'Supabase Storage object path for the attached scorecard photo (nullable).';

comment on column thegolfapp.scores.image_mime is
  'MIME type of the attached scorecard photo (typically image/jpeg).';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'golf-scorecards',
  'golf-scorecards',
  false,
  2097152,
  array['image/jpeg', 'image/jpg']
)
on conflict (id) do nothing;
