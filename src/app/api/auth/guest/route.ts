import { setGuestCookie } from "@/lib/auth/cookies";
import { signGuestToken } from "@/lib/auth/guest";
import { apiOk } from "@/lib/auth/http";

export async function POST() {
  const token = await signGuestToken();
  const res = apiOk({ guest: true });
  return setGuestCookie(res, token);
}