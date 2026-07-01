import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, watchProducts } from "../../data/watches";

export function generateStaticParams() {
  return watchProducts.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.18),_transparent_35%),linear-gradient(135deg,_#050505,_#111111)] text-stone-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          <nav className="flex items-center justify-between text-sm uppercase tracking-[0.3em] text-stone-400">
            <Link href="/" className="hover:text-amber-400">
              ← Back to collection
            </Link>
            <span>{product.brand}</span>
          </nav>

          <section className="grid gap-8 rounded-[2rem] border border-amber-500/20 bg-black/70 p-6 shadow-[0_0_60px_rgba(212,175,55,0.12)] backdrop-blur lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
            <div className="relative overflow-hidden rounded-[1.5rem] border border-stone-800 bg-zinc-950">
              <Image
                src={product.image}
                alt={product.name}
                width={1200}
                height={1400}
                priority
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.5em] text-amber-400">{product.category}</p>
                <h1 className="text-4xl font-semibold tracking-[0.2em] text-white sm:text-5xl">
                  {product.name}
                </h1>
                <p className="text-lg text-stone-300">{product.tagline}</p>
                <p className="max-w-xl text-base leading-8 text-stone-400">{product.description}</p>
              </div>

              <div className="rounded-2xl border border-amber-500/20 bg-stone-950/70 p-5">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-stone-500">Availability</p>
                    <p className="text-2xl font-semibold text-amber-400">{product.priceLabel}</p>
                  </div>
                </div>
                <ul className="space-y-3 text-sm text-stone-300">
                  {product.specs.map((spec) => (
                    <li key={spec} className="flex items-center gap-3">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      {spec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
}
