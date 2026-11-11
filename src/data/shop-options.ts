import type { Fabric, ProductCategory, ProductColour } from "@/types/store";
import { photos } from "./photos";

export type CategoryOption = {
  value: ProductCategory;
  label: string;
  hasFabric?: boolean;
  imageSrc?: string;
  imageAlt?: string;
};

export type FabricOption = {
  value: Fabric;
  label: string;
  imageSrc?: string;
  imageAlt?: string;
};

export type ColourOption = {
  value: ProductColour;
  label: string;
  swatch: string;
};

export type CatalogTaxonomy = {
  categories: CategoryOption[];
  fabrics: FabricOption[];
  colours: ColourOption[];
};

export const fabricOptions: FabricOption[] = [
  { value: "modal", label: "Modal", imageSrc: photos.modal.src, imageAlt: photos.modal.alt },
  { value: "chiffon", label: "Chiffon", imageSrc: photos.chiffon.src, imageAlt: photos.chiffon.alt },
  { value: "jersey", label: "Jersey", imageSrc: photos.jersey.src, imageAlt: photos.jersey.alt },
  { value: "silk", label: "Silk", imageSrc: photos.silk.src, imageAlt: photos.silk.alt },
];

export const categoryOptions: CategoryOption[] = [
  { value: "hijabs", label: "Hijabs", hasFabric: true, imageSrc: photos.rose.src, imageAlt: photos.rose.alt },
  {
    value: "accessories",
    label: "Accessories",
    hasFabric: false,
    imageSrc: photos.accessories.src,
    imageAlt: photos.accessories.alt,
  },
];

export const colourOptions: ColourOption[] = [
  { value: "white", label: "White", swatch: "#ffffff" },
  { value: "navy", label: "Navy", swatch: "#1b365d" },
  { value: "rose", label: "Rose", swatch: "#c99595" },
  { value: "olive", label: "Olive", swatch: "#666b43" },
  { value: "black", label: "Black", swatch: "#292726" },
  { value: "mocha", label: "Mocha", swatch: "#8b6550" },
  { value: "mauve", label: "Mauve", swatch: "#987780" },
  { value: "burgundy", label: "Burgundy", swatch: "#72283d" },
  {
    value: "multi",
    label: "Multi",
    swatch:
      "linear-gradient(135deg, #c99595 33%, #666b43 33%, #666b43 66%, #1b365d 66%)",
  },
  { value: "gold", label: "Gold", swatch: "#c6a35a" },
];

export const DEFAULT_CATALOG_TAXONOMY: CatalogTaxonomy = {
  categories: categoryOptions,
  fabrics: fabricOptions,
  colours: colourOptions,
};

export function resolveColourMeta(
  colourValue: string,
  customColours?: readonly ColourOption[],
): ColourOption {
  if (colourValue === "sand" || colourValue === "cream" || colourValue === "ivory") {
    return { value: "white", label: "White", swatch: "#ffffff" };
  }
  const list = customColours && customColours.length > 0 ? customColours : colourOptions;
  const found =
    list.find((c) => c.value === colourValue) ??
    colourOptions.find((c) => c.value === colourValue);
  if (found) return found;
  const formattedLabel =
    colourValue.charAt(0).toUpperCase() + colourValue.slice(1).replace(/-/g, " ");
  return {
    value: colourValue,
    label: formattedLabel,
    swatch: "#1b365d",
  };
}

export const priceOptions = [
  { value: "all", label: "Any price", min: 0, max: null },
  { value: "under-500", label: "Under ৳500", min: 0, max: 499 },
  { value: "500-699", label: "৳500 – ৳699", min: 500, max: 699 },
  { value: "700-899", label: "৳700 – ৳899", min: 700, max: 899 },
  { value: "900-plus", label: "৳900 & above", min: 900, max: null },
] as const;

export const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name-asc", label: "Name: A to Z" },
] as const;

export type PriceBand = (typeof priceOptions)[number]["value"];
export type ShopSort = (typeof sortOptions)[number]["value"];

