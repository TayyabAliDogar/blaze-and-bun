import Link from "next/link";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/branches", label: "Branches" },
  { href: "/admin/promos", label: "Promos" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/users", label: "Users" },
];

export const metadata = {
  title: "Blaze & Bun · Store Operations",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#241B14] text-[#F5EFE4] grain">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#241B14]/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-display text-xl">
              Blaze<span className="text-[#E8542A]">&amp;</span>Bun <span className="text-[#8A7F72] text-base">· Ops</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="px-4 py-2 rounded-lg text-sm text-[#F5EFE4]/80 hover:text-[#F5EFE4] hover:bg-white/5 transition-colors"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <Link
            href="/?auth=admin"
            className="text-xs font-mono uppercase tracking-widest text-[#8A7F72] hover:text-[#F5EFE4]"
          >
            Exit Ops →
          </Link>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">{children}</main>
    </div>
  );
}
