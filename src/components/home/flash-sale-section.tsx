"use client";

import { useCallback, useEffect, useState } from "react";
import { Flame } from "lucide-react";
import type { Product } from "@/types/store";
import type { FlashSaleConfig } from "@/lib/server/store-repository";
import { saleProducts as defaultSaleProducts } from "@/data/store";
import { ProductCard } from "@/components/product/product-card";
import { FlashSaleCountdown } from "./flash-sale-countdown";
import { SectionHeading } from "./section-heading";

type FlashSaleSectionProps = {
  products?: Product[];
  flashSale?: FlashSaleConfig;
};

export function FlashSaleSection({
  products = defaultSaleProducts,
  flashSale,
}: FlashSaleSectionProps) {
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const endsAt = flashSale?.endsAt;
    const timer = window.setTimeout(() => {
      if (!endsAt) {
        setIsExpired(false);
        return;
      }
      const targetMs = Date.parse(endsAt);
      setIsExpired(!Number.isNaN(targetMs) && targetMs <= Date.now());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [flashSale?.endsAt]);

  const handleExpire = useCallback(() => {
    setIsExpired(true);
  }, []);

  if (flashSale && !flashSale.enabled) {
    return null;
  }

  const expiredBehavior = flashSale?.expiredBehavior ?? "revert-prices";
  if (isExpired && expiredBehavior === "hide-section") {
    return null;
  }

  const displayProducts = isExpired
    ? products.map((product) => {
        if (typeof product.originalPrice === "number" && product.originalPrice > product.price) {
          const { originalPrice, ...rest } = product;
          return {
            ...rest,
            price: originalPrice,
          };
        }
        return product;
      })
    : products;

  return (
    <section
      id="flash-sale"
      className="home-section product-showcase-section flash-sale-section"
      aria-labelledby="flash-sale-title"
    >
      <SectionHeading
        id="flash-sale-title"
        title={flashSale?.title || "Flash Sale"}
        badge={isExpired ? "Sale Ended" : flashSale?.badge || "Limited Time Offer"}
        badgeIcon={<Flame size={12} aria-hidden="true" />}
        subtitle={
          isExpired
            ? "This flash sale has ended. Featured items are now available at regular store prices."
            : flashSale?.subtitle ||
              "Exclusive markdowns on signature drapes before the timer runs out."
        }
        seeAll
        seeAllHref="/shop"
      >
        <FlashSaleCountdown endsAt={flashSale?.endsAt} onExpire={handleExpire} />
      </SectionHeading>
      <div className="sale-grid">
        {displayProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            variant={isExpired ? "standard" : "sale"}
          />
        ))}
      </div>
    </section>
  );
}

