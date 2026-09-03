import { NextRequest, NextResponse } from "next/server";
import { getActiveBranches, readBranchId, toBranchDTO } from "@/lib/location/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const selectedId = readBranchId(req);
    const branches = await getActiveBranches();
    const dtos = branches.map((b) =>
      toBranchDTO(b, { isSelected: b.id === selectedId })
    );
    return NextResponse.json({ branches: dtos });
  } catch (e) {
    console.error("[api:branches]", e);
    return NextResponse.json({ error: "Failed to load branches" }, { status: 500 });
  }
}