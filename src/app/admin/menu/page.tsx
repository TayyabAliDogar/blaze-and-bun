"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminJson, type AdminMenuResponse, type AdminMenuItem, type AdminMenuCategory } from "@/lib/admin/api";

interface BranchRow {
  id: string;
  name: string;
  city: string;
  currencyCode: string;
  isActive: boolean;
}

export default function AdminMenuPage() {
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [categories, setCategories] = useState<AdminMenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [editingItem, setEditingItem] = useState<string | "new" | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Item edit form fields
  const [itemName, setItemName] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [itemIsActive, setItemIsActive] = useState(true);
  const [itemPrices, setItemPrices] = useState<Record<string, string>>({});
  const [itemOutOfStock, setItemOutOfStock] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await adminJson<AdminMenuResponse>("/api/admin/menu");
      setBranches(d.branches as BranchRow[]);
      setCategories(d.categories);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load menu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(null), 2500);
  };

  const openNewItem = (categoryId: string) => {
    setEditingItem("new");
    setItemName("");
    setItemCategoryId(categoryId);
    setItemDescription("");
    setItemImageUrl("");
    setItemIsActive(true);
    setItemPrices(Object.fromEntries(branches.map((b) => [b.id, ""])));
    setItemOutOfStock(Object.fromEntries(branches.map((b) => [b.id, false])));
    setError(null);
  };

  const openEditItem = (item: AdminMenuItem) => {
    setEditingItem(item.id);
    setItemName(item.name);
    setItemCategoryId(item.categoryId);
    setItemDescription(item.description ?? "");
    setItemImageUrl(item.imageUrl ?? "");
    setItemIsActive(item.isActive);
    const p: Record<string, string> = {};
    for (const b of branches) p[b.id] = item.prices[b.id] !== undefined ? String(item.prices[b.id]) : "";
    setItemPrices(p);
    const oos: Record<string, boolean> = {};
    for (const b of branches) oos[b.id] = item.outOfStockBranches?.includes(b.id) ?? false;
    setItemOutOfStock(oos);
    setError(null);
  };

  const closeModal = () => {
    setEditingItem(null);
    setEditingCategoryId(null);
    setNewCategoryOpen(false);
  };

  const saveItem = async () => {
    if (!itemName.trim()) {
      setError("Item name is required");
      return;
    }
    if (!itemCategoryId) {
      setError("Please choose a category");
      return;
    }
    setSaving(true);
    try {
      const prices: Record<string, number> = {};
      for (const b of branches) {
        const raw = itemPrices[b.id]?.trim();
        if (raw !== undefined && raw !== "") {
          const n = Number(raw);
          if (!Number.isFinite(n) || n < 0) {
            setError(`Price for ${b.name} must be a non-negative number`);
            setSaving(false);
            return;
          }
          prices[b.id] = Math.round(n * 100) / 100;
        }
      }
      const isEdit = editingItem !== null && editingItem !== "new";
      const id = isEdit ? editingItem : undefined;
      const url = isEdit ? `/api/admin/menu/${id}` : "/api/admin/menu";
      const method = isEdit ? "PATCH" : "POST";

      const outOfStockBranches = Object.entries(itemOutOfStock)
        .filter(([, v]) => v)
        .map(([bid]) => bid);

      await adminJson<{ ok: boolean }>(url, {
        method,
        body: JSON.stringify({
          name: itemName,
          categoryId: itemCategoryId,
          description: itemDescription,
          imageUrl: itemImageUrl,
          ...(isEdit ? {} : { isActive: itemIsActive }),
          prices,
          ...(isEdit
            ? { stock: Object.fromEntries(Object.entries(itemOutOfStock)) }
            : { outOfStockBranches }),
        }),
      });
      flash(isEdit ? "Item updated" : "Item created");
      closeModal();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleStock = async (item: AdminMenuItem) => {
    const next = !item.isActive;
    try {
      await adminJson<{ ok: boolean }>(`/api/admin/menu/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });
      flash(next ? "Item back in stock" : "Item marked out of stock");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toggle failed");
    }
  };

  const deleteItem = async (item: AdminMenuItem) => {
    if (!window.confirm(`Delete "${item.name}"? This hides it from every branch (history is kept).`)) return;
    try {
      await adminJson<{ ok: boolean }>(`/api/admin/menu/${item.id}`, { method: "DELETE" });
      flash(`"${item.name}" deleted`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const openEditCategory = (cat: AdminMenuCategory) => {
    setEditingCategoryId(cat.id);
    setCategoryName(cat.name);
    setError(null);
  };

  const saveCategory = async () => {
    if (!editingCategoryId) return;
    if (!categoryName.trim()) {
      setError("Category name is required");
      return;
    }
    try {
      await adminJson<{ ok: boolean }>(`/api/admin/menu/categories/${editingCategoryId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: categoryName }),
      });
      flash("Category renamed");
      closeModal();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed");
    }
  };

  const createCategory = async () => {
    if (!newCategoryName.trim()) {
      setError("Category name is required");
      return;
    }
    try {
      await adminJson<{ ok: boolean }>("/api/admin/menu/categories", {
        method: "POST",
        body: JSON.stringify({ name: newCategoryName }),
      });
      flash("Category created");
      setNewCategoryOpen(false);
      setNewCategoryName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  };

  const deleteCategory = async (cat: AdminMenuCategory) => {
    if (!window.confirm(`Delete category "${cat.name}"? Only empty categories can be deleted.`)) return;
    try {
      await adminJson<{ ok: boolean }>(`/api/admin/menu/categories/${cat.id}`, { method: "DELETE" });
      flash("Category deleted");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const totalItems = useMemo(() => categories.reduce((n, c) => n + c.items.length, 0), [categories]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Menu Management</h1>
          <p className="text-sm text-[#8A7F72] mt-1">
            Create, edit, and price items across {branches.length} branch{branches.length === 1 ? "" : "es"}.
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl text-[#F2B33D]">{totalItems}</p>
          <p className="text-[10px] font-mono uppercase text-[#8A7F72]">items</p>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-[#E8542A]/15 border border-[#E8542A]/40 text-sm">{error}</div>}
      {message && <div className="mb-4 p-3 rounded-lg bg-[#3D8B40]/20 border border-[#5FB96A]/40 text-sm">{message}</div>}

      <div className="flex flex-wrap gap-2 mb-6">
        {categories.length > 0 && (
          <button
            onClick={() => openNewItem(categories[0].id)}
            className="px-4 py-2 rounded-xl bg-[#E8542A] text-[#241B14] font-mono text-xs uppercase tracking-wider hover:bg-[#FF6A3D] transition-colors"
          >
            + New item
          </button>
        )}
        <button
          onClick={() => setNewCategoryOpen(true)}
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 font-mono text-xs uppercase tracking-wider hover:bg-white/10 transition-colors"
        >
          + New category
        </button>
      </div>

      {loading ? (
        <div className="text-center py-24 text-[#8A7F72]">Loading menu…</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-24 text-[#8A7F72]">
          No categories yet. Create a branch-category to start building your menu.
          {branches.length === 0 && <div className="mt-2 text-sm">Add a branch first under Branches.</div>}
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => (
            <section key={cat.id} className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/10 bg-white/[0.02]">
                <div>
                  <p className="font-display text-lg">{cat.name}</p>
                  <p className="text-[10px] font-mono uppercase text-[#8A7F72]">
                    {cat.items.length} item{cat.items.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href="#"
                    onClick={(e) => { e.preventDefault(); openNewItem(cat.id); }}
                    className="text-xs font-mono uppercase tracking-wider text-[#F2B33D] hover:text-[#FFC93C]"
                  >
                    + Item
                  </Link>
                  <button
                    onClick={() => openEditCategory(cat)}
                    className="text-xs font-mono uppercase tracking-wider text-[#8A7F72] hover:text-[#F5EFE4]"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => deleteCategory(cat)}
                    className="text-xs font-mono uppercase tracking-wider text-[#E8542A]/70 hover:text-[#E8542A]"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {cat.items.length === 0 ? (
                <div className="px-5 py-6 text-sm text-[#8A7F72]">No items in this category.</div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {cat.items.map((item) => (
                    <li key={item.id} className="px-5 py-4 flex items-center gap-4">
                      <div
                        className={`h-12 w-12 shrink-0 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden ${
                          !item.isActive ? "grayscale opacity-50" : ""
                        }`}
                      >
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-lg">🍔</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`font-medium ${!item.isActive ? "text-[#8A7F72] line-through" : ""}`}>
                          {item.name}
                        </p>
                        <p className="text-xs text-[#8A7F72] truncate">{item.description || "No description"}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {branches.map((b) => {
                            const price = item.prices[b.id];
                            const oos = item.outOfStockBranches?.includes(b.id);
                            return (
                              <span
                                key={b.id}
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                  oos
                                    ? "bg-[#E8542A]/15 text-[#E8542A]"
                                    : price !== undefined
                                      ? "bg-white/5 text-[#8A7F72]"
                                      : "bg-[#E8542A]/10 text-[#E8542A]/60"
                                }`}
                              >
                                {b.city.split(",")[0]}: {oos ? "Sold out" : price !== undefined ? `${b.currencyCode} ${Number(price).toFixed(2)}` : "—"}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleStock(item)}
                          title={item.isActive ? "Out of stock" : "Back in stock"}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors ${
                            item.isActive
                              ? "bg-[#3D8B40]/20 text-[#5FB96A] hover:bg-[#3D8B40]/35"
                              : "bg-[#E8542A]/20 text-[#E8542A] hover:bg-[#E8542A]/35"
                          }`}
                        >
                          {item.isActive ? "In stock" : "Out"}
                        </button>
                        <button
                          onClick={() => openEditItem(item)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono uppercase tracking-wider hover:bg-white/10 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteItem(item)}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider text-[#E8542A]/70 hover:text-[#E8542A] hover:bg-[#E8542A]/10 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Item create/edit modal */}
      {editingItem !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-2xl bg-[#1C120C] border border-white/10 rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-2xl mb-1">{editingItem === "new" ? "New menu item" : "Edit menu item"}</h2>
            <p className="text-sm text-[#8A7F72] mb-5">
              {editingItem === "new"
                ? "Set a per-branch price or leave blank to hide from that branch."
                : "Adjust the item or its per-branch prices."}
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <label className="md:col-span-2 block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Name *</span>
                <input
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                  placeholder="Classic Smash Burger"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Category *</span>
                <select
                  value={itemCategoryId}
                  onChange={(e) => setItemCategoryId(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#1C120C]">
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Image</span>
                <div className="mt-1 flex items-center gap-2">
                  {itemImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={itemImageUrl} alt="preview" className="h-10 w-10 rounded-lg object-cover border border-white/10" />
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                    disabled={uploading}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setUploading(true);
                      setError(null);
                      try {
                        const fd = new FormData();
                        fd.append("file", f);
                        const res = await fetch("/api/upload", {
                          method: "POST",
                          body: fd,
                          credentials: "include",
                        });
                        const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
                        if (!res.ok || !data.ok) throw new Error(data.error ?? "Upload failed");
                        setItemImageUrl(data.url ?? "");
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Upload failed");
                      } finally {
                        setUploading(false);
                        e.target.value = "";
                      }
                    }}
                    className="text-xs text-[#8A7F72] file:mr-2 file:rounded-lg file:border-0 file:bg-[#E8542A]/20 file:px-3 file:py-1.5 file:text-[#F2B33D] file:font-mono file:text-xs disabled:opacity-50 file:cursor-pointer"
                  />
                  {uploading && <span className="text-xs text-[#8A7F72]">Uploading…</span>}
                </div>
                <input
                  type="text"
                  value={itemImageUrl}
                  onChange={(e) => setItemImageUrl(e.target.value)}
                  className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                  placeholder="https://… or upload above"
                />
              </label>
              <label className="md:col-span-2 block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Description</span>
                <textarea
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                  placeholder="Juicy smash patty, cheddar, house sauce…"
                />
              </label>
            </div>

            <div className="mb-4">
              <p className="text-[10px] font-mono uppercase text-[#8A7F72] mb-2">Per-branch pricing ({branches.length})</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {branches.map((b) => (
                  <div key={b.id} className="rounded-xl border border-white/10 p-3">
                    <label className="block">
                      <span className="text-xs text-[#8A7F72]">{b.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-[#8A7F72]">{b.currencyCode}</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={itemPrices[b.id] ?? ""}
                          onChange={(e) => setItemPrices((p) => ({ ...p, [b.id]: e.target.value }))}
                          className="mt-0.5 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                          placeholder={b.isActive ? "0.00" : "hidden"}
                        />
                      </div>
                    </label>
                    <label className="flex items-center gap-2 mt-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(itemOutOfStock[b.id])}
                        onChange={(e) => setItemOutOfStock((s) => ({ ...s, [b.id]: e.target.checked }))}
                        disabled={itemPrices[b.id] === undefined || itemPrices[b.id] === ""}
                        className="accent-[#E8542A]"
                      />
                      Mark out of stock at this branch
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[#8A7F72] mt-1">
                Leave a price blank to hide the item there. Out of stock keeps it visible but un-orderable.
              </p>
            </div>

            {editingItem !== "new" && (
              <label className="flex items-center gap-2 mb-4 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={itemIsActive}
                  onChange={(e) => setItemIsActive(e.target.checked)}
                  className="accent-[#E8542A]"
                />
                In stock / visible on menus
              </label>
            )}

            <p className="text-[11px] text-[#8A7F72] -mt-2 mb-4">
              Use the per-branch checkboxes above to mark an item as sold out while keeping it visible. This toggle hides it entirely.
            </p>

            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveItem}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-[#E8542A] text-[#241B14] text-sm font-medium hover:bg-[#FF6A3D] disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : editingItem === "new" ? "Create item" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category rename modal */}
      {editingCategoryId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md bg-[#1C120C] border border-white/10 rounded-3xl p-6">
            <h2 className="font-display text-2xl mb-4">Rename category</h2>
            <input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A] mb-4"
              placeholder="Category name"
            />
            <div className="flex items-center justify-end gap-2">
              <button onClick={closeModal} className="px-4 py-2 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button onClick={saveCategory} className="px-4 py-2 rounded-xl bg-[#E8542A] text-[#241B14] text-sm font-medium hover:bg-[#FF6A3D] transition-colors">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New category modal */}
      {newCategoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md bg-[#1C120C] border border-white/10 rounded-3xl p-6">
            <h2 className="font-display text-2xl mb-4">New category</h2>
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A] mb-4"
              placeholder="e.g. Family Bundles"
            />
            <div className="flex items-center justify-end gap-2">
              <button onClick={closeModal} className="px-4 py-2 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button onClick={createCategory} className="px-4 py-2 rounded-xl bg-[#E8542A] text-[#241B14] text-sm font-medium hover:bg-[#FF6A3D] transition-colors">
                Create
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
