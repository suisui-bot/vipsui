import { NextResponse } from "next/server";
import { logoutAdmin } from "@/app/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await logoutAdmin();
  return NextResponse.redirect(new URL("/admin/login", request.url));
}
