"use client";

import Link from "next/link";
import { useState } from "react";
import type { Payment, PaymentAuditLog, QuickOrder } from "@/app/lib/payments/types";

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export default function OrderPaymentClient({
  order,
  payments: initialPayments,
  auditLogs,
  adminLoggedIn,
  databaseEnabled,
}: {
  order: QuickOrder;
  payments: Payment[];
  auditLogs: PaymentAuditLog[];
  adminLoggedIn: boolean;
  databaseEnabled: boolean;
}) {
  const [payments, setPayments] = useState(initialPayments);
  const [adminKey, setAdminKey] = useState("");
  const [notice, setNotice] = useState("");
  const latest = payments[payments.length - 1] || null;

  async function act(payment: Payment, action: "confirm" | "reject") {
    if (action === "confirm" && !confirm("Confirm that you have verified the Zelle payment in your bank account.")) return;
    setNotice("");
    const response = await fetch(`/api/admin/orders/${order.id}/payments/${payment.id}/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey,
      },
      body: action === "reject" ? JSON.stringify({ notes: "Payment not found in bank account." }) : "{}",
    });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.error || `Unable to ${action} payment.`);
      return;
    }
    setPayments((items) => items.map((item) => (item.id === data.payment.id ? data.payment : item)));
    setNotice(action === "confirm" ? "Payment confirmed and order marked paid." : "Payment rejected. Customer can choose another method.");
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-4 py-8 text-[#1d1d1f] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin/dashboard" className="text-sm font-semibold text-[#0066cc]">
          Back to Dashboard
        </Link>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">{order.order_number}</h1>
        <p className="mt-2 text-[#6e6e73]">
          {order.customer.name} · {order.customer.country} · {money(order.total)}
        </p>

        <label className="mt-8 block rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#d2d2d7]/70">
          <span className="text-sm font-semibold">{databaseEnabled ? "Admin Session" : "Admin API Key"}</span>
          <input
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            disabled={databaseEnabled}
            placeholder={databaseEnabled ? (adminLoggedIn ? "Logged in with secure session" : "Login required") : "Required in production"}
            className="mt-3 w-full rounded-2xl border border-[#d2d2d7] px-4 py-3 text-sm outline-none"
          />
        </label>

        {notice && <p className="mt-5 rounded-3xl bg-white p-4 text-sm text-[#6e6e73] ring-1 ring-[#d2d2d7]/70">{notice}</p>}

        <section className="mt-6 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-[#d2d2d7]/70">
          <h2 className="text-2xl font-semibold">Payment Section</h2>
          {latest ? (
            <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <p className="rounded-3xl bg-[#f5f5f7] p-4">
                <span className="block text-[#6e6e73]">Payment Provider</span>
                <span className="font-semibold capitalize">{latest.provider}</span>
              </p>
              <p className="rounded-3xl bg-[#f5f5f7] p-4">
                <span className="block text-[#6e6e73]">Payment Status</span>
                <span className="font-semibold capitalize">{latest.status.replace("_", " ")}</span>
              </p>
              <p className="rounded-3xl bg-[#f5f5f7] p-4">
                <span className="block text-[#6e6e73]">Amount</span>
                <span className="font-semibold">{money(latest.amount)}</span>
              </p>
              <p className="rounded-3xl bg-[#f5f5f7] p-4">
                <span className="block text-[#6e6e73]">Transaction ID</span>
                <span className="font-semibold">{latest.provider_payment_id || latest.provider_order_id || "Pending"}</span>
              </p>
              <p className="rounded-3xl bg-[#f5f5f7] p-4">
                <span className="block text-[#6e6e73]">Submitted At</span>
                <span className="font-semibold">{latest.submitted_at || "N/A"}</span>
              </p>
              <p className="rounded-3xl bg-[#f5f5f7] p-4">
                <span className="block text-[#6e6e73]">Verified At</span>
                <span className="font-semibold">{latest.verified_at || "N/A"}</span>
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#6e6e73]">No payment has been created yet.</p>
          )}

          {latest?.provider === "zelle" && latest.status === "pending_verification" && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => act(latest, "confirm")} className="rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white">
                Confirm Payment Received
              </button>
              <button type="button" onClick={() => act(latest, "reject")} className="rounded-full border border-[#d2d2d7] px-5 py-3 text-sm font-semibold">
                Reject Payment
              </button>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-[#d2d2d7]/70">
          <h2 className="text-2xl font-semibold">Payment Audit Logs</h2>
          <div className="mt-5 grid gap-3">
            {auditLogs.length === 0 && <p className="text-sm text-[#6e6e73]">No audit logs yet.</p>}
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-3xl border border-[#d2d2d7] p-4 text-sm">
                <p className="font-semibold">{log.action}</p>
                <p className="mt-1 text-[#6e6e73]">
                  {log.previous_status} to {log.new_status} · {log.performed_by} · {log.created_at}
                </p>
                {log.notes && <p className="mt-2 text-[#6e6e73]">{log.notes}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
