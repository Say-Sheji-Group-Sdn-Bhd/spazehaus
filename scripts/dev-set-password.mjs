#!/usr/bin/env node
/*
 * dev-set-password.mjs — set (or create) a password for a staff account so the
 * local "DEVELOPMENT SIGN-IN" box on /login works without the magic-link email.
 *
 * Usage (run from code-web-app/):
 *   node scripts/dev-set-password.mjs you@email.com 'YourPassword'
 *
 * Requires in .env (or .env.local):
 *   VITE_SUPABASE_URL          (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY  ← admin key, NEVER commit / ship to the client
 *
 * The email should already exist in the `staff` table (the auth trigger links
 * the new auth user to that staff row by email). Dev/local only.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ── Load .env / .env.local into process.env (no dotenv dependency) ──────────
for (const file of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim().replace(/^["']|["']$/g, "");
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch { /* file may not exist — fine */ }
}

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error("Usage: node scripts/dev-set-password.mjs <email> <password>");
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing env. Need VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const normEmail = email.trim().toLowerCase();

// Find an existing auth user by email (paginate; listUsers has no email filter).
async function findUserByEmail(target) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) break; // last page
  }
  return null;
}

try {
  const existing = await findUserByEmail(normEmail);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, { password });
    if (error) throw error;
    console.log(`✓ Password updated for existing user ${normEmail} (id ${existing.id})`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: normEmail,
      password,
      email_confirm: true, // skip the confirmation email; the trigger links to staff
    });
    if (error) throw error;
    console.log(`✓ Created user ${normEmail} (id ${data.user.id}) with a password`);
  }
  console.log("  Now use it in the DEVELOPMENT SIGN-IN box on /login.");
} catch (err) {
  console.error("✗ Failed:", err.message || err);
  process.exit(1);
}
