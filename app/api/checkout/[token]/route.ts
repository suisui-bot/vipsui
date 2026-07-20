import { NextResponse } from "next/server";
import { getLatestPaymentForOrder, getOrderByToken, listEnabledProvidersForOrder, listPaymentsForOrder } from "@/app/lib/payments/service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  return NextResponse.json({
    order,
    providers: await listEnabledProvidersForOrder(order),
    payments: await listPaymentsForOrder(order.id),
    latestPayment: await getLatestPaymentForOrder(order.id),
  });
}
