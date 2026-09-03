/**
 * Pre-dev environment check.
 * Prints clear guidance about optional/integration env vars so a missing
 * config never silently breaks a flow (e.g. "Continue with Google").
 *
 * Non-fatal: prints warnings only and always exits 0.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");

const readEnv = () => {
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
};

const env = readEnv();

const has = (key) => Boolean(env[key] && env[key].trim() !== "");

const googleEnabled = has("GOOGLE_CLIENT_ID") && has("GOOGLE_CLIENT_SECRET");

const divider = "-".repeat(64);

console.log("\n" + divider);
console.log("[env-check] Startup environment check");
console.log(divider);

if (googleEnabled) {
  console.log("[env-check] Google OAuth: configured ✓ (Continue with Google is live).");
} else {
  console.log(
    "[env-check] Google OAuth: NOT configured ✗ — 'Continue with Google' will show a " +
      "'not set up' notice and fall back to email/password.",
  );
  console.log(
    "    To enable: add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local, and",
    "    register http://localhost:3000/api/auth/google/callback as an authorised redirect.",
  );
}

if (!has("NEXT_PUBLIC_SITE_URL")) {
  console.log("[env-check] NEXT_PUBLIC_SITE_URL: not set (defaults to http://localhost:3000).");
}

console.log(divider + "\n");
process.exit(0);
