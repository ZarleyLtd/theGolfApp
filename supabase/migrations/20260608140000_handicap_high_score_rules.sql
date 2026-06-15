-- Add high-score rules (4a / 4b) to existing society handicap rule configs.

update thegolfapp.handicap_rules
set config = config || '{
  "highScoreRules": {
    "rule4a": {
      "enabled": true,
      "minPoints": 40,
      "minLeadOverSecond": 5,
      "minCompetitors": 12,
      "amount": -1
    },
    "rule4b": {
      "enabled": true,
      "minPoints": 40,
      "amount": -0.5
    }
  }
}'::jsonb,
updated_at = now()
where not (config ? 'highScoreRules');
