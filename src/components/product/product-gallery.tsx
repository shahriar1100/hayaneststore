"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductVariant } from "@/types/store";
import { ProductPhoto } from "./product-photo";

export function ProductGallery({ photos, name }: { photos: ProductVariant["gallery"]; name: string }) {
  const [prevPhotos, setPrevPhotos] = useState(photos);
  const [index, setIndex] = useState(0);

  if (photos !== prevPhotos) {
    setPrevPhotos(photos);
    setIndex(0);
  }

  const photo = photos[index] ?? photos[0];

  return <section className="product-gallery" aria-label={`${name} image gallery`}>
    <div className="product-gallery-main">
      <ProductPhoto key={photo.src} photo={photo} loading="eager" sizes="(min-width: 1328px) 570px, (min-width: 768px) 46vw, 100vw" />
      {photos.length > 1 && <div className="product-gallery-navigation"><button type="button" className="icon-button" aria-label="Previous image" onClick={() => setIndex((index + photos.length - 1) % photos.length)}><ChevronLeft aria-hidden="true" /></button><span aria-live="polite" aria-atomic="true"><span className="sr-only">Image </span>{index + 1} / {photos.length}</span><button type="button" className="icon-button" aria-label="Next image" onClick={() => setIndex((index + 1) % photos.length)}><ChevronRight aria-hidden="true" /></button></div>}
    </div>
    {photos.length > 1 && <div className="product-thumbnails" role="group" aria-label="Choose product image">{photos.map((photo, photoIndex) => <button type="button" className="product-thumbnail" key={`${photo.src}-${photoIndex}`} aria-label={`View image ${photoIndex + 1}: ${photo.alt}`} aria-pressed={photoIndex === index} onClick={() => setIndex(photoIndex)}><ProductPhoto photo={photo} sizes="80px" /></button>)}</div>}
  </section>;
}
