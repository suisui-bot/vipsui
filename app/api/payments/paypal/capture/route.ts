import { NextResponse } from "next/server";
import { capturePayPalOrder } from "@/app/lib/payments/paypal";
import { getOrderByToken, markPayPalCompleted } from "@/app/lib/payments/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { checkoutToken, paypalOrderId } = (await request.json()) as { checkoutToken?: string; paypalOrderId?: string };
    if (!checkoutToken || !paypalOrderId) return NextResponse.json({ error: "Missing checkout token or PayPal order ID" }, { status: 400 });
    const order = await getOrderByToken(checkoutToken);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.payment_status === "paid") return NextResponse.json({ message: "Order already paid" });

    const capture = await capturePayPalOrder(paypalOrderId, `${order.id}:paypal:capture:${paypalOrderId}`);
    const captureRecord = capture.purchase_units?.[0]?.payments?.captures?.[0];
    if (!captureRecord || captureRecord.status !== "COMPLETED") {
      return NextResponse.json({ error: "PayPal capture was not completed." }, { status: 400 });
    }
    const payment = await markPayPalCompleted(
      order.id,
      paypalOrderId,
      captureRecord.id,
      Number(captureRecord.amount.value),
      captureRecord.amount.currency_code,
      capture,
    );
    return NextResponse.json({ payment });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to capture PayPal order" }, { status: 400 });
  }
}
