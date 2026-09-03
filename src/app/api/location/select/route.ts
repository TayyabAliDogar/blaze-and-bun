import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setBranchCookie, toBranchDTO } from "@/lib/location/server";
import { apiError } from "@/lib/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const selectSchema = z.object({
  branchId: z.string().min(1, "branchId is required").max(200),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = selectSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION");
  }

  const branch = await prisma.branch.findUnique({
    where: { id: parsed.data.branchId },
  });

  if (!branch || !branch.isActive) {
    return apiError(404, "Branch not found or unavailable", "BRANCH_NOT_FOUND");
  }

  const res = NextResponse.json({ ok: true, branch: toBranchDTO(branch) });
  setBranchCookie(res, branch.id);
  return res;
}