import Link from "next/link";
import { notFound } from "next/navigation";
import { listOrders } from "@/app/lib/payments/service";

export const dynamic = "force-dynamic";

export default async function TrackingPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const order = (await listOrders()).find((item) => item.order_number === decodeURIComponent(orderNumber));
  if (!order) notFound();

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-4 py-10 text-[#1d1d1f] sm:px-6">
      <div className="mx-auto max-w-3xl rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-[#d2d2d7]/70 sm:p-10">
        <Link href="/" className="text-sm font-semibold tracking-[0.28em]">
          VIPSUI
        </Link>
        <p className="mt-10 text-sm font-medium uppercase text-[#6e6e73]">Order Tracking</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{order.order_number}</h1>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-[#f5f5f7] p-5">
            <p className="text-sm text-[#6e6e73]">Payment Status</p>
            <p className="mt-2 text-2xl font-semibold capitalize">{order.payment_status}</p>
          </div>
          <div className="rounded-3xl bg-[#f5f5f7] p-5">
            <p className="text-sm text-[#6e6e73]">Order Status</p>
            <p className="mt-2 text-2xl font-semibold capitalize">{order.order_status.replace("_", " ")}</p>
          </div>
        </div>
        <p className="mt-8 text-sm text-[#6e6e73]">Shipping and logistics updates will appear here after payment is confirmed.</p>
        <a href="https://wa.me/8617336648172" className="mt-6 inline-flex rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white">
          Contact on WhatsApp
        </a>
      </div>
    </main>
  );
}
