# Trece Martires Donations & Partnerships Record

A monthly record of the **money, volunteer time, and things** given to **Trece Martires Elementary School, Casiguran, Sorsogon**. This is a separate website from the Supplies Inventory.

- **Monthly Record:** move month by month (‹ ›) to see who helped and the totals, compared with the month before
- **Grade and section** on every record, with a filter by class and a **By grade and section** summary
- **Year Summary:** totals per school year (June to May) or calendar year, with charts and a month-by-month table
- **Volunteers & Donors:** every person or group who helped, with their total hours, money and things
- **Consolidation report (Excel):** a monthly or whole-year School Partnerships Data Sheet (PDS), consolidated per partner group, in the same layout as the DepEd sheet, plus a Details sheet listing every record
- **Print report** (monthly or yearly) and **Export CSV** for Excel
- Records follow the PDS: partner type, contribution type and specific type use the official PDS lists
- Large text, big buttons and a **Text size** control for older users
- Logins (username + password, checked on the server):
  - **Admin:** one account. Everything, including deleting records and managing logins in **Teachers & logins**
  - **Teacher:** each teacher has their own username and password. Records and corrects donations and volunteer hours; every new record keeps the name of the teacher who recorded it
  - **Viewer:** looks, prints and exports only (for example, the principal). You can add as many as you need
- Data is stored in **Netlify Database** (PostgreSQL / SQL)

## What's in this folder

| Path | What it is |
|---|---|
| `public/` | The website |
| `netlify/functions/api.mjs` | The server: login, roles, and all reads and writes to the database |
| `netlify/database/migrations/0001_create_donations.sql` | The SQL tables and the list of 16 teachers and staff |
| `netlify/database/migrations/0002_grade_section.sql` | Adds the grade and section to each record |
| `netlify/database/migrations/0003_partnerships_report.sql` | Adds the PDS fields and the report details (school ID, prepared/approved by, beneficiaries) |
| `netlify/database/migrations/0004_teacher_logins.sql` | One login per teacher, and the name of who recorded each entry |
| `netlify.toml`, `package.json`, `package-lock.json` | Netlify settings |

## Put it online

This is a **new, separate** Netlify project. Don't upload it into the inventory repository.

1. **GitHub:** create a new **Private** repository named `trece-martires-donations`. Upload everything inside this folder, keeping the `public` and `netlify` folders.
   - If GitHub won't take the folders, upload the loose files first. Then use **Add file → Create new file** with names like `public/keep.txt`, `netlify/functions/keep.txt` and `netlify/database/migrations/keep.txt`, and upload each file into its folder.
2. **Netlify:** go to **Add new project → Import an existing project → GitHub** and pick `trece-martires-donations`.
   - Project name: for example `tmes-donations`. The address becomes `tmes-donations.netlify.app`.
   - Under **Environment variables**, add `SETUP_CODE` with a secret phrase only you know. Use **All scopes** and **Same value for all deploy contexts**.
   - Click **Deploy**.
3. **Open the site:** enter the setup code and create the **Admin** username and password.
4. **Teachers & logins:** click **Teachers & logins**, then **+ Add a teacher login**. Choose the teacher from the list, check the suggested username (for example `leny.giba`), type a password and press **Create teacher login**. Repeat for each teacher, and add a **Viewer** login if needed. Tell each teacher their username and password in person.
5. **Report details:** click **Consolidation report (Excel)**, then type the contact numbers and the value of one volunteer hour, and press **Save these details**. The school details are already filled in from the PDS.

## Good to know
- Passwords are stored only in scrambled (hashed) form, and logins are checked on the server.
- After 10 wrong passwords within 15 minutes, logins from that connection pause for 15 minutes.
- To reset a forgotten password, open **Teachers & logins**, press **Change** on the teacher's row and type a new password. That teacher is logged out everywhere until they use the new one.
- **Remove this login** (press twice) takes away a teacher's access, for example after a transfer. Their past records stay.
- Already using this site with one shared Teacher login? It keeps working after this update. Add each teacher's own login, then remove the shared one.
- Only names, the type of contributor, the grade and section, and what was given are stored. No contact numbers, addresses or IDs.
- Use **Export CSV** every month as a simple backup.
