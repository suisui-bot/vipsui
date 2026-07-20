import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUserFromCookie } from "@/app/lib/admin-auth";
import { databaseEnabled } from "@/app/lib/db/prisma";
import { checkoutWhatsAppMessage, listOrders } from "@/app/lib/payments/service";

export const dynamic = "force-dynamic";

export default async function QuickOrderPage() {
  const admin = await getAdminUserFromCookie();
  if (databaseEnabled && !admin) redirect("/admin/login?next=/admin/quick-order");
  const order = (await listOrders())[0];
  const checkoutUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://vipsui.vercel.app"}/checkout/${order.checkout_token}`;
  const message = checkoutWhatsAppMessage(checkoutUrl);

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-4 py-8 text-[#1d1d1f] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin/dashboard" className="text-sm font-semibold text-[#0066cc]">
          Back to Dashboard
        </Link>
        <p className="mt-8 text-sm font-medium uppercase text-[#6e6e73]">Quick Order</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Checkout Link Message</h1>
        <p className="mt-3 text-[#6e6e73]">Demo order: {order.order_number}</p>

        <section className="mt-8 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-[#d2d2d7]/70">
          <p className="text-sm font-semibold">Checkout Link</p>
          <p className="mt-3 break-all rounded-3xl bg-[#f5f5f7] p-4 text-sm">{checkoutUrl}</p>

          <p className="mt-6 text-sm font-semibold">Copy WhatsApp Message</p>
          <textarea readOnly value={message} className="mt-3 min-h-64 w-full rounded-3xl border border-[#d2d2d7] bg-[#f5f5f7] p-4 text-sm leading-6 outline-none" />

          <a
            href={`https://wa.me/8617336648172?text=${encodeURIComponent(message)}`}
            className="mt-5 inline-flex rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white"
          >
            Open WhatsApp
          </a>
        </section>
      </div>
    </main>
  );
}
