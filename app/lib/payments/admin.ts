import { NextRequest } from "next/server";

export function assertAdminRequest(request: NextRequest) {
  const configuredKey = process.env.ADMIN_API_KEY;
  const providedKey = request.headers.get("x-admin-key") || "";

  if (configuredKey && providedKey === configuredKey) {
    return process.env.ADMIN_USER || "admin";
  }

  if (!configuredKey && process.env.NODE_ENV !== "production") {
    return "local-admin";
  }

  throw new Error("Admin authorization required.");
}

export function adminLockedMessage() {
  if (process.env.ADMIN_API_KEY) return "";
  return "Set ADMIN_API_KEY in production to enable protected payment verification actions.";
}
