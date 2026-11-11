"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  LazyMotion,
  animate,
  domAnimation,
  m,
  useReducedMotion,
} from "framer-motion";

interface MotionRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}

const EDITORIAL_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Rich GPU-accelerated Framer Motion reveal wrapper.
 * Uses LazyMotion + domAnimation and triggers progressively when scrolled into view.
 */
export function MotionReveal({
  children,
  className,
  delay = 0,
  y = 38,
}: MotionRevealProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        className={className}
        initial={{ opacity: 0, y, scale: 0.94 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.18, margin: "0px 0px -10% 0px" }}
        transition={{
          duration: 0.82,
          delay,
          ease: EDITORIAL_EASE,
        }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}

type RevealKind = "heading" | "story" | "category" | "top-product" | "product" | "block";

function getRevealKind(el: HTMLElement): RevealKind {
  if (
    el.matches(
      ".section-heading, .shop-hero, .shop-toolbar, .pdp-breadcrumb",
    )
  ) {
    return "heading";
  }
  if (el.matches(".story-card")) return "story";
  if (el.matches(".category-item")) return "category";
  if (el.matches(".top-product")) return "top-product";
  if (el.matches(".product-card")) return "product";
  return "block";
}

function getInitialTransform(kind: RevealKind): string {
  switch (kind) {
    case "heading":
      return "translate3d(-22px, 34px, 0) scale(0.96)";
    case "story":
      return "translate3d(38px, 0px, 0) scale(0.88)";
    case "category":
      return "translate3d(36px, 0px, 0) scale(0.88)";
    case "top-product":
      return "translate3d(32px, 0px, 0) scale(0.78)";
    case "product":
      return "translate3d(0, 56px, 0) scale(0.9)";
    case "block":
      return "translate3d(0, 44px, 0) scale(0.94)";
  }
}

function getFinalTransform(): string {
  return "translate3d(0px, 0px, 0) scale(1)";
}

function getDuration(kind: RevealKind): number {
  switch (kind) {
    case "heading":
      return 0.78;
    case "story":
      return 0.88;
    case "category":
      return 0.92;
    case "top-product":
      return 0.84;
    case "product":
      return 0.88;
    case "block":
      return 0.84;
  }
}

/**
 * Scroll-linked Framer Motion orchestrator.
 * Preserves Server Component DOM hierarchy (`main > section`) while animating
 * individual headers, rows, and cards progressively as the user scrolls down the page.
 */
export function StorefrontMotion() {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion || typeof window === "undefined") {
      return;
    }

    const selector = [
      "main > section:not(.hero-banner) .section-heading",
      ".story-card",
      ".category-item",
      ".top-product",
      ".product-card",
      ".shop-hero",
      ".shop-toolbar",
      ".shop-sidebar",
      ".pdp-breadcrumb",
      ".pdp-gallery",
      ".pdp-details",
      ".pdp-section",
      ".site-footer .footer-grid > *",
    ].join(", ");

    const targets = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (targets.length === 0) return;

    const animatedSet = new WeakSet<Element>();
    const activeControls: Array<{ stop: () => void }> = [];

    // Ensure horizontal scroll rows never retain a vertical scrollTop offset
    document.querySelectorAll<HTMLElement>(".scroll-row").forEach((row) => {
      row.scrollTop = 0;
    });

    // Ensure in-viewport elements render instantly without blank delay or layout flicker
    for (const el of targets) {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        animatedSet.add(el);
        el.style.opacity = "1";
        el.style.transform = "none";
        continue;
      }
      const kind = getRevealKind(el);
      el.style.opacity = "0";
      el.style.transform = getInitialTransform(kind);
      el.style.willChange = "transform, opacity";
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Collect all elements entering the viewport in this scroll step,
        // sorted top-to-bottom then left-to-right for natural row cascading.
        const entering = entries
          .filter((entry) => entry.isIntersecting && !animatedSet.has(entry.target))
          .map((entry) => ({
            el: entry.target as HTMLElement,
            rect: entry.boundingClientRect,
          }))
          .sort((a, b) => {
            const rowDiff = Math.abs(a.rect.top - b.rect.top);
            if (rowDiff > 28) return a.rect.top - b.rect.top;
            return a.rect.left - b.rect.left;
          });

        if (entering.length === 0) return;

        entering.forEach(({ el }, batchIdx) => {
          animatedSet.add(el);
          observer.unobserve(el);

          const kind = getRevealKind(el);
          const initialTransform = getInitialTransform(kind);
          const finalTransform = getFinalTransform();
          const duration = getDuration(kind);
          const staggerDelay = Math.min(batchIdx * 0.12, 0.6);

          const ctrl = animate(
            el,
            {
              opacity: [0, 1],
              transform: [initialTransform, finalTransform],
            },
            {
              duration,
              delay: staggerDelay,
              ease: EDITORIAL_EASE,
            },
          );
          activeControls.push(ctrl);

          ctrl.then(() => {
            el.style.opacity = "";
            el.style.transform = "";
            el.style.willChange = "";
          });

          // Subtle luxury inner media zoom-out reveal for cards
          const innerMedia = el.querySelector<HTMLElement>(
            ".product-media, .category-grid",
          );
          if (innerMedia) {
            const mediaCtrl = animate(
              innerMedia,
              {
                transform: ["scale(1.09)", "scale(1)"],
              },
              {
                duration: duration + 0.18,
                delay: staggerDelay,
                ease: EDITORIAL_EASE,
              },
            );
            activeControls.push(mediaCtrl);
            mediaCtrl.then(() => {
              innerMedia.style.transform = "";
            });
          }
        });
      },
      {
        threshold: 0.16,
        rootMargin: "0px 0px -10% 0px",
      },
    );

    for (const el of targets) {
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
      for (const ctrl of activeControls) {
        ctrl.stop();
      }
      for (const el of targets) {
        el.style.opacity = "";
        el.style.transform = "";
        el.style.willChange = "";
      }
    };
  }, [pathname, shouldReduceMotion]);

  return null;
}

