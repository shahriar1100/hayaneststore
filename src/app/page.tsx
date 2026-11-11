import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { HeroBanner } from "@/components/home/hero-banner";
import { StoriesSection } from "@/components/home/stories-section";
import { CategoriesSection } from "@/components/home/categories-section";
import { TopProductsSection } from "@/components/home/top-products-section";
import { ProductSection } from "@/components/home/product-section";
import { FlashSaleSection } from "@/components/home/flash-sale-section";
import { getHomepageCollections } from "@/lib/server/store-repository";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const {
    heroBanner,
    heroSlides,
    flashSale,
    homepageStories,
    homepageCategories,
    newItems,
    saleProducts,
    popularProducts,
    recommendedProducts,
    topProducts,
  } = await getHomepageCollections();

  return (
    <div id="home">
      <SiteHeader />
      <main id="main-content" className="page-container homepage">
        <HeroBanner banner={heroBanner} slides={heroSlides} />
        <StoriesSection stories={homepageStories} />
        <CategoriesSection categories={homepageCategories} />
        <TopProductsSection products={topProducts} />
        <ProductSection id="new-items" title="New Items" products={newItems} layout="new-items" />
        <FlashSaleSection products={saleProducts} flashSale={flashSale} />
        <ProductSection id="most-popular" title="Most Popular" products={popularProducts} layout="popular" />
        <ProductSection id="just-for-you" title="Just For You" products={recommendedProducts} layout="for-you" />
      </main>
      <SiteFooter />
      <MobileBottomNav />
    </div>
  );
}
