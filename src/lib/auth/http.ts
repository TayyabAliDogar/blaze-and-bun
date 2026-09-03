import { NextResponse } from "next/server";

export interface ApiErrorShape {
  error: string;
  code?: string;
}

export function apiError(status: number, message: string, code?: string): NextResponse {
  const body: ApiErrorShape = { error: message };
  if (code) body.code = code;
  return NextResponse.json(body, { status });
}

export function apiOk(data: unknown): NextResponse {
  return NextResponse.json({ ok: true, ...(data as object) });
}