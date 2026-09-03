"use client";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "customer" | "staff" | "admin";
  emailVerified: boolean;
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function get(url: string) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export const authClient = {
  async signup(input: { name: string; email: string; password: string; phone?: string }) {
    return post("/api/auth/signup", input);
  },
  async login(input: { email: string; password: string }) {
    return post("/api/auth/login", input);
  },
  async logout() {
    return post("/api/auth/logout", {});
  },
  async me(): Promise<PublicUser | null> {
    const { ok, data } = await get("/api/auth/me");
    return ok ? (data as { user: PublicUser }).user : null;
  },
  async createGuest() {
    return post("/api/auth/guest", {});
  },
};