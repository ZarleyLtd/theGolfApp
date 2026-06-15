-- Reassign historical handicap imports that were stored as season 2022 to 2021.

update thegolfapp.handicap_adjustments
set
  season_year = 2021,
  reason = replace(reason, 'Historical import 2022', 'Historical import 2021')
where source = 'historical'
  and season_year = 2022
  and reason like 'Historical import 2022%';

-- Re-link outings to 2021 dates where course name matches the outing label.
update thegolfapp.handicap_adjustments ha
set
  outing_id = o.outing_id,
  effective_date = o.outing_date::date
from thegolfapp.outings o
where ha.source = 'historical'
  and ha.season_year = 2021
  and ha.reason like 'Historical import 2021%'
  and o.society_id = ha.society_id
  and extract(year from o.outing_date) = 2021
  and lower(trim(o.course_name)) = lower(
    trim(regexp_replace(ha.outing_label, '^R\d+\s*[-–—]\s*', '', 'i'))
  );
