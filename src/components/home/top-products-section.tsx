import Link from "next/link";
import type { Product } from "@/types/store";
import { topProducts as defaultTopProducts } from "@/data/store";
import { ProductPhoto } from "@/components/product/product-photo";
import { HorizontalSlider } from "./horizontal-slider";
import { SectionHeading } from "./section-heading";

export function TopProductsSection({ products = defaultTopProducts }: { products?: Product[] }) {
  const loopProducts = [
    ...products.map((product) => ({ product, isDuplicate: false, key: product.id })),
    ...products.map((product) => ({ product, isDuplicate: true, key: `${product.id}-loop` })),
  ];

  return (
    <section className="home-section top-products-section" aria-labelledby="top-products-title">
      <SectionHeading id="top-products-title" title="Top Products" seeAll className="top-products-heading" />
      <HorizontalSlider rowClassName="top-products-row scroll-row" autoSlide speedPxPerFrame={0.75} ariaLabel="top products">
        {loopProducts.map(({ product, isDuplicate, key }) => (
          <Link
            href={`/products/${product.slug}`}
            key={key}
            className="top-product"
            aria-label={isDuplicate ? undefined : `View ${product.name}`}
            aria-hidden={isDuplicate ? "true" : undefined}
            tabIndex={isDuplicate ? -1 : undefined}
            draggable={false}
          >
            <ProductPhoto photo={product.photo} sizes="(min-width: 768px) 110px, 20vw" />
          </Link>
        ))}
      </HorizontalSlider>
    </section>
  );
}
