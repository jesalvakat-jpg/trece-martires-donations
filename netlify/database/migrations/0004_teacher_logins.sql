-- Each teacher now has their own login (username and password).
-- The admin stays a single account. Any existing shared Teacher or Viewer login keeps working
-- until the admin changes or removes it.

ALTER TABLE accounts DROP CONSTRAINT accounts_pkey;
ALTER TABLE accounts ADD COLUMN id SERIAL PRIMARY KEY;
ALTER TABLE accounts ADD COLUMN full_name TEXT NOT NULL DEFAULT '';
ALTER TABLE accounts ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE UNIQUE INDEX accounts_single_admin ON accounts (role) WHERE role = 'admin';

-- Who recorded each donation or volunteer entry.
ALTER TABLE contributions ADD COLUMN recorded_by TEXT NOT NULL DEFAULT '';
