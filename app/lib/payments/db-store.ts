import { catalogProducts } from "@/app/data/catalog";
import type { Prisma } from "@prisma/client";
import { databaseEnabled, prisma } from "@/app/lib/db/prisma";
import { randomId } from "@/app/lib/admin-auth";
import { defaultPaymentProviders, getProviderDisplayOrder, providerAvailableForCountry } from "./providers";
import type { DashboardPaymentStats, Payment, PaymentAuditLog, PaymentProvider, PaymentProviderName, PaymentStatus, QuickOrder } from "./types";

type DbOrder = Awaited<ReturnType<typeof prisma.quickOrder.findFirst>> & {
  customer?: Awaited<ReturnType<typeof prisma.customer.findFirst>>;
  items?: Awaited<ReturnType<typeof prisma.orderItem.findMany>>;
};

function toDateString(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : undefined;
}

function toProvider(row: {
  providerName: string;
  providerType: string;
  enabled: boolean;
  displayName: string;
  description: string;
  paymentInstructions: string;
  supportsAutoConfirmation: boolean;
  supportsRefund: boolean;
  supportsWebhook: boolean;
  environment: string;
  configurationStatus: string;
  allowedCountries: unknown;
  publicConfig: unknown;
  secretPreview: unknown;
  createdAt: Date;
  updatedAt: Date;
}): PaymentProvider {
  return {
    provider_name: row.providerName as PaymentProviderName,
    provider_type: row.providerType as PaymentProvider["provider_type"],
    enabled: row.enabled,
    display_name: row.displayName,
    description: row.description,
    payment_instructions: row.paymentInstructions,
    supports_auto_confirmation: row.supportsAutoConfirmation,
    supports_refund: row.supportsRefund,
    supports_webhook: row.supportsWebhook,
    environment: row.environment as PaymentProvider["environment"],
    configuration_status: row.configurationStatus as PaymentProvider["configuration_status"],
    allowed_countries: Array.isArray(row.allowedCountries) ? (row.allowedCountries as string[]) : ["ALL"],
    public_config: (row.publicConfig || {}) as PaymentProvider["public_config"],
    secret_preview: (row.secretPreview || undefined) as PaymentProvider["secret_preview"],
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function toPayment(row: {
  id: string;
  orderId: string;
  provider: string;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  paymentMethod: string;
  amount: number;
  currency: string;
  status: string;
  manualVerificationRequired: boolean;
  submittedAt: Date | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  failedReason: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): Payment {
  return {
    id: row.id,
    order_id: row.orderId,
    provider: row.provider as PaymentProviderName,
    provider_payment_id: row.providerPaymentId || undefined,
    provider_order_id: row.providerOrderId || undefined,
    payment_method: row.paymentMethod,
    amount: row.amount,
    currency: row.currency as "USD",
    status: row.status as PaymentStatus,
    manual_verification_required: row.manualVerificationRequired,
    submitted_at: toDateString(row.submittedAt),
    verified_at: toDateString(row.verifiedAt),
    verified_by: row.verifiedBy || undefined,
    failed_reason: row.failedReason || undefined,
    metadata: (row.metadata || {}) as Record<string, unknown>,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function toOrder(row: NonNullable<DbOrder>): QuickOrder {
  if (!row.customer || !row.items) throw new Error("Order query must include customer and items.");
  return {
    id: row.id,
    order_number: row.orderNumber,
    checkout_token: row.checkoutToken,
    customer: {
      id: row.customer.id,
      name: row.customer.name,
      country: row.customer.country,
      whatsapp: row.customer.whatsapp || undefined,
      email: row.customer.email || undefined,
    },
    items: row.items.map((item) => ({
      id: item.id,
      product_id: item.productId || undefined,
      image: item.image,
      name: item.name,
      product_number: item.productNumber,
      specs: item.specs,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    })),
    subtotal: row.subtotal,
    shipping: row.shipping,
    discount: row.discount,
    total: row.total,
    currency: row.currency as "USD",
    payment_status: row.paymentStatus as QuickOrder["payment_status"],
    order_status: row.orderStatus as QuickOrder["order_status"],
    paid_at: toDateString(row.paidAt),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

async function ensureProviders() {
  if (!databaseEnabled) return;
  for (const provider of defaultPaymentProviders()) {
    await prisma.paymentProvider.upsert({
      where: { providerName: provider.provider_name },
      update: {
        providerType: provider.provider_type,
        displayName: provider.display_name,
        description: provider.description,
        paymentInstructions: provider.payment_instructions,
        supportsAutoConfirmation: provider.supports_auto_confirmation,
        supportsRefund: provider.supports_refund,
        supportsWebhook: provider.supports_webhook,
        environment: provider.environment,
        configurationStatus: provider.configuration_status,
        allowedCountries: provider.allowed_countries as Prisma.InputJsonValue,
        publicConfig: provider.public_config as Prisma.InputJsonValue,
        secretPreview: (provider.secret_preview || undefined) as Prisma.InputJsonValue | undefined,
      },
      create: {
        providerName: provider.provider_name,
        providerType: provider.provider_type,
        enabled: provider.enabled,
        displayName: provider.display_name,
        description: provider.description,
        paymentInstructions: provider.payment_instructions,
        supportsAutoConfirmation: provider.supports_auto_confirmation,
        supportsRefund: provider.supports_refund,
        supportsWebhook: provider.supports_webhook,
        environment: provider.environment,
        configurationStatus: provider.configuration_status,
        allowedCountries: provider.allowed_countries as Prisma.InputJsonValue,
        publicConfig: provider.public_config as Prisma.InputJsonValue,
        secretPreview: (provider.secret_preview || undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}

export async function ensureDemoOrder() {
  if (!databaseEnabled || process.env.SEED_DEMO_ORDER === "false") return;
  const exists = await prisma.quickOrder.findUnique({ where: { checkoutToken: "demo-checkout" } });
  if (exists) return;
  const sample = catalogProducts[0];
  const second = catalogProducts[1] || sample;
  await prisma.customer.create({
    data: {
      id: "cus_demo_001",
      name: "Demo Customer",
      country: "United States",
      whatsapp: "+8617336648172",
      orders: {
        create: {
          id: "qo_demo_001",
          orderNumber: "VP-20260720-DEMO01",
          checkoutToken: "demo-checkout",
          subtotal: 215,
          shipping: 0,
          discount: 0,
          total: 215,
          currency: "USD",
          paymentStatus: "unpaid",
          orderStatus: "awaiting_payment",
          items: {
            create: [
              {
                id: "item_demo_001",
                productId: sample?.albumId,
                image: sample?.coverImage || "/placeholder.png",
                name: sample?.brand ? `${sample.brand} ${sample.collection}` : "Curated VIPSUI Item",
                productNumber: sample?.productNumber || "VP-DEMO-001",
                specs: sample?.size || "Selected item",
                quantity: 1,
                unitPrice: 95,
              },
              {
                id: "item_demo_002",
                productId: second?.albumId,
                image: second?.coverImage || sample?.coverImage || "/placeholder.png",
                name: second?.brand ? `${second.brand} ${second.collection}` : "Curated VIPSUI Item",
                productNumber: second?.productNumber || "VP-DEMO-002",
                specs: second?.size || "Selected item",
                quantity: 1,
                unitPrice: 120,
              },
            ],
          },
        },
      },
    },
  });
}

export async function listDbPaymentProviders() {
  await ensureProviders();
  const rows = await prisma.paymentProvider.findMany();
  return rows.map(toProvider).sort((a, b) => getProviderDisplayOrder(a.provider_name) - getProviderDisplayOrder(b.provider_name));
}

export async function listDbEnabledProvidersForOrder(order: QuickOrder) {
  const providers = await listDbPaymentProviders();
  return providers.filter((provider) => provider.enabled && providerAvailableForCountry(provider, order.customer.country));
}

export async function updateDbProvider(providerName: PaymentProviderName, updates: Partial<Pick<PaymentProvider, "enabled" | "display_name" | "description" | "payment_instructions" | "allowed_countries">>) {
  const row = await prisma.paymentProvider.update({
    where: { providerName },
    data: {
      enabled: updates.enabled,
      displayName: updates.display_name,
      description: updates.description,
      paymentInstructions: updates.payment_instructions,
      allowedCountries: updates.allowed_countries as Prisma.InputJsonValue | undefined,
    },
  });
  return toProvider(row);
}

export async function getDbOrderByToken(token: string) {
  await ensureDemoOrder();
  const row = await prisma.quickOrder.findUnique({ where: { checkoutToken: token }, include: { customer: true, items: true } });
  return row ? toOrder(row) : null;
}

export async function getDbOrderById(orderId: string) {
  await ensureDemoOrder();
  const row = await prisma.quickOrder.findUnique({ where: { id: orderId }, include: { customer: true, items: true } });
  return row ? toOrder(row) : null;
}

export async function listDbOrders() {
  await ensureDemoOrder();
  const rows = await prisma.quickOrder.findMany({ include: { customer: true, items: true }, orderBy: { createdAt: "desc" }, take: 100 });
  return rows.map(toOrder);
}

export async function listDbPaymentsForOrder(orderId: string) {
  const rows = await prisma.payment.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
  return rows.map(toPayment);
}

export async function getDbLatestPaymentForOrder(orderId: string) {
  const row = await prisma.payment.findFirst({ where: { orderId }, orderBy: { createdAt: "desc" } });
  return row ? toPayment(row) : null;
}

export async function findDbPendingZellePayment(orderId: string) {
  const row = await prisma.payment.findFirst({ where: { orderId, provider: "zelle", status: "pending_verification" } });
  return row ? toPayment(row) : null;
}

export async function createDbPayment(input: {
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
  const existing =
    input.providerOrderId &&
    (await prisma.payment.findFirst({
      where: { provider: input.provider, providerOrderId: input.providerOrderId },
    }));
  if (existing) return toPayment(existing);
  const now = new Date();
  const row = await prisma.payment.create({
    data: {
      id: randomId("pay"),
      orderId: input.orderId,
      provider: input.provider,
      paymentMethod: input.paymentMethod,
      amount: input.amount,
      currency: input.currency,
      status: input.status,
      manualVerificationRequired: input.manualVerificationRequired,
      providerOrderId: input.providerOrderId,
      providerPaymentId: input.providerPaymentId,
      submittedAt: input.status === "pending_verification" ? now : undefined,
      metadata: (input.metadata || {}) as Prisma.InputJsonValue,
    },
  });
  return toPayment(row);
}

export async function submitDbZellePayment(orderId: string) {
  const order = await getDbOrderById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.payment_status === "paid") throw new Error("This order has already been paid.");
  const existing = await findDbPendingZellePayment(order.id);
  if (existing) return existing;
  const payment = await createDbPayment({
    orderId: order.id,
    provider: "zelle",
    paymentMethod: "Zelle Manual Payment",
    amount: order.total,
    currency: order.currency,
    status: "pending_verification",
    manualVerificationRequired: true,
    metadata: { order_number: order.order_number },
  });
  await prisma.quickOrder.update({
    where: { id: order.id },
    data: { paymentStatus: "pending", orderStatus: "awaiting_payment" },
  });
  await prisma.paymentAuditLog.create({
    data: {
      id: randomId("audit"),
      paymentId: payment.id,
      orderId: order.id,
      action: "submitted_zelle_payment",
      performedBy: "customer",
      previousStatus: "created",
      newStatus: payment.status,
      notes: "Customer confirmed they sent the Zelle payment.",
    },
  });
  return payment;
}

export async function cancelDbPendingZelle(orderId: string) {
  const payment = await findDbPendingZellePayment(orderId);
  if (!payment) return null;
  return updateDbPaymentStatus(payment.id, "rejected", "customer", "Customer cancelled pending Zelle payment request.", "cancelled_zelle_payment");
}

export async function updateDbPaymentStatus(paymentId: string, newStatus: PaymentStatus, performedBy: string, notes: string, action = "updated_payment") {
  const existing = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!existing) throw new Error("Payment not found");
  const paid = newStatus === "completed";
  const failed = newStatus === "failed" || newStatus === "rejected";
  const now = new Date();
  const payment = await prisma.$transaction(async (tx) => {
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: newStatus,
        verifiedAt: paid ? now : undefined,
        verifiedBy: paid ? performedBy : undefined,
      },
    });
    if (paid || failed) {
      await tx.quickOrder.update({
        where: { id: existing.orderId },
        data: {
          paymentStatus: paid ? "paid" : "unpaid",
          orderStatus: paid ? "paid" : "awaiting_payment",
          paidAt: paid ? now : undefined,
        },
      });
    }
    await tx.paymentAuditLog.create({
      data: {
        id: randomId("audit"),
        paymentId,
        orderId: existing.orderId,
        action,
        performedBy,
        previousStatus: existing.status,
        newStatus,
        notes,
      },
    });
    return updated;
  });
  return toPayment(payment);
}

export async function markDbPayPalCompleted(orderId: string, paypalOrderId: string, captureId: string, amount: number, currency: "USD", metadata: Record<string, unknown>) {
  const order = await getDbOrderById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.payment_status === "paid") return getDbLatestPaymentForOrder(order.id);
  if (amount !== order.total || currency !== order.currency) throw new Error("PayPal amount validation failed.");
  const payment = await createDbPayment({
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
  return updateDbPaymentStatus(payment.id, "completed", "paypal", "PayPal capture verified server-side.", "captured_paypal_payment");
}

export async function listDbPaymentAuditLogs(orderId?: string) {
  const rows = await prisma.paymentAuditLog.findMany({ where: orderId ? { orderId } : undefined, orderBy: { createdAt: "desc" } });
  return rows.map((row): PaymentAuditLog => ({
    id: row.id,
    payment_id: row.paymentId,
    order_id: row.orderId,
    action: row.action,
    performed_by: row.performedBy,
    previous_status: row.previousStatus as PaymentStatus,
    new_status: row.newStatus as PaymentStatus,
    notes: row.notes || undefined,
    created_at: row.createdAt.toISOString(),
  }));
}

export async function hasDbProcessedWebhook(eventId: string) {
  return Boolean(await prisma.processedWebhook.findUnique({ where: { id: eventId } }));
}

export async function rememberDbWebhook(eventId: string, provider = "paypal", payload?: Record<string, unknown>) {
  await prisma.processedWebhook.upsert({
    where: { id: eventId },
    update: {},
    create: { id: eventId, provider, payload: payload as Prisma.InputJsonValue | undefined },
  });
}

export async function getDbPaymentStats(): Promise<DashboardPaymentStats> {
  const payments = (await prisma.payment.findMany()).map(toPayment);
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
