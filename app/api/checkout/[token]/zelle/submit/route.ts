import { NextResponse } from "next/server";
import { findPendingZellePayment, getOrderByToken, listEnabledProvidersForOrder, submitZellePayment } from "@/app/lib/payments/service";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const order = await getOrderByToken(token);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.payment_status === "paid") return NextResponse.json({ error: "This order is already paid." }, { status: 409 });
    const zelleEnabled = (await listEnabledProvidersForOrder(order)).some((provider) => provider.provider_name === "zelle");
    if (!zelleEnabled) return NextResponse.json({ error: "Zelle is not available for this order." }, { status: 400 });
    const existing = await findPendingZellePayment(order.id);
    if (existing) return NextResponse.json({ payment: existing });
    const payment = await submitZellePayment(order.id);
    return NextResponse.json({ payment });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit Zelle payment" }, { status: 400 });
  }
}
