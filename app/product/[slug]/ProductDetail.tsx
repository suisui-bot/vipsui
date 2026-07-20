"use client";

import Link from "next/link";
import { useState } from "react";
import SiteHeader from "../../components/SiteHeader";
import type { CatalogProduct } from "../../data/catalog";
import { displayLabel, displayPath } from "../../data/display";
import { imagePath } from "../../data/images";

export default function ProductDetail({ product }: { product: CatalogProduct }) {
  const gallery =
    product.galleryMedia && product.galleryMedia.length > 0
      ? product.galleryMedia
      : (product.galleryImages && product.galleryImages.length > 0 ? product.galleryImages : [product.coverImage]).map((url) => ({
          type: "image" as const,
          url,
          sourceMediaId: url,
        }));
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const activeMedia = gallery[activeIndex] ?? gallery[0];
  const activeImage = activeMedia?.type === "video" ? activeMedia.poster || product.coverImage : activeMedia?.url || product.coverImage;
  const canMove = gallery.length > 1;
  const category = displayPath(product.categoryPath);
  const collection = displayLabel(product.collection);
  const videoCount = product.videoCount || gallery.filter((item) => item.type === "video").length;

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
      if (delta > 0) showNext();
      else showPrevious();
    }
    setTouchStart(null);
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <SiteHeader />

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.08fr_0.72fr] lg:px-8 lg:py-12">
        <div className="min-w-0">
          <div
            className="group relative aspect-[4/5] overflow-hidden rounded-[28px] bg-white"
            onTouchStart={(event) => setTouchStart(event.touches[0]?.clientX ?? null)}
            onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
          >
            {activeMedia?.type === "video" ? (
              <video
                key={activeMedia.url}
                src={activeMedia.url}
                poster={imagePath(activeMedia.poster || product.coverImage)}
                controls
                playsInline
                preload="metadata"
                className="h-full w-full bg-black object-contain"
              />
            ) : (
              <img src={imagePath(activeImage)} alt={product.productNumber} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
            )}
            <div className="absolute left-4 top-4 rounded-full bg-white/86 px-3 py-2 text-xs font-semibold text-[#1d1d1f] backdrop-blur">
              {activeIndex + 1} / {gallery.length}
            </div>
            {activeMedia?.type === "video" && (
              <div className="absolute right-4 top-4 rounded-full bg-black/70 px-3 py-2 text-xs font-semibold text-white backdrop-blur">
                Video
              </div>
            )}
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              className="absolute bottom-4 left-4 rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black"
            >
              Zoom
            </button>
            {canMove && (
              <>
                <button type="button" aria-label="Previous image" onClick={showPrevious} className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/86 text-2xl backdrop-blur transition hover:bg-white">
                  ‹
                </button>
                <button type="button" aria-label="Next image" onClick={showNext} className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/86 text-2xl backdrop-blur transition hover:bg-white">
                  ›
                </button>
              </>
            )}
          </div>

          <div className="mt-4 flex gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
            {gallery.map((media, index) => {
              const thumb = media.type === "video" ? media.poster || product.coverImage : media.url;
              return (
              <button
                key={`${media.type}-${media.url}-${index}`}
                type="button"
                aria-label={`View ${media.type} ${index + 1}`}
                onClick={() => setActiveIndex(index)}
                className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white ring-2 transition sm:h-24 sm:w-24 ${
                  activeIndex === index ? "ring-[#1d1d1f]" : "ring-transparent hover:ring-[#d2d2d7]"
                }`}
              >
                <img src={imagePath(thumb)} alt="" loading="lazy" className="h-full w-full object-cover" />
                {media.type === "video" && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/18 text-white">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-xs">▶</span>
                  </span>
                )}
              </button>
              );
            })}
          </div>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Link href={`/shop?category=${encodeURIComponent(product.categoryPath.join(">"))}`} className="text-sm font-semibold text-[#0066cc] hover:underline">
            {category}
          </Link>
          <h1 className="mt-4 text-5xl font-semibold leading-tight sm:text-6xl">{product.productNumber}</h1>
          <p className="mt-4 text-xl text-[#424245]">{collection}</p>
          <p className="mt-3 text-base font-semibold text-[#1d1d1f]">{product.publicPriceLabel}</p>
          {product.description && <p className="mt-6 max-w-xl whitespace-pre-line text-base leading-8 text-[#6e6e73]">{product.description}</p>}

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Info label="Gallery" value={videoCount ? `${product.imageCount} images · ${videoCount} videos` : `${gallery.length} images`} />
            <Info label="Category" value={category} />
            <Info label="Collection" value={collection} />
            <Info label="Availability" value="Ask us" />
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={`https://wa.me/8617336648172?text=${encodeURIComponent(`Hello, I am interested in product ${product.productNumber}.`)}`}
              className="rounded-full bg-[#1d1d1f] px-6 py-4 text-center text-sm font-semibold text-white transition hover:bg-black"
            >
              Contact on WhatsApp
            </a>
            <a
              href={`https://wa.me/8617336648172?text=${encodeURIComponent(`Hello, please share the price for product ${product.productNumber}.`)}`}
              className="rounded-full bg-white px-6 py-4 text-center text-sm font-semibold text-[#1d1d1f] ring-1 ring-[#d2d2d7] transition hover:ring-[#1d1d1f]"
            >
              Ask for Price
            </a>
          </div>
        </aside>
      </section>

      <a
        href="https://wa.me/8617336648172"
        aria-label="Contact VIPSUI on WhatsApp"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#1f7a43] text-sm font-bold text-white shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition hover:scale-105 hover:bg-[#269653]"
      >
        WA
      </a>

      {zoomOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/95"
          onTouchStart={(event) => setTouchStart(event.touches[0]?.clientX ?? null)}
          onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
        >
          <button type="button" onClick={() => setZoomOpen(false)} className="absolute right-4 top-4 z-10 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7]">
            Close
          </button>
          <div className="absolute left-4 top-4 z-10 rounded-full bg-white/12 px-4 py-3 text-sm font-semibold text-white backdrop-blur">
            {activeIndex + 1} / {gallery.length}
          </div>
          {canMove && (
            <>
              <button type="button" aria-label="Previous image" onClick={showPrevious} className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/12 text-3xl text-white backdrop-blur transition hover:bg-white/22">
                ‹
              </button>
              <button type="button" aria-label="Next image" onClick={showNext} className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/12 text-3xl text-white backdrop-blur transition hover:bg-white/22">
                ›
              </button>
            </>
          )}
          <div className="flex h-full w-full items-center justify-center p-4 sm:p-8">
            {activeMedia?.type === "video" ? (
              <video
                key={activeMedia.url}
                src={activeMedia.url}
                poster={imagePath(activeMedia.poster || product.coverImage)}
                controls
                playsInline
                autoPlay
                className="max-h-full max-w-full bg-black object-contain"
              />
            ) : (
              <img src={imagePath(activeImage)} alt={product.productNumber} className="max-h-full max-w-full object-contain" />
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-[#d2d2d7]/70">
      <p className="text-xs font-medium text-[#6e6e73]">{label}</p>
      <p className="mt-2 text-base font-semibold">{value}</p>
    </div>
  );
}
