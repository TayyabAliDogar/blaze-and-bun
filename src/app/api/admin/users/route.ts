import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
import { apiError } from "@/lib/auth/http";
import { requireAdmin, writeAudit, clientIp } from "@/lib/admin/guard";
import { hashPassword } from "@/lib/auth/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ROLES = ["customer", "staff", "admin"] as const;

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req, ["admin", "staff"]);
  } catch (e) {
    if (e instanceof AuthError) return apiError(e.status, e.message);
    return apiError(401, "Not authenticated");
  }

  const search = req.nextUrl.searchParams;
  const role = search.get("role")?.trim() || undefined;
  const q = search.get("q")?.trim() || undefined;
  const page = Math.max(1, Number(search.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(search.get("limit")) || 20));

  const where = {
    ...(role && VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])
      ? { role: role as (typeof VALID_ROLES)[number] }
      : {}),
    ...(q
      ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] }
      : {}),
  };

  try {
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          emailVerified: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { orders: true } },
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        emailVerified: u.emailVerified,
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
        orderCount: u._count.orders,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error("[api:admin:users:list]", e);
    return apiError(500, "Failed to load users");
  }
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAdmin(req, ["admin"]);
  } catch (e) {
    if (e instanceof AuthError) return apiError(e.status, e.message);
    return apiError(401, "Not authenticated");
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }
  const b = raw as {
    name?: unknown;
    email?: unknown;
    password?: unknown;
    phone?: unknown;
    role?: unknown;
  };

  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  const phone = typeof b.phone === "string" && b.phone.trim() ? b.phone.trim() : null;
  const role = typeof b.role === "string" ? b.role : "";

  if (!name) return apiError(422, "name is required", "VALIDATION");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return apiError(422, "A valid email is required", "VALIDATION");
  }
  if (!password || password.length < 8) {
    return apiError(422, "Password must be at least 8 characters", "VALIDATION");
  }
  if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
    return apiError(422, "role must be one of: customer, staff, admin", "VALIDATION");
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return apiError(409, "A user with this email already exists", "EMAIL_TAKEN");

    const hashedPassword = await hashPassword(password);
    const created = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        hashedPassword,
        role: role as (typeof VALID_ROLES)[number],
        emailVerified: false,
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    await writeAudit({
      adminUserId: user.id,
      action: "USER_CREATE",
      targetTable: "User",
      targetId: created.id,
      ipAddress: clientIp(req),
    });

    return NextResponse.json(
      { ok: true, user: created },
      { status: 201 }
    );
  } catch (e) {
    console.error("[api:admin:users:create]", e);
    return apiError(500, "Failed to create account");
  }
}
