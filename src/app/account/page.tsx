import { cookies } from "next/headers";
import Link from "next/link";
import { verifyAccessTokenEdge } from "@/lib/auth/jwt-edge";
import { ACCESS_COOKIE } from "@/lib/auth/constants";

export const metadata = { title: "Your Account | Blaze & Bun" };

export default async function AccountPage() {
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

  return (
    <main className="min-h-screen bg-[#110C08] text-[#F5EFE4] flex flex-col items-center justify-center gap-4 text-center px-6">
      <h1 className="font-display text-3xl">
        Hello, <span className="italic text-stroke-orange">Customer</span>
      </h1>
      <p className="text-[#8A7F72]">Your account hub is coming soon.</p>
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        <Link
          href="/menu"
          className="px-5 py-2.5 rounded-full bg-[#E8542A] text-white font-semibold hover:bg-[#c7451f]"
        >
          Browse Menu
        </Link>
        <Link
          href="/login"
          className="px-5 py-2.5 rounded-full border border-[#3D3A34] text-[#F5EFE4] hover:bg-white/[0.04]"
        >
          Sign out
        </Link>
      </div>
    </main>
  );
}
