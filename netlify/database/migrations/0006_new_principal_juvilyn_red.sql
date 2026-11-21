-- New principal: Juvilyn M. Red, Principal III (replaces Michael G. Domanais).
-- Past records he received keep his name.
UPDATE staff SET name = 'Juvilyn M. Red', role = 'Principal III'
  WHERE name IN ('Michael Domanais', 'Michael G. Domanais');

-- "Approved by" on the PDS consolidation report. Other report details stay as they are.
UPDATE app_settings
  SET value = (value::jsonb || '{"approvedBy": "Juvilyn M. Red", "approvedPosition": "Principal III"}'::jsonb)::text
  WHERE key = 'report_info';
