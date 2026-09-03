import { prisma } from "@/lib/prisma";

/**
 * Claim any guest orders placed with the same email onto the new/returning
 * user. Runs after a successful signup or login so a guest who later creates
 * an account keeps their order history. Best-effort: never throws.
 */
export async function linkGuestOrdersByEmail(userId: string, email: string): Promise<number> {
  try {
    const guest = email.trim().toLowerCase();
    if (!guest) return 0;
    const result = await prisma.order.updateMany({
      where: { userId: null, guestEmail: guest },
      data: { userId },
    });
    return result.count;
  } catch (e) {
    console.error("[orders:link]", e);
    return 0;
  }
}
