-- Aligns each record with the DepEd School Partnerships Data Sheet (PDS)
-- and stores the report header details.

ALTER TABLE contributions ADD COLUMN IF NOT EXISTS partner_contact       TEXT NOT NULL DEFAULT '';
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS contribution_type     TEXT NOT NULL DEFAULT '';   -- PDS "Contribution Type" (things)
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS specific_contribution TEXT NOT NULL DEFAULT '';   -- PDS "Specific Contribution Type"
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS beneficiary_learners  INTEGER CHECK (beneficiary_learners IS NULL OR beneficiary_learners >= 0);
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS beneficiary_personnel INTEGER CHECK (beneficiary_personnel IS NULL OR beneficiary_personnel >= 0);
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS agreement_form        TEXT NOT NULL DEFAULT '';
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS project_status        TEXT NOT NULL DEFAULT 'Completed';
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS initiated_by          TEXT NOT NULL DEFAULT 'School';

-- Report header (Fiscal Year and Month are chosen when downloading).
INSERT INTO app_settings (key, value) VALUES ('report_info', '{
  "region": "Region_V_Bicol_Region",
  "division": "Sorsogon",
  "schoolName": "Trece Martires Elementary School",
  "schoolId": "114098",
  "offering": "ES",
  "preparedBy": "Danah Jane N. Holdiem",
  "preparedPosition": "Administrative Officer II",
  "preparedContact": "",
  "approvedBy": "Michael G. Domanais",
  "approvedPosition": "School Principal I",
  "approvedContact": "",
  "learners": 297,
  "personnel": 16,
  "hourValue": 0
}') ON CONFLICT (key) DO NOTHING;
