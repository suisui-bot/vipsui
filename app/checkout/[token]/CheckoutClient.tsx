"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Payment, PaymentProvider, QuickOrder } from "@/app/lib/payments/types";

type Props = {
  order: QuickOrder;
  providers: PaymentProvider[];
  payments: Payment[];
  latestPayment: Payment | null;
};

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === "paypal") return <span className="text-lg font-bold text-[#003087]">P</span>;
  if (provider === "stripe") return <span className="text-sm font-semibold">CARD</span>;
  return <span className="text-sm font-semibold text-[#6c2bd9]">Z</span>;
}

export default function CheckoutClient({ order: initialOrder, providers: initialProviders, payments: initialPayments, latestPayment }: Props) {
  const [order, setOrder] = useState(initialOrder);
  const [payments, setPayments] = useState(initialPayments);
  const [providers] = useState(initialProviders);
  const [selected, setSelected] = useState<string | null>(latestPayment?.provider || null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const pendingZelle = payments.find((payment) => payment.provider === "zelle" && payment.status === "pending_verification");
  const zelleProvider = providers.find((provider) => provider.provider_name === "zelle");

  const providerMap = useMemo(() => new Map(providers.map((provider) => [provider.provider_name, provider])), [providers]);

  async function refreshCheckout() {
    const response = await fetch(`/api/checkout/${order.checkout_token}`, { cache: "no-store" });
    const data = await response.json();
    setOrder(data.order);
    setPayments(data.payments);
  }

  async function submitZelle() {
    if (!confirm("Please confirm that you have sent the payment.")) return;
    setLoading(true);
    setNotice("");
    const response = await fetch(`/api/checkout/${order.checkout_token}/zelle/submit`, { method: "POST" });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setNotice(data.error || "Unable to submit Zelle payment.");
      return;
    }
    setNotice("Payment submitted. We are verifying your Zelle payment.");
    await refreshCheckout();
  }

  async function cancelZelle() {
    setLoading(true);
    setNotice("");
    const response = await fetch(`/api/checkout/${order.checkout_token}/zelle/cancel`, { method: "POST" });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setNotice(data.error || "Unable to cancel Zelle payment.");
      return;
    }
    setNotice("Zelle payment request cancelled. You may choose another method.");
    await refreshCheckout();
  }

  async function createPayPalOrder() {
    setLoading(true);
    setNotice("");
    const response = await fetch("/api/payments/paypal/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkoutToken: order.checkout_token }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setNotice(data.error || "Unable to create PayPal order.");
      return;
    }
    const approvalUrl = data.approvalUrl;
    if (approvalUrl) {
      window.location.href = approvalUrl;
      return;
    }
    setNotice(`PayPal order created: ${data.paypalOrderId}. Capture it after buyer approval.`);
  }

  async function captureReturnedPayPalOrder(paypalOrderId: string) {
    setLoading(true);
    setNotice("Confirming your PayPal payment...");
    const response = await fetch("/api/payments/paypal/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkoutToken: order.checkout_token, paypalOrderId }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setNotice(data.error || "Unable to confirm PayPal payment.");
      return;
    }
    setNotice("Payment completed. Thank you.");
    await refreshCheckout();
  }

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const paypalOrderId = query.get("token");
    if (query.get("paypal") === "approved" && paypalOrderId && order.payment_status !== "paid") {
      window.setTimeout(() => {
        void captureReturnedPayPalOrder(paypalOrderId);
      }, 0);
    }
    if (query.get("paypal") === "cancelled") {
      window.setTimeout(() => {
        setNotice("PayPal payment was cancelled. You can choose another payment method.");
      }, 0);
    }
    // Run only once on page load; the checkout token/order is stable for this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paid = order.payment_status === "paid";
  const noProviders = providers.length === 0;

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <header className="border-b border-[#d2d2d7] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-sm font-semibold tracking-[0.28em]">
            VIPSUI
          </Link>
          <Link href={`/tracking/${order.order_number}`} className="text-sm font-medium text-[#0066cc]">
            Track Order
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:py-12">
        <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-[#d2d2d7]/70 sm:p-8">
          <p className="text-sm font-medium text-[#6e6e73]">Secure Checkout</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Review your order.</h1>
          <p className="mt-3 text-sm text-[#6e6e73]">Order Number: {order.order_number}</p>

          <div className="mt-8 space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="grid grid-cols-[86px_1fr_auto] gap-4 rounded-3xl border border-[#d2d2d7] p-3">
                <img src={item.image} alt={item.name} className="h-24 w-20 rounded-2xl object-cover" loading="lazy" />
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-sm text-[#6e6e73]">{item.product_number}</p>
                  <p className="mt-1 text-sm text-[#6e6e73]">{item.specs}</p>
                  <p className="mt-2 text-sm">Qty {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold">{formatMoney(item.unit_price * item.quantity, order.currency)}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-5">
          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-[#d2d2d7]/70 sm:p-6">
            <h2 className="text-xl font-semibold">Order Summary</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#6e6e73]">Subtotal</span>
                <span>{formatMoney(order.subtotal, order.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6e6e73]">Shipping</span>
                <span>{formatMoney(order.shipping, order.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6e6e73]">Discount</span>
                <span>-{formatMoney(order.discount, order.currency)}</span>
              </div>
              <div className="border-t border-[#d2d2d7] pt-4 text-lg font-semibold">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span>{formatMoney(order.total, order.currency)}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-[#d2d2d7]/70 sm:p-6">
            {paid ? (
              <div>
                <p className="text-sm font-medium text-[#10893e]">Payment Completed</p>
                <h2 className="mt-2 text-2xl font-semibold">Thank you.</h2>
                <p className="mt-3 text-sm text-[#6e6e73]">Your payment has been confirmed. You can track your order any time.</p>
                <Link href={`/tracking/${order.order_number}`} className="mt-5 inline-flex rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white">
                  Track Order
                </Link>
              </div>
            ) : pendingZelle ? (
              <div>
                <p className="text-sm font-medium text-[#b89b5e]">Payment Submitted</p>
                <h2 className="mt-2 text-2xl font-semibold">We are verifying your Zelle payment.</h2>
                <div className="mt-5 rounded-3xl bg-[#f5f5f7] p-4 text-sm">
                  <p>Order Number: {order.order_number}</p>
                  <p className="mt-2">Payment Status: Pending Verification</p>
                </div>
                <Link href={`/tracking/${order.order_number}`} className="mt-5 inline-flex rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white">
                  Tracking Link
                </Link>
                <button type="button" onClick={cancelZelle} disabled={loading} className="ml-3 mt-5 inline-flex rounded-full border border-[#d2d2d7] px-5 py-3 text-sm font-semibold">
                  Cancel Zelle Payment Request
                </button>
              </div>
            ) : noProviders ? (
              <div>
                <h2 className="text-2xl font-semibold">No payment methods are available.</h2>
                <p className="mt-3 text-sm text-[#6e6e73]">Please contact us on WhatsApp and we will help you complete this order.</p>
                <a href="https://wa.me/8617336648172" className="mt-5 inline-flex rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white">
                  Contact on WhatsApp
                </a>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-semibold">Choose Payment Method</h2>
                <div className="mt-5 grid gap-3">
                  {providers.map((provider) => (
                    <button
                      key={provider.provider_name}
                      type="button"
                      onClick={() => setSelected(provider.provider_name)}
                      className={`flex items-center gap-4 rounded-3xl border p-4 text-left transition ${
                        selected === provider.provider_name ? "border-[#1d1d1f] bg-[#f5f5f7]" : "border-[#d2d2d7] hover:border-[#86868b]"
                      }`}
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white ring-1 ring-[#d2d2d7]">
                        <ProviderIcon provider={provider.provider_name} />
                      </span>
                      <span>
                        <span className="block font-semibold">{provider.display_name}</span>
                        <span className="mt-1 block text-sm text-[#6e6e73]">{provider.description}</span>
                      </span>
                    </button>
                  ))}
                </div>

                {selected === "paypal" && (
                  <div className="mt-5 rounded-3xl bg-[#f5f5f7] p-5">
                    <h3 className="font-semibold">PayPal</h3>
                    <p className="mt-2 text-sm text-[#6e6e73]">{providerMap.get("paypal")?.payment_instructions}</p>
                    <button type="button" onClick={createPayPalOrder} disabled={loading} className="mt-4 w-full rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white">
                      Continue with PayPal
                    </button>
                  </div>
                )}

                {selected === "stripe" && (
                  <div className="mt-5 rounded-3xl bg-[#f5f5f7] p-5">
                    <h3 className="font-semibold">Credit / Debit Card</h3>
                    <p className="mt-2 text-sm text-[#6e6e73]">Card support is provider-ready and will use a certified PSP such as Stripe or Airwallex. VIPSUI never stores card numbers or CVV.</p>
                    <p className="mt-4 rounded-2xl bg-white p-3 text-sm text-[#6e6e73]">Card gateway is not enabled for this checkout yet.</p>
                  </div>
                )}

                {selected === "zelle" && zelleProvider && (
                  <div className="mt-5 rounded-3xl bg-[#f5f5f7] p-5">
                    <h3 className="text-lg font-semibold">Pay with Zelle</h3>
                    <div className="mt-4 grid gap-3 text-sm">
                      <p className="rounded-2xl bg-white p-3">
                        <span className="block text-[#6e6e73]">Exact Amount</span>
                        <span className="font-semibold">{formatMoney(order.total, order.currency)}</span>
                      </p>
                      <p className="rounded-2xl bg-white p-3">
                        <span className="block text-[#6e6e73]">Order Number</span>
                        <span className="font-semibold">{order.order_number}</span>
                      </p>
                      <div className="rounded-2xl bg-white p-3">
                        <span className="block text-[#6e6e73]">Recipient</span>
                        <span className="font-semibold">{String(zelleProvider.public_config.recipient_name || "VIPSUI")}</span>
                        {zelleProvider.public_config.show_email && <span className="mt-1 block">{String(zelleProvider.public_config.recipient_email)}</span>}
                        {zelleProvider.public_config.show_phone && <span className="mt-1 block">{String(zelleProvider.public_config.recipient_phone)}</span>}
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-[#6e6e73]">{String(zelleProvider.public_config.customer_message)}</p>
                    <button type="button" onClick={submitZelle} disabled={loading} className="mt-5 w-full rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white">
                      I Have Sent Payment
                    </button>
                  </div>
                )}
              </div>
            )}
            {notice && <p className="mt-4 rounded-2xl bg-[#fff8e5] p-3 text-sm text-[#6e5a21]">{notice}</p>}
          </section>
        </aside>
      </section>
    </main>
  );
}
