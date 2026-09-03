"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminJson, type AdminUser, type AdminUserListResponse } from "@/lib/admin/api";

type RoleFilter = "all" | "customer" | "staff" | "admin";
type StatusFilter = "all" | "active" | "inactive";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-[#E8542A]/20 text-[#E8542A]",
  staff: "bg-[#F2B33D]/20 text-[#F2B33D]",
  customer: "bg-white/10 text-[#8A7F72]",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "staff",
  });

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "100");
      const d = await adminJson<AdminUserListResponse>(`/api/admin/users?${params.toString()}`);
      setUsers(d.users);
      setTotal(d.pagination.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [roleFilter, q]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(null), 2500);
  };

  const visibleUsers = statusFilter === "all" ? users : users.filter((u) => (statusFilter === "active" ? u.isActive : !u.isActive));

  const setRole = async (u: AdminUser, role: string) => {
    if (role === u.role) return;
    setBusyId(u.id);
    try {
      await adminJson<{ ok: boolean }>(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      flash(`${u.name} is now ${role}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Role change failed");
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (u: AdminUser) => {
    const next = !u.isActive;
    setBusyId(u.id);
    try {
      await adminJson<{ ok: boolean }>(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });
      flash(next ? `${u.name} activated` : `${u.name} deactivated`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status change failed");
    } finally {
      setBusyId(null);
    }
  };

  const createUser = async () => {
    if (!createForm.name.trim() || !createForm.email.trim() || createForm.password.length < 8) {
      setError("Name, valid email, and an 8+ char password are required");
      return;
    }
    setSaving(true);
    try {
      await adminJson<{ ok: boolean }>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ ...createForm, email: createForm.email.trim() }),
      });
      flash("Account created");
      setShowCreate(false);
      setCreateForm({ name: "", email: "", password: "", phone: "", role: "staff" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const setCreateField = (field: string, value: string) => setCreateForm((f) => ({ ...f, [field]: value }));

  const counts = {
    admin: users.filter((u) => u.role === "admin").length,
    staff: users.filter((u) => u.role === "staff").length,
    customer: users.filter((u) => u.role === "customer").length,
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Accounts</h1>
          <p className="text-sm text-[#8A7F72] mt-1">
            Manage customer, staff, and admin accounts. Role and status changes are audited.
          </p>
        </div>
        <button
          onClick={() => { setError(null); setShowCreate(true); }}
          className="px-4 py-2 rounded-xl bg-[#E8542A] text-[#241B14] font-mono text-xs uppercase tracking-wider hover:bg-[#FF6A3D] transition-colors"
        >
          + New staff
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6 max-w-md">
        <div className="p-3 rounded-lg bg-white/5">
          <p className="text-[10px] font-mono uppercase text-[#8A7F72]">Admins</p>
          <p className="font-mono text-xl text-[#E8542A] mt-1">{counts.admin}</p>
        </div>
        <div className="p-3 rounded-lg bg-white/5">
          <p className="text-[10px] font-mono uppercase text-[#8A7F72]">Staff</p>
          <p className="font-mono text-xl text-[#F2B33D] mt-1">{counts.staff}</p>
        </div>
        <div className="p-3 rounded-lg bg-white/5">
          <p className="text-[10px] font-mono uppercase text-[#8A7F72]">Customers</p>
          <p className="font-mono text-xl mt-1">{counts.customer}</p>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-[#E8542A]/15 border border-[#E8542A]/40 text-sm">{error}</div>}
      {message && <div className="mb-4 p-3 rounded-lg bg-[#3D8B40]/20 border border-[#5FB96A]/40 text-sm">{message}</div>}

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex flex-wrap gap-2">
          {(["all", "customer", "staff", "admin"] as RoleFilter[]).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider transition-colors capitalize ${
                roleFilter === r ? "bg-[#E8542A] text-[#241B14]" : "bg-white/5 text-[#8A7F72] hover:bg-white/10"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="ml-auto rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-[#8A7F72] focus:outline-none focus:border-[#E8542A]"
        >
          <option value="all" className="bg-[#1C120C]">All status</option>
          <option value="active" className="bg-[#1C120C]">Active</option>
          <option value="inactive" className="bg-[#1C120C]">Inactive</option>
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or email…"
          className="rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-[#F5EFE4] focus:outline-none focus:border-[#E8542A] w-52"
        />
      </div>

      {loading ? (
        <div className="text-center py-24 text-[#8A7F72]">Loading accounts…</div>
      ) : visibleUsers.length === 0 ? (
        <div className="text-center py-24 text-[#8A7F72]">No accounts match this filter.</div>
      ) : (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-white/10 text-[10px] font-mono uppercase text-[#8A7F72]">
            <div>User</div>
            <div>Role</div>
            <div>Status</div>
            <div className="text-right">Orders</div>
          </div>
          <ul className="divide-y divide-white/5">
            {visibleUsers.map((u) => (
              <li key={u.id} className="px-5 py-4 md:grid md:grid-cols-[2fr_1fr_1fr_auto] md:gap-4 md:items-center">
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-[#8A7F72]">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                </div>
                <div className="mt-2 md:mt-0">
                  <select
                    value={u.role}
                    disabled={busyId === u.id || !u.isActive}
                    onChange={(e) => setRole(u, e.target.value)}
                    className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs uppercase focus:outline-none focus:border-[#E8542A] disabled:opacity-50"
                  >
                    <option value="customer" className="bg-[#1C120C]">customer</option>
                    <option value="staff" className="bg-[#1C120C]">staff</option>
                    <option value="admin" className="bg-[#1C120C]">admin</option>
                  </select>
                </div>
                <div className="mt-2 md:mt-0 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase ${ROLE_COLORS[u.role]}`}>{u.role}</span>
                  <span className={`text-xs ${u.isActive ? "text-[#5FB96A]" : "text-[#E8542A]"}`}>
                    {u.isActive ? "active" : "inactive"}
                  </span>
                </div>
                <div className="mt-3 md:mt-0 flex items-center gap-2 md:justify-end">
                  <span className="text-xs font-mono text-[#8A7F72] mr-2">{u.orderCount}</span>
                  <button
                    onClick={() => toggleActive(u)}
                    disabled={busyId === u.id}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors disabled:opacity-50 ${
                      u.isActive
                        ? "bg-[#E8542A]/20 text-[#E8542A] hover:bg-[#E8542A]/35"
                        : "bg-[#3D8B40]/20 text-[#5FB96A] hover:bg-[#3D8B40]/35"
                    }`}
                  >
                    {busyId === u.id ? "…" : u.isActive ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="px-5 py-3 border-t border-white/10 text-xs text-[#8A7F72]">
            Showing {visibleUsers.length} of {total} account{total === 1 ? "" : "s"}
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md bg-[#1C120C] border border-white/10 rounded-3xl p-6">
            <h2 className="font-display text-2xl mb-1">New staff account</h2>
            <p className="text-sm text-[#8A7F72] mb-5">Create a staff or admin login. They can sign in right away.</p>

            <div className="grid gap-4 mb-4">
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Full name *</span>
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateField("name", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Email *</span>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateField("email", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Phone</span>
                <input
                  value={createForm.phone}
                  onChange={(e) => setCreateField("phone", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Role</span>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateField("role", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                >
                  <option value="staff" className="bg-[#1C120C]">Staff</option>
                  <option value="admin" className="bg-[#1C120C]">Admin</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Password * (8+ chars)</span>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateField("password", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button
                onClick={createUser}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-[#E8542A] text-[#241B14] text-sm font-medium hover:bg-[#FF6A3D] disabled:opacity-50 transition-colors"
              >
                {saving ? "Creating…" : "Create account"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-10 text-center">
        <Link href="/admin" className="text-sm text-[#F2B33D] hover:text-[#FFC93C]">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
