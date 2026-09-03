import { z } from "zod";

// Fail-fast server env validation. Imported only by Node/server code,
// NOT by edge middleware (which reads secrets directly).
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be >= 32 chars"),
  REFRESH_SECRET: z.string().min(32, "REFRESH_SECRET must be >= 32 chars"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

// Optional: a dedicated secret for anonymous guest tokens. When unset, guest
// tokens fall back to REFRESH_SECRET (see lib/auth/guest.ts). Providing it
// improves key separation.
const guestSecretSchema = z
  .object({ GUEST_SECRET: z.string().min(32).optional() })
  .passthrough();

const parsed = serverEnvSchema.safeParse(process.env);
const guestParsed = guestSecretSchema.safeParse(process.env);

const fail = () => {
  const issues = parsed.success
    ? []
    : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  if (!guestParsed.success) {
    issues.push(...guestParsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }
  if (issues.length) {
    throw new Error(`Invalid server environment:\n  ${issues.join("; ")}`);
  }
};
fail();