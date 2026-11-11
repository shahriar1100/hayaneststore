import type { Photo } from "@/types/store";

// Existing local assets only. Replace these URLs/alt descriptions with uploaded
// image data when a future catalogue source is added. Components do not own URLs.
export const photos = {
  hero: { src: "/images/hero.webp", alt: "A woman in a mocha hijab and white blouse in a warm, sunlit setting", position: "center 42%" },
  rose: { src: "/images/rose-portrait.webp", alt: "Soft dusty rose hijab, styled with a white blouse", position: "center 35%" },
  olive: { src: "/images/olive-portrait.webp", alt: "Olive green jersey hijab with softly draped folds", position: "center 35%" },
  black: { src: "/images/black-portrait.webp", alt: "Classic black hijab styled for everyday wear", position: "center 35%" },
  sand: { src: "/images/sand-portrait.webp", alt: "Light pearl hijab with a soft, flowing drape", position: "center 35%" },
  mocha: { src: "/images/mocha-portrait.webp", alt: "Mocha brown hijab with elegant layered folds", position: "center 35%" },
  mauve: { src: "/images/mauve-portrait.webp", alt: "Dusty mauve hijab styled with a relaxed drape", position: "center 35%" },
  burgundy: { src: "/images/burgundy-portrait.webp", alt: "Deep burgundy hijab in a classic everyday style", position: "center 35%" },
  roseFolds: { src: "/images/rose-folds.webp", alt: "Neatly folded dusty rose hijabs with soft flowing folds" },
  folded: { src: "/images/folded-hijabs.webp", alt: "Folded hijabs in dusty rose, pearl, olive and navy" },
  modal: { src: "/images/modal-fabric.webp", alt: "Soft terracotta rose modal fabric" },
  chiffon: { src: "/images/chiffon-fabric.webp", alt: "Airy pearl chiffon fabric" },
  jersey: { src: "/images/jersey-fabric.webp", alt: "Rich olive jersey fabric" },
  silk: { src: "/images/silk-fabric.webp", alt: "Dusty mauve silk with a subtle sheen" },
  accessories: { src: "/images/accessories.webp", alt: "Flower scrunchies and gold hijab pins on a white background" },
} satisfies Record<string, Photo>;
