// Trece Martires Donations & Volunteers Record — server API (Netlify Function)
// Every request to /api/* lands here. Data lives in Netlify Database (Postgres).

import { getDatabase } from "@netlify/database";
import crypto from "node:crypto";

export const config = { path: "/api/*" };

const COOKIE = "tm_don_session";
const SESSION_HOURS = 12;
const MAX_LOGIN_FAILS = 10;          // per IP per 15 minutes
const ROLES = ["admin", "teacher", "viewer"];
const ROLE_NAME = { admin: "Admin", teacher: "Teacher", viewer: "Viewer" };
const KINDS = ["money", "hours", "items"];
const CONDITIONS = ["", "good", "not_good"];

let _db;
function db() {
  if (!_db) {
    _db = process.env.TEST_DATABASE_URL
      ? getDatabase({ connectionString: process.env.TEST_DATABASE_URL })
      : getDatabase();
  }
  return _db;
}
const q = (text, params = []) => db().sql.unsafe(text, params);

async function tx(fn) {
  const client = await db().pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn((text, params = []) => client.query(text, params).then((r) => r.rows));
    await client.query("COMMIT");
    return out;
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch (_) { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}

// ---------- responses ----------
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
const fail = (status, message) => { throw new HttpError(status, message); };

// ---------- passwords & sessions ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}
function checkPassword(password, stored) {
  const [kind, saltHex, hashHex] = String(stored || "").split("$");
  if (kind !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const got = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, got);
}
let _secret;
async function secret() {
  if (_secret) return _secret;
  await q("INSERT INTO app_settings (key, value) VALUES ('session_secret', $1) ON CONFLICT (key) DO NOTHING",
    [crypto.randomBytes(32).toString("hex")]);
  const rows = await q("SELECT value FROM app_settings WHERE key = 'session_secret'");
  _secret = rows[0].value;
  return _secret;
}
const b64u = (buf) => Buffer.from(buf).toString("base64url");
let _dummyHash;
const dummyHash = () => (_dummyHash ||= hashPassword(crypto.randomBytes(12).toString("hex")));
async function signSession(id, version) {
  const payload = b64u(JSON.stringify({ a: id, v: version, e: Date.now() + SESSION_HOURS * 3600e3 }));
  const sig = b64u(crypto.createHmac("sha256", await secret()).update(payload).digest());
  return `${payload}.${sig}`;
}
async function readSession(req) {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [payload, sig] = m[1].split(".");
  if (!payload || !sig) return null;
  const expect = b64u(crypto.createHmac("sha256", await secret()).update(payload).digest());
  if (expect.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(sig))) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { return null; }
  if (!data || !Number.isInteger(data.a) || !(data.e > Date.now())) return null;
  const rows = await q("SELECT id, role, username, full_name, version FROM accounts WHERE id = $1", [data.a]);
  if (!rows.length || Number(rows[0].version) !== Number(data.v)) return null;
  return publicUser(rows[0]);
}
const publicUser = (a) => ({ id: Number(a.id), role: a.role, username: a.username, name: a.full_name || a.username });
const sessionCookie = (token) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict`;
const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

// ---------- accounts ----------
const ACCOUNT_COLS = `id, role, username, full_name AS name, (extract(epoch from created_at) * 1000)::float8 AS "createdAt"`;
const listAccounts = () => q(`SELECT ${ACCOUNT_COLS} FROM accounts
  ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'teacher' THEN 1 ELSE 2 END, lower(COALESCE(NULLIF(full_name, ''), username))`);
function cleanUsername(v) {
  const u = String(v == null ? "" : v).trim();
  if (!u) fail(400, "Enter a username.");
  if (/\s/.test(u)) fail(400, "Usernames can't have spaces. Use a dot instead, for example leny.giba");
  if (u.length > 60) fail(400, "That username is too long.");
  return u;
}
async function usernameTaken(username, exceptId) {
  const rows = await q("SELECT id FROM accounts WHERE lower(username) = lower($1) AND id <> $2", [username, exceptId || 0]);
  return rows.length > 0;
}

// ---------- validation ----------
const str = (v, max = 200) => String(v == null ? "" : v).trim().slice(0, max);
const int = (v, min = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min ? n : null;
};
const dateStr = (v) => {
  const s = str(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) ? s : null;
};
function num(v, { max = 1e9, decimals = 2 } = {}) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(/[,\s₱]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > max) return NaN;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
function optInt(v) {
  if (v === "" || v == null) return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 0 || n > 1e7) fail(400, "Beneficiary counts must be whole numbers, or left blank.");
  return n;
}
const REPORT_KEYS = ["region", "division", "schoolName", "schoolId", "offering", "preparedBy", "preparedPosition", "preparedContact",
  "approvedBy", "approvedPosition", "approvedContact", "learners", "personnel", "hourValue"];
async function getReportInfo() {
  const rows = await q("SELECT value FROM app_settings WHERE key = 'report_info'");
  try { return rows.length ? JSON.parse(rows[0].value) : {}; } catch { return {}; }
}

function cleanContribution(b) {
  const kind = KINDS.includes(b.kind) ? b.kind : null;
  if (!kind) fail(400, "Choose Money, Volunteer time, or Supplies and materials.");
  const date = dateStr(b.date);
  if (!date) fail(400, "Enter the date.");
  const name = str(b.name, 120);
  if (!name) fail(400, "Enter the name of the volunteer or donor.");
  const out = {
    date_given: date, name, contributor_type: str(b.type, 60), kind,
    amount: 0, hours: 0, item_desc: "", item_qty: 0, item_unit: "", est_value: null,
    activity: str(b.activity, 120), received_by: str(b.receivedBy, 120), remarks: str(b.remarks, 500),
    grade_section: str(b.gradeSection, 120),
    partner_contact: str(b.partnerContact, 160),
    contribution_type: "", specific_contribution: str(b.specificContribution, 160),
    beneficiary_learners: optInt(b.beneficiaryLearners), beneficiary_personnel: optInt(b.beneficiaryPersonnel),
    agreement_form: str(b.agreementForm, 80),
    project_status: str(b.projectStatus, 60) || "Completed",
    initiated_by: str(b.initiatedBy, 60) || "School"
  };
  if (kind === "money") {
    const a = num(b.amount);
    if (!(a > 0)) fail(400, "Enter the amount of money in pesos.");
    out.amount = a;
  } else if (kind === "hours") {
    const h = num(b.hours, { max: 1000 });
    if (!(h > 0)) fail(400, "Enter the number of hours.");
    out.hours = h;
    const hv = num(b.estValue);
    if (Number.isNaN(hv)) fail(400, "Enter the value as a number, or leave it blank.");
    out.est_value = hv;
  } else {
    out.item_desc = str(b.itemDesc, 200);
    if (!out.item_desc) fail(400, "Describe the supplies or materials donated.");
    const qn = num(b.itemQty, { max: 1e7, decimals: 0 });
    if (!(qn > 0)) fail(400, "Enter how many were donated.");
    out.item_qty = qn;
    out.item_unit = str(b.itemUnit, 30) || "pcs";
    out.contribution_type = str(b.contributionType, 160);
    const ev = num(b.estValue);
    if (Number.isNaN(ev)) fail(400, "Enter the estimated value as a number, or leave it blank.");
    out.est_value = ev;
  }
  return out;
}

// ---------- row mapping ----------
const CONTRIB_COLS = `id, date_given::text AS "date", name, contributor_type AS "type", kind,
  amount::float8 AS amount, hours::float8 AS hours, item_desc AS "itemDesc", item_qty AS "itemQty",
  item_unit AS "itemUnit", est_value::float8 AS "estValue", activity, received_by AS "receivedBy", grade_section AS "gradeSection",
  remarks, recorded_as AS "recordedAs", partner_contact AS "partnerContact", contribution_type AS "contributionType",
  specific_contribution AS "specificContribution", beneficiary_learners AS "beneficiaryLearners",
  beneficiary_personnel AS "beneficiaryPersonnel", agreement_form AS "agreementForm", project_status AS "projectStatus",
  initiated_by AS "initiatedBy", recorded_by AS "recordedBy",
  (extract(epoch from created_at) * 1000)::float8 AS "createdAt"`;

async function loadAll() {
  const [contributions, staff, reportInfo] = await Promise.all([
    q(`SELECT ${CONTRIB_COLS} FROM contributions ORDER BY date_given DESC, created_at DESC`),
    q(`SELECT name, role, grp AS "group" FROM staff ORDER BY position, id`),
    getReportInfo()
  ]);
  return { contributions, staff, reportInfo };
}

// ---------- handler ----------
export default async (req, context) => {
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);
    const method = req.method.toUpperCase();

    // Block cross-site form posts: every change must come from our own page.
    if (method !== "GET" && req.headers.get("x-requested-with") !== "donations") fail(403, "Request blocked.");
    const body = method === "GET" ? {} : await req.json().catch(() => ({}));

    // ----- public routes -----
    if (method === "GET" && path === "me") {
      const counts = await q("SELECT role, count(*)::int AS n FROM accounts GROUP BY role");
      const has = (r) => counts.some((c) => c.role === r && c.n > 0);
      const user = await readSession(req);
      return json({
        accounts: { admin: has("admin"), teacher: has("teacher"), viewer: has("viewer") },
        setupCodeConfigured: !!process.env.SETUP_CODE,
        user
      });
    }

    if (method === "POST" && path === "setup") {
      const admins = await q("SELECT 1 FROM accounts WHERE role = 'admin'");
      if (admins.length) fail(409, "The admin account already exists. Log in instead.");
      if (!process.env.SETUP_CODE) fail(400, "Add a SETUP_CODE environment variable in Netlify first, then redeploy.");
      const code = str(body.setupCode, 200);
      const a = Buffer.from(code), b = Buffer.from(process.env.SETUP_CODE);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) fail(403, "The setup code is incorrect.");
      const username = cleanUsername(body.username);
      const password = String(body.password || "");
      if (password.length < 6) fail(400, "The password needs at least 6 characters.");
      const rows = await q("INSERT INTO accounts (role, username, pass_hash) VALUES ('admin', $1, $2) RETURNING id, role, username, full_name, version",
        [username, hashPassword(password)]);
      const token = await signSession(Number(rows[0].id), Number(rows[0].version));
      return json({ user: publicUser(rows[0]) }, 200, { "set-cookie": sessionCookie(token) });
    }

    if (method === "POST" && path === "login") {
      const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
      const fails = await q("SELECT count(*)::int AS n FROM login_fails WHERE ip = $1 AND at > now() - interval '15 minutes'", [ip]);
      if (fails[0].n >= MAX_LOGIN_FAILS) fail(429, "Too many tries. Wait 15 minutes and try again.");
      const role = ROLES.includes(body.role) ? body.role : "viewer";
      const username = str(body.username, 80);
      const password = String(body.password || "");
      if (!username || !password) fail(400, "Enter your username and password.");
      const rows = await q("SELECT id, role, username, full_name, pass_hash, version FROM accounts WHERE role = $1 AND lower(username) = lower($2)",
        [role, username]);
      const acct = rows[0];
      // Check a password even when the username is unknown, so both cases take the same time.
      const ok = checkPassword(password, acct ? acct.pass_hash : dummyHash()) && !!acct;
      if (!ok) {
        await q("INSERT INTO login_fails (ip) VALUES ($1)", [ip]);
        await q("DELETE FROM login_fails WHERE at < now() - interval '1 day'");
        const any = await q("SELECT 1 FROM accounts WHERE role = $1 LIMIT 1", [role]);
        if (!any.length) fail(401, `There's no ${ROLE_NAME[role]} account yet. Ask the admin to create it.`);
        fail(401, `Incorrect username or password for ${ROLE_NAME[role]}.`);
      }
      await q("DELETE FROM login_fails WHERE ip = $1", [ip]);
      const token = await signSession(Number(acct.id), Number(acct.version));
      return json({ user: publicUser(acct) }, 200, { "set-cookie": sessionCookie(token) });
    }

    if (method === "POST" && path === "logout") {
      return json({ ok: true }, 200, { "set-cookie": clearCookie() });
    }

    // ----- logged-in routes -----
    const user = await readSession(req);
    if (!user) fail(401, "Your session has ended. Please log in again.");

    if (method === "GET" && path === "data") return json(await loadAll());

    // Donations & volunteers: Admin and Teacher may record and correct; only Admin may delete.
    if (parts[0] === "contributions") {
      if (user.role === "viewer") fail(403, "Viewers can only look at records. Log in as Teacher or Admin to record donations.");
      if (method === "POST" && parts.length === 1) {
        const c = { ...cleanContribution(body), recorded_as: user.role, recorded_by: str(user.name, 120) };
        const cols = Object.keys(c);
        const rows = await q(
          `INSERT INTO contributions (${cols.join(", ")}) VALUES (${cols.map((_, k) => "$" + (k + 1)).join(", ")}) RETURNING ${CONTRIB_COLS}`,
          cols.map((k) => c[k]));
        return json({ contribution: rows[0] }, 201);
      }
      const id = str(parts[1], 64);
      if (!id) fail(404, "Not found.");
      if (method === "PUT") {
        const c = cleanContribution(body);
        const cols = Object.keys(c);
        const rows = await q(
          `UPDATE contributions SET ${cols.map((k, n) => `${k} = $${n + 2}`).join(", ")}, updated_at = now() WHERE id = $1 RETURNING ${CONTRIB_COLS}`,
          [id, ...cols.map((k) => c[k])]);
        if (!rows.length) fail(404, "That record no longer exists.");
        return json({ contribution: rows[0] });
      }
      if (method === "DELETE") {
        if (user.role !== "admin") fail(403, "Only the admin can delete records. Ask the admin to remove it.");
        await q("DELETE FROM contributions WHERE id = $1", [id]);
        return json({ ok: true });
      }
      fail(404, "Not found.");
    }

    // Everything below: admin only.
    if (user.role !== "admin") fail(403, "Only the admin can make changes.");

    // Report header details
    if (method === "PUT" && path === "report-info") {
      const cur = await getReportInfo();
      const next = { ...cur };
      for (const k of REPORT_KEYS) {
        if (!(k in body)) continue;
        if (["learners", "personnel"].includes(k)) next[k] = optInt(body[k]) ?? 0;
        else if (k === "hourValue") { const v = num(body[k]); if (Number.isNaN(v)) fail(400, "The value of one volunteer hour must be a number."); next[k] = v || 0; }
        else next[k] = str(body[k], 160);
      }
      await q(`INSERT INTO app_settings (key, value) VALUES ('report_info', $1)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(next)]);
      return json({ reportInfo: next });
    }

    // Accounts: one login per teacher, plus viewers. The admin is a single account.
    if (parts[0] === "accounts") {
      if (method === "GET" && parts.length === 1) return json({ accounts: await listAccounts() });

      if (method === "POST" && parts.length === 1) {
        const role = ["teacher", "viewer"].includes(body.role) ? body.role : null;
        if (!role) fail(400, "Choose Teacher or Viewer.");
        const name = str(body.name, 120);
        if (role === "teacher" && !name) fail(400, "Choose or type the teacher's name.");
        const username = cleanUsername(body.username);
        const password = String(body.password || "");
        if (password.length < 6) fail(400, "The password needs at least 6 characters.");
        if (await usernameTaken(username)) fail(400, "That username is already used. Try another one, for example by adding a number.");
        if (role === "teacher" && (await q("SELECT 1 FROM accounts WHERE role = 'teacher' AND lower(full_name) = lower($1)", [name])).length)
          fail(400, `${name} already has a login. Use Change on their row to reset the password.`);
        const rows = await q(`INSERT INTO accounts (role, username, pass_hash, full_name) VALUES ($1, $2, $3, $4) RETURNING ${ACCOUNT_COLS}`,
          [role, username, hashPassword(password), name]);
        return json({ account: rows[0], accounts: await listAccounts() }, 201);
      }

      const id = int(parts[1], 1);
      if (!id || parts.length !== 2) fail(404, "Not found.");
      const cur = (await q("SELECT id, role, username, full_name, version FROM accounts WHERE id = $1", [id]))[0];
      if (!cur) fail(404, "That login no longer exists.");

      if (method === "PUT") {
        const name = "name" in body ? str(body.name, 120) : cur.full_name;
        if (cur.role === "teacher" && !name) fail(400, "Choose or type the teacher's name.");
        const username = "username" in body ? cleanUsername(body.username) : cur.username;
        const password = String(body.password || "");
        if (password && password.length < 6) fail(400, "The new password needs at least 6 characters.");
        if (await usernameTaken(username, id)) fail(400, "That username is already used. Try another one, for example by adding a number.");
        if (cur.role === "teacher" && name.toLowerCase() !== String(cur.full_name).toLowerCase()
          && (await q("SELECT 1 FROM accounts WHERE role = 'teacher' AND lower(full_name) = lower($1) AND id <> $2", [name, id])).length)
          fail(400, `${name} already has a login.`);
        // A new username or password logs out anyone still using the old details.
        const changed = password || username !== cur.username;
        const version = changed ? Number(cur.version) + 1 : Number(cur.version);
        const rows = password
          ? await q(`UPDATE accounts SET full_name = $2, username = $3, pass_hash = $4, version = $5, updated_at = now() WHERE id = $1 RETURNING ${ACCOUNT_COLS}, version, full_name`,
              [id, name, username, hashPassword(password), version])
          : await q(`UPDATE accounts SET full_name = $2, username = $3, version = $4, updated_at = now() WHERE id = $1 RETURNING ${ACCOUNT_COLS}, version, full_name`,
              [id, name, username, version]);
        const out = { account: { id: rows[0].id, role: rows[0].role, username: rows[0].username, name: rows[0].name, createdAt: rows[0].createdAt },
          accounts: await listAccounts() };
        if (id === user.id) {
          const me = publicUser(rows[0]);
          const headers = changed ? { "set-cookie": sessionCookie(await signSession(id, version)) } : {};
          return json({ ...out, user: me }, 200, headers);
        }
        return json(out);
      }

      if (method === "DELETE") {
        if (cur.role === "admin") fail(400, "The admin login can't be removed. You can change its username or password instead.");
        await q("DELETE FROM accounts WHERE id = $1", [id]);
        return json({ ok: true, accounts: await listAccounts() });
      }
      fail(404, "Not found.");
    }

    fail(404, "Not found.");
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Something went wrong on the server. Try again in a moment." }, 500);
  }
};
