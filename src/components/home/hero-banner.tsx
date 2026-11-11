"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { hero, photos } from "@/data/store";
import type { HeroBannerConfig } from "@/lib/server/store-repository";

interface HeroBannerProps {
  banner?: HeroBannerConfig;
  slides?: HeroBannerConfig[];
}

const AUTO_SLIDE_INTERVAL_MS = 4800;

function resolveHeroSrc(candidate: string | undefined, fallback: string): string {
  const trimmed = candidate?.trim();
  if (!trimmed || trimmed === "/images/hijab-black-banner.png") {
    return fallback;
  }
  return trimmed;
}

export function HeroBanner({ banner, slides: propSlides }: HeroBannerProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [failedSources, setFailedSources] = useState<Record<string, boolean>>({});
  const shouldReduceMotion = useReducedMotion();

  const defaultSlides: HeroBannerConfig[] = [
    {
      titleLine1: banner?.titleLine1 || hero.title[0],
      titleLine2: banner?.titleLine2 || hero.title[1],
      subtitle: banner?.subtitle || hero.subtitle,
      ctaLabel: banner?.ctaLabel || "Explore Collection",
      ctaHref: banner?.ctaHref || "#new-items",
      imageSrc: resolveHeroSrc(banner?.imageSrc, hero.photo.src),
      imageAlt: banner?.imageAlt || hero.photo.alt,
      imagePosition: banner?.imagePosition || hero.photo.position || "center 24%",
    },
    {
      titleLine1: "Signature Modal",
      titleLine2: "& Chiffon Drapes",
      subtitle: "Breathable, lightweight fabrics crafted for effortless all-day grace",
      ctaLabel: "Shop Modal & Chiffon",
      ctaHref: "/shop?fabric=modal",
      imageSrc: photos.sand.src,
      imageAlt: photos.sand.alt,
      imagePosition: photos.sand.position || "center 20%",
    },
    {
      titleLine1: "Limited Time",
      titleLine2: "Flash Sale Edit",
      subtitle: "Exclusive seasonal markdowns on signature hijabs & modest essentials",
      ctaLabel: "Shop Flash Sale",
      ctaHref: "#flash-sale",
      imageSrc: photos.rose.src,
      imageAlt: photos.rose.alt,
      imagePosition: photos.rose.position || "center 18%",
    },
  ];

  const fallbackPool = [hero.photo.src, photos.sand.src, photos.rose.src];

  const slides: HeroBannerConfig[] =
    Array.isArray(propSlides) && propSlides.length > 0
      ? defaultSlides.map((fallback, idx) => {
          const item = propSlides[idx];
          if (!item) return fallback;
          return {
            titleLine1: item.titleLine1?.trim() || fallback.titleLine1,
            titleLine2: item.titleLine2?.trim() || fallback.titleLine2,
            subtitle: item.subtitle?.trim() || fallback.subtitle,
            ctaLabel: item.ctaLabel?.trim() || fallback.ctaLabel,
            ctaHref: item.ctaHref?.trim() || fallback.ctaHref,
            imageSrc: resolveHeroSrc(item.imageSrc, fallback.imageSrc),
            imageAlt: item.imageAlt?.trim() || fallback.imageAlt,
            imagePosition: item.imagePosition?.trim() || fallback.imagePosition,
          };
        })
      : defaultSlides;

  useEffect(() => {
    if (shouldReduceMotion || isPaused || slides.length <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, AUTO_SLIDE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [isPaused, shouldReduceMotion, slides.length]);

  const current = slides[activeSlide] ?? slides[0];
  const safeImageSrc = failedSources[current.imageSrc]
    ? (fallbackPool[activeSlide] ?? hero.photo.src)
    : current.imageSrc;
  const isExternalImage =
    safeImageSrc.startsWith("http://") ||
    safeImageSrc.startsWith("https://") ||
    safeImageSrc.startsWith("data:");

  return (
    <LazyMotion features={domAnimation}>
      <section
        className="hero-banner"
        aria-labelledby="hero-title"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocusCapture={() => setIsPaused(true)}
        onBlurCapture={() => setIsPaused(false)}
      >
        <AnimatePresence mode="sync">
          <m.div
            key={`hero-img-${activeSlide}-${safeImageSrc}`}
            className="hero-photo-motion"
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.03 }}
            transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: -2,
              willChange: "transform, opacity",
            }}
          >
            <Image
              src={safeImageSrc}
              alt={current.imageAlt}
              fill
              preload={activeSlide === 0}
              unoptimized={isExternalImage}
              sizes="(min-width: 1328px) 1200px, (min-width: 768px) 90vw, 94vw"
              className="hero-photo"
              style={{ objectPosition: current.imagePosition }}
              onError={() => {
                setFailedSources((prev) => ({ ...prev, [current.imageSrc]: true }));
              }}
            />
          </m.div>
        </AnimatePresence>

        <div className="hero-shade" />

        <div className="hero-copy">
          <AnimatePresence mode="wait">
            <m.div
              key={`hero-copy-${activeSlide}`}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -16 }}
              transition={{ duration: 0.68, ease: [0.16, 1, 0.3, 1] }}
            >
              <m.h1
                id="hero-title"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 26, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.78, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
              >
                {current.titleLine1}
                <br />
                {current.titleLine2}
              </m.h1>
              <m.p
                initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.74, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                {current.subtitle}
              </m.p>
              <m.a
                href={current.ctaHref}
                className="hero-cta"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.72, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                {current.ctaLabel} <ArrowRight aria-hidden="true" />
              </m.a>
            </m.div>
          </AnimatePresence>
        </div>

        <div className="hero-pagination" role="group" aria-label="Banner slides">
          {slides.map((slide, idx) => {
            const isCurrent = idx === activeSlide;
            return (
              <button
                key={idx}
                type="button"
                className={isCurrent ? "hero-current-dot" : undefined}
                style={isCurrent ? { background: "#8e5b39" } : undefined}
                aria-label={`Slide ${idx + 1} of ${slides.length}: ${slide.titleLine1} ${slide.titleLine2}`}
                aria-pressed={isCurrent}
                onClick={() => setActiveSlide(idx)}
              >
                <span />
              </button>
            );
          })}
        </div>
      </section>
    </LazyMotion>
  );
}


