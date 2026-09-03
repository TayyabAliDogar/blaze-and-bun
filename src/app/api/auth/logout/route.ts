import { NextRequest } from "next/server";
import { revokeByRefresh } from "@/lib/auth/guard";
import { clearAuthCookies } from "@/lib/auth/cookies";
import { apiOk } from "@/lib/auth/http";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("blaze_refresh")?.value;
  await revokeByRefresh(refreshToken);
  const res = apiOk({});
  return clearAuthCookies(res);
}