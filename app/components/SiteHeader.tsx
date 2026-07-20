"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { displayLabel, pathKey, topNavigationCategories } from "../data/display";

type CategoryNode = ReturnType<typeof topNavigationCategories>[number];

function categoryHref(category: CategoryNode, child?: CategoryNode) {
  const path = child?.path || category.path;
  return `/shop?category=${encodeURIComponent(pathKey(path))}`;
}

export default function SiteHeader() {
  const categories = useMemo(() => topNavigationCategories(), []);
  const shoppingCategories = categories.slice(0, 6);
  const accessoryCategories = categories.slice(6);
  const [active, setActive] = useState<CategoryNode | null>(null);
  const [accessoriesOpen, setAccessoriesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeCategory = active || categories[0];

  return (
    <header className="sticky top-0 z-50 border-b border-[#d2d2d7]/70 bg-white/82 text-[#1d1d1f] backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-sm font-semibold tracking-[0.28em]">
          VIPSUI
        </Link>

        <div className="hidden h-full items-center gap-1 md:flex">
          <Link href="/shop?sort=new" className="rounded-full px-3 py-2 text-sm text-[#424245] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">
            New Arrivals
          </Link>
          {shoppingCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onMouseEnter={() => {
                setAccessoriesOpen(false);
                setActive(category);
              }}
              onFocus={() => {
                setAccessoriesOpen(false);
                setActive(category);
              }}
              onClick={() => {
                setAccessoriesOpen(false);
                setActive(active?.id === category.id ? null : category);
              }}
              className="rounded-full px-3 py-2 text-sm text-[#424245] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
            >
              {displayLabel(category.name)}
            </button>
          ))}
          <button
            type="button"
            onMouseEnter={() => {
              setActive(null);
              setAccessoriesOpen(true);
            }}
            onFocus={() => {
              setActive(null);
              setAccessoriesOpen(true);
            }}
            onClick={() => {
              setActive(null);
              setAccessoriesOpen((value) => !value);
            }}
            className="rounded-full px-3 py-2 text-sm text-[#424245] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
          >
            Accessories
          </button>
          <Link href="/shop" className="rounded-full px-3 py-2 text-sm text-[#424245] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">
            Search
          </Link>
        </div>

        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-label="Open navigation"
          onClick={() => setMobileOpen((value) => !value)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d2d2d7] text-lg md:hidden"
        >
          {mobileOpen ? "×" : "≡"}
        </button>
      </nav>

      <div onMouseLeave={() => setActive(null)} className={active ? "border-t border-[#d2d2d7]/70 bg-[#fbfbfd]/96 backdrop-blur-xl" : "hidden"}>
        {active && activeCategory && (
          <div className="mx-auto hidden max-w-7xl gap-10 px-6 py-8 md:grid md:grid-cols-[0.28fr_1fr] lg:px-8">
            <div>
              <p className="text-xs font-medium uppercase text-[#6e6e73]">Shop</p>
              <Link href={categoryHref(activeCategory)} className="mt-3 block text-3xl font-semibold hover:text-[#b89b5e]">
                {displayLabel(activeCategory.name)}
              </Link>
              <Link href={categoryHref(activeCategory)} className="mt-5 inline-flex text-sm font-medium text-[#0066cc] hover:underline">
                View All
              </Link>
            </div>

            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              {(activeCategory.children || []).slice(0, 24).map((child) => (
                <Link
                  key={`${activeCategory.id}-${child.id}`}
                  href={categoryHref(activeCategory, child)}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-[#1d1d1f] transition hover:bg-white hover:text-[#b89b5e]"
                >
                  {displayLabel(child.name)}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div onMouseLeave={() => setAccessoriesOpen(false)} className={accessoriesOpen ? "border-t border-[#d2d2d7]/70 bg-[#fbfbfd]/96 backdrop-blur-xl" : "hidden"}>
        <div className="mx-auto hidden max-w-7xl gap-10 px-6 py-8 md:grid md:grid-cols-[0.28fr_1fr] lg:px-8">
          <div>
            <p className="text-xs font-medium uppercase text-[#6e6e73]">Shop</p>
            <Link href="/shop?search=accessories" className="mt-3 block text-3xl font-semibold hover:text-[#b89b5e]">
              Accessories
            </Link>
          </div>
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {accessoryCategories.map((category) => (
              <Link key={category.id} href={categoryHref(category)} className="rounded-xl px-3 py-2 text-sm font-medium text-[#1d1d1f] transition hover:bg-white hover:text-[#b89b5e]">
                {displayLabel(category.name)}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#d2d2d7] bg-[#fbfbfd] px-4 py-4 md:hidden">
          <div className="space-y-2">
            <Link onClick={() => setMobileOpen(false)} href="/shop?sort=new" className="block rounded-2xl bg-white px-4 py-4 text-base font-semibold">
              New Arrivals
            </Link>
            {shoppingCategories.map((category) => (
              <details key={category.id} className="rounded-2xl bg-white">
                <summary className="cursor-pointer list-none px-4 py-4 text-base font-semibold">{displayLabel(category.name)}</summary>
                <div className="grid gap-1 border-t border-[#f5f5f7] px-4 py-3">
                  <Link onClick={() => setMobileOpen(false)} href={categoryHref(category)} className="py-2 text-sm font-medium text-[#0066cc]">
                    View All {displayLabel(category.name)}
                  </Link>
                  {(category.children || []).slice(0, 32).map((child) => (
                    <Link key={child.id} onClick={() => setMobileOpen(false)} href={categoryHref(category, child)} className="py-2 text-sm text-[#424245]">
                      {displayLabel(child.name)}
                    </Link>
                  ))}
                </div>
              </details>
            ))}
            <details className="rounded-2xl bg-white">
              <summary className="cursor-pointer list-none px-4 py-4 text-base font-semibold">Accessories</summary>
              <div className="grid gap-1 border-t border-[#f5f5f7] px-4 py-3">
                {accessoryCategories.map((category) => (
                  <Link key={category.id} onClick={() => setMobileOpen(false)} href={categoryHref(category)} className="py-2 text-sm text-[#424245]">
                    {displayLabel(category.name)}
                  </Link>
                ))}
              </div>
            </details>
            <Link onClick={() => setMobileOpen(false)} href="/shop" className="block rounded-2xl bg-white px-4 py-4 text-base font-semibold">
              Search
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
