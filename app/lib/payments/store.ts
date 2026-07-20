import { catalogProducts } from "@/app/data/catalog";
import { defaultPaymentProviders, getProviderDisplayOrder, providerAvailableForCountry } from "./providers";
import type { DashboardPaymentStats, Payment, PaymentAuditLog, PaymentProvider, PaymentProviderName, PaymentStatus, QuickOrder } from "./types";

type PaymentState = {
  providers: PaymentProvider[];
  orders: QuickOrder[];
  payments: Payment[];
  auditLogs: PaymentAuditLog[];
  processedWebhookIds: Set<string>;
};

const stateKey = "__vipsui_payment_state__";

function getGlobalState(): PaymentState {
  const globalStore = globalThis as typeof globalThis & { [stateKey]?: PaymentState };
  if (!globalStore[stateKey]) {
    globalStore[stateKey] = seedState();
  }
  return globalStore[stateKey];
}

function isoNow() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function seedState(): PaymentState {
  const sample = catalogProducts[0];
  const second = catalogProducts[1] || sample;
  const createdAt = isoNow();
  const order: QuickOrder = {
    id: "qo_demo_001",
    order_number: "VP-20260720-DEMO01",
    checkout_token: "demo-checkout",
    customer: {
      id: "cus_demo_001",
      name: "Demo Customer",
      country: "United States",
      whatsapp: "+8617336648172",
    },
    items: [
      {
        id: "item_demo_001",
        product_id: sample?.albumId,
        image: sample?.coverImage || "/placeholder.png",
        name: sample?.brand ? `${sample.brand} ${sample.collection}` : "Curated VIPSUI Item",
        product_number: sample?.productNumber || "VP-DEMO-001",
        specs: sample?.size || "Selected item",
        quantity: 1,
        unit_price: 95,
      },
      {
        id: "item_demo_002",
        product_id: second?.albumId,
        image: second?.coverImage || sample?.coverImage || "/placeholder.png",
        name: second?.brand ? `${second.brand} ${second.collection}` : "Curated VIPSUI Item",
        product_number: second?.productNumber || "VP-DEMO-002",
        specs: second?.size || "Selected item",
        quantity: 1,
        unit_price: 120,
      },
    ],
    subtotal: 215,
    shipping: 0,
    discount: 0,
    total: 215,
    currency: "USD",
    payment_status: "unpaid",
    order_status: "awaiting_payment",
    created_at: createdAt,
    updated_at: createdAt,
  };

  return {
    providers: defaultPaymentProviders().sort((a, b) => getProviderDisplayOrder(a.provider_name) - getProviderDisplayOrder(b.provider_name)),
    orders: [order],
    payments: [],
    auditLogs: [],
    processedWebhookIds: new Set(),
  };
}

export function listPaymentProviders() {
  return getGlobalState().providers;
}

export function listEnabledProvidersForOrder(order: QuickOrder) {
  return listPaymentProviders().filter((provider) => provider.enabled && providerAvailableForCountry(provider, order.customer.country));
}

export function updateProvider(providerName: PaymentProviderName, updates: Partial<Pick<PaymentProvider, "enabled" | "display_name" | "description" | "payment_instructions" | "allowed_countries">>) {
  const state = getGlobalState();
  const provider = state.providers.find((item) => item.provider_name === providerName);
  if (!provider) return null;
  Object.assign(provider, updates, { updated_at: isoNow() });
  return provider;
}

export function getOrderByToken(token: string) {
  return getGlobalState().orders.find((order) => order.checkout_token === token) || null;
}

export function getOrderById(orderId: string) {
  return getGlobalState().orders.find((order) => order.id === orderId) || null;
}

export function listOrders() {
  return getGlobalState().orders;
}

export function listPaymentsForOrder(orderId: string) {
  return getGlobalState().payments.filter((payment) => payment.order_id === orderId);
}

export function getLatestPaymentForOrder(orderId: string) {
  return listPaymentsForOrder(orderId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null;
}

export function findPendingZellePayment(orderId: string) {
  return getGlobalState().payments.find((payment) => payment.order_id === orderId && payment.provider === "zelle" && payment.status === "pending_verification") || null;
}

export function createPayment(input: {
  orderId: string;
  provider: PaymentProviderName;
  paymentMethod: string;
  amount: number;
  currency: "USD";
  status: PaymentStatus;
  manualVerificationRequired: boolean;
  providerOrderId?: string;
  providerPaymentId?: string;
  metadata?: Record<string, unknown>;
}) {
  const state = getGlobalState();
  const now = isoNow();
  const existing = state.payments.find(
    (payment) =>
      payment.order_id === input.orderId &&
      payment.provider === input.provider &&
      payment.provider_order_id &&
      payment.provider_order_id === input.providerOrderId,
  );
  if (existing) return existing;

  const payment: Payment = {
    id: id("pay"),
    order_id: input.orderId,
    provider: input.provider,
    provider_order_id: input.providerOrderId,
    provider_payment_id: input.providerPaymentId,
    payment_method: input.paymentMethod,
    amount: input.amount,
    currency: input.currency,
    status: input.status,
    manual_verification_required: input.manualVerificationRequired,
    submitted_at: input.status === "pending_verification" ? now : undefined,
    metadata: input.metadata || {},
    created_at: now,
    updated_at: now,
  };
  state.payments.push(payment);
  return payment;
}

export function submitZellePayment(orderId: string) {
  const state = getGlobalState();
  const order = getOrderById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.payment_status === "paid") throw new Error("This order has already been paid.");
  const existing = findPendingZellePayment(order.id);
  if (existing) return existing;

  const payment = createPayment({
    orderId: order.id,
    provider: "zelle",
    paymentMethod: "Zelle Manual Payment",
    amount: order.total,
    currency: order.currency,
    status: "pending_verification",
    manualVerificationRequired: true,
    metadata: {
      order_number: order.order_number,
    },
  });
  order.payment_status = "pending";
  order.order_status = "awaiting_payment";
  order.updated_at = isoNow();
  state.auditLogs.push({
    id: id("audit"),
    payment_id: payment.id,
    order_id: order.id,
    action: "submitted_zelle_payment",
    performed_by: "customer",
    previous_status: "created",
    new_status: payment.status,
    notes: "Customer confirmed they sent the Zelle payment.",
    created_at: isoNow(),
  });
  return payment;
}

export function cancelPendingZelle(orderId: string) {
  const order = getOrderById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.payment_status === "paid") throw new Error("Paid orders cannot be changed.");
  const payment = findPendingZellePayment(orderId);
  if (!payment) return null;
  updatePaymentStatus(payment.id, "rejected", "customer", "Customer cancelled pending Zelle payment request.", "cancelled_zelle_payment");
  order.payment_status = "unpaid";
  order.updated_at = isoNow();
  return payment;
}

export function updatePaymentStatus(paymentId: string, newStatus: PaymentStatus, performedBy: string, notes: string, action = "updated_payment") {
  const state = getGlobalState();
  const payment = state.payments.find((item) => item.id === paymentId);
  if (!payment) throw new Error("Payment not found");
  const order = getOrderById(payment.order_id);
  if (!order) throw new Error("Order not found");
  const previous = payment.status;
  payment.status = newStatus;
  payment.updated_at = isoNow();
  if (newStatus === "completed") {
    payment.verified_at = isoNow();
    payment.verified_by = performedBy;
    order.payment_status = "paid";
    order.order_status = "paid";
    order.paid_at = isoNow();
  }
  if (newStatus === "failed" || newStatus === "rejected") {
    order.payment_status = "unpaid";
    order.order_status = "awaiting_payment";
  }
  order.updated_at = isoNow();
  state.auditLogs.push({
    id: id("audit"),
    payment_id: payment.id,
    order_id: order.id,
    action,
    performed_by: performedBy,
    previous_status: previous,
    new_status: newStatus,
    notes,
    created_at: isoNow(),
  });
  return payment;
}

export function markPayPalCompleted(orderId: string, paypalOrderId: string, captureId: string, amount: number, currency: "USD", metadata: Record<string, unknown>) {
  const order = getOrderById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.payment_status === "paid") return getLatestPaymentForOrder(order.id);
  if (amount !== order.total || currency !== order.currency) throw new Error("PayPal amount validation failed.");
  const payment = createPayment({
    orderId: order.id,
    provider: "paypal",
    paymentMethod: "PayPal",
    amount,
    currency,
    status: "processing",
    manualVerificationRequired: false,
    providerOrderId: paypalOrderId,
    providerPaymentId: captureId,
    metadata,
  });
  return updatePaymentStatus(payment.id, "completed", "paypal", "PayPal capture verified server-side.", "captured_paypal_payment");
}

export function listPaymentAuditLogs(orderId?: string) {
  const logs = getGlobalState().auditLogs;
  return orderId ? logs.filter((log) => log.order_id === orderId) : logs;
}

export function hasProcessedWebhook(eventId: string) {
  return getGlobalState().processedWebhookIds.has(eventId);
}

export function rememberWebhook(eventId: string) {
  getGlobalState().processedWebhookIds.add(eventId);
}

export function getPaymentStats(): DashboardPaymentStats {
  const payments = getGlobalState().payments;
  const today = new Date().toISOString().slice(0, 10);
  const completed = payments.filter((payment) => payment.status === "completed");
  const revenueFor = (provider: string) => completed.filter((payment) => payment.provider === provider).reduce((sum, payment) => sum + payment.amount, 0);
  const providerNames = Array.from(new Set(payments.map((payment) => payment.provider)));

  return {
    pendingPayments: payments.filter((payment) => payment.status === "pending" || payment.status === "pending_verification" || payment.status === "processing").length,
    pendingZelleVerification: payments.filter((payment) => payment.provider === "zelle" && payment.status === "pending_verification").length,
    paidToday: completed.filter((payment) => (payment.verified_at || payment.updated_at).slice(0, 10) === today).length,
    paypalRevenue: revenueFor("paypal"),
    zelleRevenue: revenueFor("zelle"),
    cardRevenue: revenueFor("stripe"),
    methodDistribution: providerNames.map((provider) => ({
      provider,
      count: payments.filter((payment) => payment.provider === provider).length,
      revenue: revenueFor(provider),
    })),
  };
}

export function checkoutWhatsAppMessage(checkoutUrl: string) {
  return `Hi! I've created a secure checkout link for your order.

You can review your item and choose your preferred payment method here:

${checkoutUrl}

Available payment methods may include PayPal, credit/debit card, and Zelle.

After payment is confirmed, you will receive your order and tracking updates.`;
}
