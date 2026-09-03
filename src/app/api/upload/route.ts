import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/admin/guard";
import { AuthError } from "@/lib/auth/guard";
import { apiError } from "@/lib/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["image/avif", ".avif"],
]);

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req, ["admin", "staff"]);
  } catch (e) {
    if (e instanceof AuthError) return apiError(e.status, e.message);
    return apiError(401, "Not authenticated");
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return apiError(422, "No file uploaded", "VALIDATION");
    }

    const mime = file.type ?? "";
    const ext = ALLOWED.get(mime);
    if (!ext) {
      return apiError(422, "Unsupported file type. Use JPEG, PNG, WebP, GIF or AVIF.", "VALIDATION");
    }
    if (file.size > MAX_BYTES) {
      return apiError(422, "File too large. Max 4 MB.", "VALIDATION");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const uploadDir = join(process.cwd(), "public", "uploads", "menu");
    await mkdir(uploadDir, { recursive: true });

    const name = `${Date.now()}-${randomUUID()}${ext}`;
    await writeFile(join(uploadDir, name), bytes);

    const url = `/uploads/menu/${name}`;
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    console.error("[api:upload]", e);
    return apiError(500, "Failed to upload image");
  }
}
