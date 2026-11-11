import Image from "next/image";
import Link from "next/link";
import { sliderCategories } from "@/data/store";
import type { Category } from "@/types/store";
import { HorizontalSlider } from "./horizontal-slider";
import { SectionHeading } from "./section-heading";

type CategoriesSectionProps = {
  categories?: Category[];
};

export function CategoriesSection({ categories = sliderCategories }: CategoriesSectionProps) {
  return (
    <section id="categories" className="home-section categories-section" aria-labelledby="categories-title">
      <SectionHeading id="categories-title" title="Categories" seeAll seeAllHref="/shop" />
      <HorizontalSlider rowClassName="category-row scroll-row" ariaLabel="categories">
        {categories.map((category) => (
          <Link
            href={category.href}
            key={category.id}
            className="category-item"
            aria-label={`Shop ${category.name} collection`}
            draggable={false}
          >
            <span className="category-image">
              <Image
                src={category.photo.src}
                alt={category.photo.alt}
                fill
                sizes="(min-width: 768px) 120px, 24vw"
                draggable={false}
                unoptimized={category.photo.src.startsWith("http")}
              />
            </span>
            <span>{category.name}</span>
          </Link>
        ))}
      </HorizontalSlider>
    </section>
  );
}

