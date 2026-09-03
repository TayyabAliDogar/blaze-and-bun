import { jwtVerify } from "jose";
import type { AccessPayload } from "./jwt";

const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET!);

/** Edge-runtime-safe verification (no Prisma / Node deps). */
export async function verifyAccessTokenEdge(token: string | undefined): Promise<AccessPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.type !== "access" || !payload.sub) return null;
    return payload as unknown as AccessPayload;
  } catch {
    return null;
  }
}