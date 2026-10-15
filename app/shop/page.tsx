import { Suspense } from "react";
import ShopClient from "./ShopClient";

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f5f5f7]" />}>
      <ShopClient key={JSON.stringify(params)} />
    </Suspense>
  );
}
