import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import OrderPaymentClient from "./OrderPaymentClient";
import { getAdminUserFromCookie } from "@/app/lib/admin-auth";
import { databaseEnabled } from "@/app/lib/db/prisma";
import { getOrderById, listPaymentAuditLogs, listPaymentsForOrder } from "@/app/lib/payments/service";

export const dynamic = "force-dynamic";

export default async function AdminOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const admin = await getAdminUserFromCookie();
  if (databaseEnabled && !admin) redirect(`/admin/login?next=/admin/orders/${orderId}`);
  const order = await getOrderById(orderId);
  if (!order) notFound();

  return (
    <OrderPaymentClient
      order={order}
      payments={await listPaymentsForOrder(order.id)}
      auditLogs={await listPaymentAuditLogs(order.id)}
      adminLoggedIn={Boolean(admin)}
      databaseEnabled={databaseEnabled}
    />
  );
}
