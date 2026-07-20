import Link from "next/link";
import SiteHeader from "./components/SiteHeader";
import featuredProducts from "./data/featuredProducts.json";
import type { CatalogProduct } from "./data/catalog";
import { categoryByName, displayLabel, displayPath, heroCategoryNames, pathKey } from "./data/display";
import { imagePath } from "./data/images";

const products = featuredProducts as CatalogProduct[];
const heroProduct = products.find((product) => product.categoryPath?.[0] === "高端腕表") || products[0];

const categoryIntros: Record<string, string> = {
  "高端腕表": "Precision pieces with complete galleries.",
  "高奢名包": "Signature shapes and everyday icons.",
  "高定女鞋": "Refined silhouettes for every occasion.",
  "高奢饰品": "Jewelry, accents, and finishing details.",
  "高奢女装": "Curated ready-to-wear and seasonal edits.",
  "高奢墨镜": "Clean lines, sculpted frames, easy polish.",
};

export default function Home() {
  const categories = heroCategoryNames
    .map((name) => categoryByName(name))
    .filter(Boolean)
    .map((category) => {
      const cover = products.find((product) => product.categoryPath?.[0] === category!.name)?.coverImage || heroProduct.coverImage;
      return { ...category!, cover };
    });

  const newArrivals = products.slice(0, 8);
  const representativeBrands = Array.from(new Set(products.map((product) => displayLabel(product.collection)).filter(Boolean))).slice(0, 10);

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <SiteHeader />

      <section className="relative min-h-[78vh] overflow-hidden bg-[#f5f5f7]">
        <div className="absolute inset-0">
          <img src={imagePath(heroProduct.coverImage)} alt="" className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,_rgba(245,245,247,0.96)_0%,_rgba(245,245,247,0.82)_42%,_rgba(245,245,247,0.28)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#f5f5f7] to-transparent" />
        </div>

        <div className="relative mx-auto flex min-h-[78vh] max-w-7xl items-end px-4 pb-14 pt-24 sm:px-6 lg:px-8 lg:pb-20">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-[#6e6e73]">VIPSUI curated catalog</p>
            <h1 className="mt-4 text-5xl font-semibold leading-[1.02] sm:text-7xl">Discover Something Exceptional.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#424245]">
              Explore a carefully selected collection of watches, fashion, jewelry and accessories.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/shop" className="rounded-full bg-[#1d1d1f] px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-black">
                Explore Collection
              </Link>
              <Link href="/shop?sort=new" className="rounded-full bg-white px-6 py-3 text-center text-sm font-semibold text-[#1d1d1f] ring-1 ring-[#d2d2d7] transition hover:ring-[#1d1d1f]">
                New Arrivals
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-[#6e6e73]">Shop by Category</p>
            <h2 className="mt-2 text-4xl font-semibold">Start with what you love.</h2>
          </div>
          <Link href="/shop" className="hidden text-sm font-semibold text-[#0066cc] hover:underline sm:block">
            View all categories
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/shop?category=${encodeURIComponent(pathKey(category.path))}`}
              className="group overflow-hidden rounded-[28px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-[#d2d2d7]/70 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(0,0,0,0.10)]"
            >
              <div className="aspect-[4/3] overflow-hidden bg-[#f5f5f7]">
                <img src={imagePath(category.cover)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
              </div>
              <div className="p-6">
                <h3 className="text-2xl font-semibold">{displayLabel(category.name)}</h3>
                <p className="mt-2 text-sm leading-6 text-[#6e6e73]">{categoryIntros[category.name]}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-[#6e6e73]">New Arrivals</p>
              <h2 className="mt-2 text-4xl font-semibold">Fresh pieces, easy to explore.</h2>
            </div>
            <Link href="/shop?sort=new" className="hidden text-sm font-semibold text-[#0066cc] hover:underline sm:block">
              View all new arrivals
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {newArrivals.map((product) => (
              <ProductCard key={product.albumId} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1fr] lg:px-8">
        <div>
          <p className="text-sm font-medium text-[#6e6e73]">Explore Brands</p>
          <h2 className="mt-2 text-4xl font-semibold">Browse the names customers ask for most.</h2>
          <Link href="/shop" className="mt-6 inline-flex text-sm font-semibold text-[#0066cc] hover:underline">
            View All Brands
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {representativeBrands.map((brand) => (
            <Link key={brand} href={`/shop?search=${encodeURIComponent(brand)}`} className="rounded-2xl bg-white px-5 py-4 text-base font-semibold ring-1 ring-[#d2d2d7]/70 transition hover:text-[#b89b5e]">
              {brand}
            </Link>
          ))}
        </div>
      </section>

      <section id="quality" className="bg-[#faf9f7] px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold text-[#b89b5e]">100% Dedicated to Quality</p>
          <h2 className="mt-3 text-4xl font-semibold">Crafted with Attention to Every Detail</h2>
          <p className="mt-6 text-lg leading-8 text-[#424245]">
            Every piece is carefully selected with a focus on craftsmanship, quality, and attention to detail. We believe exceptional quality deserves a fair price.
          </p>
          <p className="mt-6 text-2xl font-semibold">We focus on quality. You focus on enjoying it.</p>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </main>
  );
}

function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <Link href={`/product/${product.slug}`} className="group rounded-[24px] bg-[#f5f5f7] p-3 transition hover:bg-[#ededf0]">
      <div className="aspect-[4/5] overflow-hidden rounded-[20px] bg-white">
        <img src={imagePath(product.coverImage)} alt={product.productNumber} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
      </div>
      <div className="px-2 py-4">
        <p className="text-xs font-medium text-[#6e6e73]">{displayPath(product.categoryPath)}</p>
        <h3 className="mt-1 text-lg font-semibold">{product.productNumber}</h3>
        <p className="mt-1 text-sm text-[#6e6e73]">{product.publicPriceLabel}</p>
      </div>
    </Link>
  );
}

function Footer() {
  const links = [
    ["About", "/#quality"],
    ["Contact", "https://wa.me/8617336648172"],
    ["WhatsApp", "https://wa.me/8617336648172"],
    ["Shipping", "/#footer"],
    ["FAQ", "/#footer"],
    ["Search", "/shop"],
  ];

  return (
    <footer id="footer" className="border-t border-[#d2d2d7] bg-[#f5f5f7] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1fr_2fr]">
        <div>
          <p className="text-sm font-semibold tracking-[0.28em]">VIPSUI</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[#6e6e73]">A calm, curated way to browse watches, fashion, jewelry and accessories.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {links.map(([label, href]) => (
            <Link key={label} href={href} className="text-sm text-[#424245] hover:text-[#b89b5e]">
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/8617336648172"
      aria-label="Contact VIPSUI on WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#1f7a43] text-sm font-bold text-white shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition hover:scale-105 hover:bg-[#269653]"
    >
      WA
    </a>
  );
}
