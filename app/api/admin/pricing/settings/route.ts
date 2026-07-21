import { NextRequest, NextResponse } from "next/server";
import { assertAdminApiRequest } from "@/app/lib/admin-auth";
import { getPricingSettings, updatePricingSettings } from "@/app/lib/pricing/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ settings: await getPricingSettings() });
}

export async function PATCH(request: NextRequest) {
  try {
    await assertAdminApiRequest(request);
    const settings = await updatePricingSettings(await request.json());
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update pricing settings" }, { status: 401 });
  }
}
