import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessTokenEdge } from "@/lib/auth/jwt-edge";
import { ACCESS_COOKIE } from "@/lib/auth/constants";

// Route guards: most-restrictive path prefix → required roles.
const ROUTE_GUARDS: { roles: string[]; patterns: string[] }[] = [
  { roles: ["admin", "staff"], patterns: ["/admin"] },
  { roles: ["customer", "staff", "admin"], patterns: ["/account", "/orders"] },
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const guard = ROUTE_GUARDS.find((g) =>
    g.patterns.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );

  if (!guard) return NextResponse.next();

  const access = req.cookies.get(ACCESS_COOKIE)?.value;

  // Verify the JWT — no Prisma, no DB hit; pure signature check.
  // Payload is resolved async, so we must await inside the proxy function.
  return verifyAccessTokenEdge(access).then((payload) => {
    if (!payload) {
      // Send the user to the dedicated login page, remembering where they
      // wanted to go so we can redirect them back after signing in.
      const loginUrl = new URL("/login", req.nextUrl.origin);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!guard.roles.includes(payload.role)) {
      return NextResponse.redirect(new URL("/?auth=forbidden", req.nextUrl.origin));
    }
    return NextResponse.next();
  });
}

export const config = {
  matcher: ["/account/:path*", "/orders/:path*", "/admin/:path*"],
};
