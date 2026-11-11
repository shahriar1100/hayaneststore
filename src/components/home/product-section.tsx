import { Crown, Gem, Sparkles, Star } from "lucide-react";
import type { ReactNode } from "react";
import type { Product } from "@/types/store";
import { ProductCard } from "@/components/product/product-card";
import { SectionHeading } from "./section-heading";

type LayoutType = "new-items" | "popular" | "for-you";
type Props = { id: string; title: string; products: Product[]; layout: LayoutType };

const SECTION_META: Record<LayoutType, { badge: string; icon: ReactNode; subtitle: string }> = {
  "new-items": {
    badge: "Fresh Arrivals",
    icon: <Sparkles size={12} aria-hidden="true" />,
    subtitle: "Just landed seasonal hijabs & modest essentials crafted for effortless everyday drape.",
  },
  popular: {
    badge: "Best Sellers",
    icon: <Crown size={12} aria-hidden="true" />,
    subtitle: "Our most-loved modal, chiffon & jersey hijabs chosen by the HayaNest BD community.",
  },
  "for-you": {
    badge: "Curated Pick",
    icon: <Gem size={12} aria-hidden="true" />,
    subtitle: "Handpicked modest styles tailored to elevate your everyday and occasion wardrobe.",
  },
};

export function ProductSection({ id, title, products, layout }: Props) {
  const meta = SECTION_META[layout];
  const seeAllHref =
    layout === "new-items"
      ? "/shop?sort=newest"
      : "/shop";

  return (
    <section id={id} className={`home-section product-showcase-section ${layout}-section`} aria-labelledby={`${id}-title`}>
      <SectionHeading
        id={`${id}-title`}
        title={title}
        badge={meta.badge}
        badgeIcon={meta.icon}
        subtitle={meta.subtitle}
        seeAll
        seeAllHref={seeAllHref}
      >
        {layout === "for-you" && <Star size={19} fill="currentColor" className="recommendation-star" aria-hidden="true" />}
      </SectionHeading>
      <div className={`product-grid ${layout}-grid`}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} variant={layout === "popular" ? "compact" : "standard"} />
        ))}
      </div>
    </section>
  );
}
