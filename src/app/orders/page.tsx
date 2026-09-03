import { cookies } from "next/headers";
import Link from "next/link";
import { verifyAccessTokenEdge } from "@/lib/auth/jwt-edge";
import { ACCESS_COOKIE } from "@/lib/auth/constants";
import { prisma } from "@/lib/prisma";
import ReviewForm from "@/components/orders/ReviewForm";

export const metadata = { title: "Your Orders | Blaze & Bun" };

export default async function OrdersPage() {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  const payload = await verifyAccessTokenEdge(access);

  if (!payload) {
    return (
      <main className="min-h-screen bg-[#110C08] text-[#F5EFE4] flex flex-col items-center justify-center gap-4 text-center px-6">
        <h1 className="font-display text-3xl">Signed out</h1>
        <p className="text-[#8A7F72]">Your session has expired.</p>
        <Link href="/login" className="text-[#FFB84C] hover:underline">
          Sign in to continue
        </Link>
      </main>
    );
  }

  const orders = await prisma.order.findMany({
    where: { userId: payload.sub },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      total: true,
      currencyCode: true,
      createdAt: true,
      branch: { select: { name: true } },
      reviews: { select: { id: true } },
    },
  });

  return (
    <main className="min-h-screen bg-[#110C08] text-[#F5EFE4] px-4 md:px-6 pt-28 pb-20">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-4xl mb-2">
          Your <span className="italic text-stroke-orange">Orders</span>
        </h1>
        <p className="text-[#8A7F72] text-sm mb-8">Your recent deliveries and pickups.</p>

        {orders.length === 0 ? (
          <p className="text-[#8A7F72]">No orders yet — time to build your flame.</p>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li
                key={o.id}
                className="p-4 rounded-2xl bg-white/[0.04] border border-[#3D3A34]"
              >
                <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-sm text-[#F5EFE4]">#{o.id.slice(0, 8)}</p>
                  <p className="text-xs text-[#8A7F72]">
                    {o.branch?.name ?? "Branch"} · {new Date(o.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {o.currencyCode === "GBP" ? "£" : "$"}
                    {Number(o.total).toFixed(2)}
                  </p>
                  <span
                    className={`inline-block mt-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      o.status === "completed"
                        ? "bg-[#3D8B40]/20 text-[#7fd08a]"
                        : o.status === "cancelled"
                        ? "bg-[#E8542A]/20 text-[#ff9d80]"
                        : "bg-[#E8A020]/20 text-[#ffc55c]"
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
                </div>

                {o.status === "completed" && (
                  <ReviewForm
                    orderId={o.id}
                    alreadyReviewed={o.reviews.length > 0}
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8">
          <Link href="/menu" className="text-[#FFB84C] hover:underline text-sm">
            ← Back to menu
          </Link>
        </div>
      </div>
    </main>
  );
}
