import { Suspense } from "react";
import ShopClient from "./ShopClient";

export default function ShopPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f5f5f7]" />}>
      <ShopClient />
    </Suspense>
  );
}
