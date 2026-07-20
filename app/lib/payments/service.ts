import { databaseEnabled } from "@/app/lib/db/prisma";
import type { PaymentProvider, PaymentProviderName, PaymentStatus, QuickOrder } from "./types";
import * as memory from "./store";
import * as db from "./db-store";

export async function listPaymentProviders() {
  return databaseEnabled ? db.listDbPaymentProviders() : memory.listPaymentProviders();
}

export async function listEnabledProvidersForOrder(order: QuickOrder) {
  return databaseEnabled ? db.listDbEnabledProvidersForOrder(order) : memory.listEnabledProvidersForOrder(order);
}

export async function updateProvider(
  providerName: PaymentProviderName,
  updates: Partial<Pick<PaymentProvider, "enabled" | "display_name" | "description" | "payment_instructions" | "allowed_countries">>,
) {
  return databaseEnabled ? db.updateDbProvider(providerName, updates) : memory.updateProvider(providerName, updates);
}

export async function getOrderByToken(token: string) {
  return databaseEnabled ? db.getDbOrderByToken(token) : memory.getOrderByToken(token);
}

export async function getOrderById(orderId: string) {
  return databaseEnabled ? db.getDbOrderById(orderId) : memory.getOrderById(orderId);
}

export async function listOrders() {
  return databaseEnabled ? db.listDbOrders() : memory.listOrders();
}

export async function listPaymentsForOrder(orderId: string) {
  return databaseEnabled ? db.listDbPaymentsForOrder(orderId) : memory.listPaymentsForOrder(orderId);
}

export async function getLatestPaymentForOrder(orderId: string) {
  return databaseEnabled ? db.getDbLatestPaymentForOrder(orderId) : memory.getLatestPaymentForOrder(orderId);
}

export async function findPendingZellePayment(orderId: string) {
  return databaseEnabled ? db.findDbPendingZellePayment(orderId) : memory.findPendingZellePayment(orderId);
}

export async function createPayment(input: {
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
  return databaseEnabled ? db.createDbPayment(input) : memory.createPayment(input);
}

export async function submitZellePayment(orderId: string) {
  return databaseEnabled ? db.submitDbZellePayment(orderId) : memory.submitZellePayment(orderId);
}

export async function cancelPendingZelle(orderId: string) {
  return databaseEnabled ? db.cancelDbPendingZelle(orderId) : memory.cancelPendingZelle(orderId);
}

export async function updatePaymentStatus(paymentId: string, newStatus: PaymentStatus, performedBy: string, notes: string, action = "updated_payment") {
  return databaseEnabled ? db.updateDbPaymentStatus(paymentId, newStatus, performedBy, notes, action) : memory.updatePaymentStatus(paymentId, newStatus, performedBy, notes, action);
}

export async function markPayPalCompleted(orderId: string, paypalOrderId: string, captureId: string, amount: number, currency: "USD", metadata: Record<string, unknown>) {
  return databaseEnabled ? db.markDbPayPalCompleted(orderId, paypalOrderId, captureId, amount, currency, metadata) : memory.markPayPalCompleted(orderId, paypalOrderId, captureId, amount, currency, metadata);
}

export async function listPaymentAuditLogs(orderId?: string) {
  return databaseEnabled ? db.listDbPaymentAuditLogs(orderId) : memory.listPaymentAuditLogs(orderId);
}

export async function hasProcessedWebhook(eventId: string) {
  return databaseEnabled ? db.hasDbProcessedWebhook(eventId) : memory.hasProcessedWebhook(eventId);
}

export async function rememberWebhook(eventId: string, payload?: Record<string, unknown>) {
  return databaseEnabled ? db.rememberDbWebhook(eventId, "paypal", payload) : memory.rememberWebhook(eventId);
}

export async function getPaymentStats() {
  return databaseEnabled ? db.getDbPaymentStats() : memory.getPaymentStats();
}

export const checkoutWhatsAppMessage = memory.checkoutWhatsAppMessage;
