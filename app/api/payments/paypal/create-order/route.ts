import { NextResponse } from "next/server";
import { createPayPalOrder } from "@/app/lib/payments/paypal";
import { createPayment, findPendingZellePayment, getOrderByToken, listEnabledProvidersForOrder } from "@/app/lib/payments/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { checkoutToken } = (await request.json()) as { checkoutToken?: string };
    if (!checkoutToken) return NextResponse.json({ error: "Missing checkout token" }, { status: 400 });
    const order = await getOrderByToken(checkoutToken);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.payment_status === "paid") return NextResponse.json({ error: "This order is already paid." }, { status: 409 });
    if (await findPendingZellePayment(order.id)) {
      return NextResponse.json({ error: "A Zelle payment is currently pending verification. Cancel it before choosing PayPal." }, { status: 409 });
    }
    const paypalEnabled = (await listEnabledProvidersForOrder(order)).some((provider) => provider.provider_name === "paypal");
    if (!paypalEnabled) return NextResponse.json({ error: "PayPal is not enabled for this order." }, { status: 400 });

    const paypalOrder = await createPayPalOrder(order.order_number, order.total, order.currency, `${order.id}:paypal:create`, order.checkout_token);
    const payment = await createPayment({
      orderId: order.id,
      provider: "paypal",
      paymentMethod: "PayPal",
      amount: order.total,
      currency: order.currency,
      status: "created",
      manualVerificationRequired: false,
      providerOrderId: paypalOrder.id,
      metadata: paypalOrder,
    });
    const approvalUrl = paypalOrder.links?.find((link) => link.rel === "approve")?.href;
    return NextResponse.json({ paypalOrderId: paypalOrder.id, approvalUrl, payment });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create PayPal order" }, { status: 400 });
  }
}
