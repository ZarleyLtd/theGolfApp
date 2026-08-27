-- Global (non society-scoped) system settings, keyed by setting name with a JSONB payload.
-- First consumer is 'ai_models', holding the admin-defined Gemini model priority chain.

create table if not exists thegolfapp.app_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table thegolfapp.app_settings is
  'Global system settings managed from admin/settings.html. One row per setting key.';

comment on column thegolfapp.app_settings.setting_value is
  'JSONB payload. For setting_key = ''ai_models'': { "priority": ["model-id", ...], "showAllModels": false }.';

alter table thegolfapp.app_settings enable row level security;
