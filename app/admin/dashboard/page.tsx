import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUserFromCookie } from "@/app/lib/admin-auth";
import { databaseEnabled } from "@/app/lib/db/prisma";
import { getPaymentStats, listOrders } from "@/app/lib/payments/service";

export const dynamic = "force-dynamic";

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export default async function AdminDashboardPage() {
  const admin = await getAdminUserFromCookie();
  if (databaseEnabled && !admin) redirect("/admin/login?next=/admin/dashboard");
  const stats = await getPaymentStats();
  const orders = await listOrders();
  const cards = [
    ["Pending Payments", stats.pendingPayments],
    ["Pending Zelle Verification", stats.pendingZelleVerification],
    ["Paid Today", stats.paidToday],
    ["PayPal Revenue", money(stats.paypalRevenue)],
    ["Zelle Revenue", money(stats.zelleRevenue)],
    ["Card Revenue", money(stats.cardRevenue)],
  ];

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-4 py-8 text-[#1d1d1f] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-[#6e6e73]">Admin</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Dashboard</h1>
          </div>
          <div className="flex gap-3">
            {!admin ? (
              <Link href="/admin/login" className="rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white">
                Admin Login
              </Link>
            ) : (
              <form action="/api/admin/logout" method="post">
                <button className="rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white">Logout</button>
              </form>
            )}
            <Link href="/admin/quick-order" className="rounded-full bg-white px-5 py-3 text-sm font-semibold ring-1 ring-[#d2d2d7]">
              Quick Order
            </Link>
            <Link href="/admin/settings/payments" className="rounded-full bg-white px-5 py-3 text-sm font-semibold ring-1 ring-[#d2d2d7]">
              Payment Settings
            </Link>
            <Link href="/checkout/demo-checkout" className="rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white">
              Demo Checkout
            </Link>
          </div>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(([label, value]) => (
            <div key={label} className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-[#d2d2d7]/70">
              <p className="text-sm text-[#6e6e73]">{label}</p>
              <p className="mt-2 text-3xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-[#d2d2d7]/70">
          <h2 className="text-2xl font-semibold">Recent Orders</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-[#6e6e73]">
                <tr>
                  <th className="border-b border-[#d2d2d7] py-3">Order</th>
                  <th className="border-b border-[#d2d2d7] py-3">Customer</th>
                  <th className="border-b border-[#d2d2d7] py-3">Country</th>
                  <th className="border-b border-[#d2d2d7] py-3">Total</th>
                  <th className="border-b border-[#d2d2d7] py-3">Payment</th>
                  <th className="border-b border-[#d2d2d7] py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="border-b border-[#f5f5f7] py-4">
                      <Link href={`/admin/orders/${order.id}`} className="font-semibold text-[#0066cc]">
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="border-b border-[#f5f5f7] py-4">{order.customer.name}</td>
                    <td className="border-b border-[#f5f5f7] py-4">{order.customer.country}</td>
                    <td className="border-b border-[#f5f5f7] py-4">{money(order.total)}</td>
                    <td className="border-b border-[#f5f5f7] py-4 capitalize">{order.payment_status}</td>
                    <td className="border-b border-[#f5f5f7] py-4 capitalize">{order.order_status.replace("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
