import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth/guard";
import { setAuthCookies, clientIp } from "@/lib/auth/cookies";
import { apiError, apiOk } from "@/lib/auth/http";

export async function GET(req: NextRequest) {
  const access = req.cookies.get("blaze_access")?.value;
  const refresh = req.cookies.get("blaze_refresh")?.value;

  const result = await resolveUser(access, refresh, clientIp(req), req.headers.get("user-agent"));

  if (!result.user) {
    return apiError(401, "Not authenticated", "UNAUTHENTICATED");
  }

  let res: NextResponse = apiOk({ user: result.user });
  // If the refresh token rotated the session, rotate the cookies too.
  if (result.access && result.refresh) {
    res = setAuthCookies(res, result.access, result.refresh);
  }
  return res;
}