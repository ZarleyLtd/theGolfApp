-- Preserve eighths/quarters on handicap adjustment amounts and index audit columns

alter table thegolfapp.handicap_adjustments
  alter column amount type numeric(5, 3) using amount::numeric(5, 3),
  alter column index_before type numeric(5, 3) using index_before::numeric(5, 3),
  alter column index_after type numeric(5, 3) using index_after::numeric(5, 3);

comment on column thegolfapp.handicap_adjustments.amount is
  'Adjustment applied to handicap index (+/-); numeric(5,3) for quarter/eighth precision.';

comment on column thegolfapp.handicap_adjustments.index_before is
  'Handicap index before adjustment; numeric(5,3).';

comment on column thegolfapp.handicap_adjustments.index_after is
  'Handicap index after adjustment; numeric(5,3).';
