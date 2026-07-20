import { NextRequest, NextResponse } from "next/server";
import { assertAdminApiRequest } from "@/app/lib/admin-auth";
import { getOrderById, updatePaymentStatus } from "@/app/lib/payments/service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string; paymentId: string }> }) {
  try {
    const admin = await assertAdminApiRequest(request);
    const { orderId, paymentId } = await params;
    const order = await getOrderById(orderId);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const payment = await updatePaymentStatus(
      paymentId,
      "completed",
      admin,
      "Admin verified the Zelle payment in the bank account.",
      "confirmed_payment",
    );
    return NextResponse.json({ payment });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to confirm payment" }, { status: 401 });
  }
}
