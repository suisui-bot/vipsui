"use client";

import Link from "next/link";
import { useState } from "react";
import type { CatalogProduct } from "../../data/catalog";
import { proxiedImage } from "../../data/catalog";

export default function ProductDetail({ product }: { product: CatalogProduct }) {
  const gallery = product.images.length > 0 ? product.images : [product.cover];
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const activeImage = gallery[activeIndex] ?? product.cover;
  const canMove = gallery.length > 1;

  function showPrevious() {
    setActiveIndex((current) => (current === 0 ? gallery.length - 1 : current - 1));
  }

  function showNext() {
    setActiveIndex((current) => (current === gallery.length - 1 ? 0 : current + 1));
  }

  function handleTouchEnd(x: number) {
    if (touchStart === null || !canMove) {
      setTouchStart(null);
      return;
    }

    const delta = touchStart - x;
    if (Math.abs(delta) > 40) {
      if (delta > 0) {
        showNext();
      } else {
        showPrevious();
      }
    }
    setTouchStart(null);
  }

  return (
    <main className="min-h-screen bg-[#050604] text-[#f7f0df]">
      <header className="border-b border-[#d6b45a]/15 bg-[#050604]/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/#collection" className="text-sm uppercase tracking-[0.24em] text-[#d9d0bd] transition hover:text-[#f5d172]">
            Back to catalog
          </Link>
          <span className="text-lg font-semibold tracking-[0.35em] text-[#f5d172]">VIPSUI</span>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_0.82fr] lg:px-8 lg:py-16">
        <div className="space-y-4">
          <div
            className="group relative aspect-[4/5] overflow-hidden bg-[#0a0d08]"
            onTouchStart={(event) => setTouchStart(event.touches[0]?.clientX ?? null)}
            onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
          >
            <img
              src={proxiedImage(activeImage)}
              alt={product.name}
              className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/38 via-transparent to-transparent" />
            <span className="absolute left-5 top-5 bg-black/60 px-4 py-3 text-xs uppercase tracking-[0.24em] text-[#f5d172] backdrop-blur">
              {activeIndex + 1} / {gallery.length}
            </span>
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              className="absolute bottom-5 left-5 rounded-full bg-black/65 px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white backdrop-blur transition hover:bg-[#d6b45a] hover:text-black"
            >
              Zoom
            </button>
            {canMove && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={showPrevious}
                  className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl text-white backdrop-blur transition hover:bg-[#d6b45a] hover:text-black"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={showNext}
                  className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl text-white backdrop-blur transition hover:bg-[#d6b45a] hover:text-black"
                >
                  ›
                </button>
              </>
            )}
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
            {gallery.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                aria-label={`View ${product.name} image ${index + 1}`}
                onClick={() => setActiveIndex(index)}
                className={`relative h-24 w-24 shrink-0 overflow-hidden border transition sm:h-28 sm:w-28 ${
                  activeIndex === index ? "border-[#d6b45a]" : "border-[#d6b45a]/16 hover:border-[#d6b45a]/55"
                }`}
              >
                <img src={proxiedImage(image)} alt="" loading="lazy" className="h-full w-full object-cover" />
                <span className="absolute bottom-1 right-1 bg-black/65 px-1.5 py-1 text-[0.62rem] text-white">{index + 1}</span>
              </button>
            ))}
          </div>
        </div>

        <aside className="flex flex-col justify-center">
          <p className="text-xs uppercase tracking-[0.54em] text-[#d6b45a]">{product.brand}</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight text-white sm:text-6xl">{product.name}</h1>
          <p className="mt-5 text-xl text-[#f1dfad]">{product.category}</p>
          <p className="mt-6 max-w-xl whitespace-pre-line text-base leading-8 text-[#bcb29d]">{product.description}</p>

          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            <Info label="Album ID" value={product.id} />
            <Info label="Gallery" value={`${gallery.length} images`} />
            <Info label="Size" value={product.size || "See description"} />
            <Info label="Movement" value={product.movement || "See description"} />
          </div>

          {product.specs.length > 0 && (
            <div className="mt-8 border border-[#d6b45a]/18 p-5">
              <p className="mb-4 text-xs uppercase tracking-[0.32em] text-[#d6b45a]">Specifications</p>
              <ul className="space-y-3 text-sm text-[#d9d0bd]">
                {product.specs.map((spec) => (
                  <li key={spec} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d6b45a]" />
                    <span>{spec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={`https://wa.me/8617336648172?text=${encodeURIComponent(`Hello, I am interested in ${product.name} (${product.productNumber}).`)}`}
              className="rounded-full bg-[#d6b45a] px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.22em] text-[#071006] transition hover:bg-[#f5d172]"
            >
              Ask on WhatsApp
            </a>
            <a
              href={product.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[#d6b45a]/28 px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.22em] text-white transition hover:border-[#d6b45a] hover:text-[#f5d172]"
            >
              Yupoo album
            </a>
          </div>
        </aside>
      </section>

      <a
        href="https://wa.me/8617336648172"
        aria-label="Contact VIPSUI on WhatsApp"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#1f7a43] text-sm font-bold text-white shadow-[0_14px_40px_rgba(0,0,0,0.35)] transition hover:scale-105 hover:bg-[#269653]"
      >
        WA
      </a>

      {zoomOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95"
          onTouchStart={(event) => setTouchStart(event.touches[0]?.clientX ?? null)}
          onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
        >
          <button
            type="button"
            onClick={() => setZoomOpen(false)}
            className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-black/65 px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white backdrop-blur transition hover:border-[#d6b45a] hover:text-[#f5d172]"
          >
            Close
          </button>
          <div className="absolute left-4 top-4 z-10 bg-black/65 px-4 py-3 text-xs uppercase tracking-[0.2em] text-[#f5d172] backdrop-blur">
            {activeIndex + 1} / {gallery.length}
          </div>
          {canMove && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={showPrevious}
                className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl text-white backdrop-blur transition hover:bg-[#d6b45a] hover:text-black"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={showNext}
                className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl text-white backdrop-blur transition hover:bg-[#d6b45a] hover:text-black"
              >
                ›
              </button>
            </>
          )}
          <div className="flex h-full w-full items-center justify-center p-4 sm:p-8">
            <img src={proxiedImage(activeImage)} alt={product.name} className="max-h-full max-w-full object-contain" />
          </div>
        </div>
      )}
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#d6b45a]/18 bg-[#07110a] p-5">
      <p className="text-xs uppercase tracking-[0.24em] text-[#827866]">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
