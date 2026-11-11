import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronRight, MessageSquare, Star } from "lucide-react";
import { catalogProducts, findProductBySlug } from "@/data/catalog";
import { formatPrice } from "@/data/store";
import {
  getAllStoreProducts,
  getAllStoreReviews,
  getStoreSettings,
} from "@/lib/server/store-repository";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { ProductCard } from "@/components/product/product-card";
import { ProductDetails } from "@/components/product/product-details";
import "./product.css";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return catalogProducts.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const allProducts = await getAllStoreProducts();
  const product = allProducts.find((item) => item.slug === slug) ?? findProductBySlug(slug);
  if (!product) return { title: "Product not found | HayaNest BD" };
  const title = `${product.name} — ${formatPrice(product.price)} | HayaNest BD`;
  const description = product.details.description;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: product.photo.src,
          alt: product.photo.alt || product.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [product.photo.src],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [allProducts, reviews, settings] = await Promise.all([
    getAllStoreProducts(),
    getAllStoreReviews({ status: "approved" }),
    getStoreSettings(),
  ]);
  const product = allProducts.find((item) => item.slug === slug) ?? findProductBySlug(slug);
  if (!product) notFound();

  const productReviews = reviews.filter((r) => r.productId === product.id);
  const avgRating =
    productReviews.length > 0
      ? (
          productReviews.reduce((sum, r) => sum + r.rating, 0) /
          productReviews.length
        ).toFixed(1)
      : null;

  const others = allProducts.filter((item) => item.id !== product.id);
  const sameFabric = others.filter((item) => item.category === product.category && item.fabric && item.fabric === product.fabric);
  const sameCat = others.filter((item) => item.category === product.category && !sameFabric.includes(item));
  const rest = others.filter((item) => item.category !== product.category);
  const relatedProducts = [...sameFabric, ...sameCat, ...rest].slice(0, 4);

  return <>
    <SiteHeader activePage="shop" />
    <main id="main-content" className="page-container product-page">
      <nav className="product-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><ChevronRight aria-hidden="true" /><Link href="/shop">Shop</Link><ChevronRight aria-hidden="true" /><span aria-current="page">{product.name}</span></nav>
      <ProductDetails
        key={product.id}
        productId={product.id}
        name={product.name}
        price={product.price}
        originalPrice={product.originalPrice}
        category={product.category}
        fabric={product.fabric}
        description={product.details.description}
        material={product.details.material}
        size={product.details.size}
        deliveryNote={product.details.deliveryNote}
        variants={product.details.variants}
        customColours={settings.taxonomy.colours}
      />

      {/* Customer Reviews Section */}
      <section className="product-reviews-section" id="reviews" aria-labelledby="product-reviews-heading">
        <div className="product-reviews-header">
          <div>
            <p className="product-eyebrow">CUSTOMER FEEDBACK</p>
            <h2 id="product-reviews-heading">Verified Buyer Reviews ({productReviews.length})</h2>
          </div>
          {productReviews.length > 0 && (
            <div className="product-reviews-rating-pill">
              <Star size={16} fill="currentColor" style={{ color: "#f59e0b" }} aria-hidden="true" />
              <strong>{avgRating}</strong>
              <span>/ 5.0 · {productReviews.length} verified review{productReviews.length > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {productReviews.length === 0 ? (
          <div className="product-no-reviews-card">
            <MessageSquare size={24} style={{ color: "var(--muted)" }} aria-hidden="true" />
            <p>No reviews yet for this hijab.</p>
            <span>Have you purchased this hijab? After your order is delivered, you can rate and review it from your account page!</span>
          </div>
        ) : (
          <div className="product-reviews-grid">
            {productReviews.map((r) => (
              <article key={r.id} className="product-review-card">
                <div className="product-review-card-top">
                  <div className="product-review-stars" aria-label={`${r.rating} out of 5 stars`}>
                    {"★".repeat(r.rating)}
                    {"☆".repeat(5 - r.rating)}
                  </div>
                  <time className="product-review-date">
                    {new Date(r.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </time>
                </div>
                {r.title && <h3 className="product-review-title">{r.title}</h3>}
                <p className="product-review-comment">{r.comment}</p>
                <div className="product-review-author-line">
                  <strong>{r.customerName}</strong>
                  {r.verifiedPurchase && (
                    <span className="product-review-verified-badge">
                      <CheckCircle2 size={12} aria-hidden="true" />
                      Verified Buyer
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {relatedProducts.length > 0 && (
        <section className="product-related" aria-labelledby="related-products-heading">
          <div className="product-related-header">
            <div>
              <p className="product-eyebrow">COMPLETE YOUR LOOK</p>
              <h2 id="related-products-heading">You May Also Like</h2>
            </div>
            <Link href={product.fabric ? `/shop?fabric=${product.fabric}` : `/shop?category=${product.category}`} className="product-related-link">
              Explore more
            </Link>
          </div>
          <div className="product-related-grid">
            {relatedProducts.map((item) => (
              <ProductCard key={item.id} product={item} variant="catalog" />
            ))}
          </div>
        </section>
      )}
    </main>
    <SiteFooter />
    <MobileBottomNav activePage="shop" />
  </>;
}
