"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, Play, Volume2, VolumeX, X } from "lucide-react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { stories as defaultStories } from "@/data/store";
import type { Story } from "@/types/store";
import { HorizontalSlider } from "./horizontal-slider";

type StoriesSectionProps = {
  stories?: Story[];
};

function getOptimizedVideoUrl(rawUrl?: string): string {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return "";
  if (trimmed.includes("res.cloudinary.com") && trimmed.includes("/video/upload/")) {
    if (!trimmed.includes("/video/upload/f_auto")) {
      return trimmed.replace(
        "/video/upload/",
        "/video/upload/f_auto,q_auto:eco,vc_auto,w_720,c_limit/",
      );
    }
  }
  return trimmed;
}

export function StoriesSection({ stories = defaultStories }: StoriesSectionProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [hoveredStoryId, setHoveredStoryId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const activeStory =
    activeIndex !== null && activeIndex >= 0 && activeIndex < stories.length
      ? stories[activeIndex]
      : null;

  useEffect(() => {
    if (activeIndex === null) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveIndex(null);
      } else if (event.key === "ArrowRight") {
        setActiveIndex((prev) =>
          prev === null ? null : (prev + 1) % stories.length,
        );
      } else if (event.key === "ArrowLeft") {
        setActiveIndex((prev) =>
          prev === null ? null : (prev - 1 + stories.length) % stories.length,
        );
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeIndex, stories.length]);

  function openStoryModal(index: number) {
    setActiveIndex(index);
  }

  function closeStoryModal() {
    setActiveIndex(null);
  }

  function showPrevStory() {
    setActiveIndex((prev) =>
      prev === null ? null : (prev - 1 + stories.length) % stories.length,
    );
  }

  function showNextStory() {
    setActiveIndex((prev) =>
      prev === null ? null : (prev + 1) % stories.length,
    );
  }

  return (
    <section className="stories-section" aria-label="HayaNest BD stories">
      <HorizontalSlider
        rowClassName="story-row scroll-row"
        ariaLabel="HayaNest BD stories"
      >
        {stories.map((story, index) => {
          const optimizedVideoSrc = getOptimizedVideoUrl(story.videoSrc);
          const hasVideo = Boolean(optimizedVideoSrc);
          const isHovered = hoveredStoryId === story.id;
          return (
            <button
              key={story.id}
              type="button"
              className="story-card"
              draggable={false}
              onClick={() => openStoryModal(index)}
              onMouseEnter={() => {
                if (hasVideo) setHoveredStoryId(story.id);
              }}
              onMouseLeave={() => {
                if (hoveredStoryId === story.id) setHoveredStoryId(null);
              }}
              onFocus={() => {
                if (hasVideo) setHoveredStoryId(story.id);
              }}
              onBlur={() => {
                if (hoveredStoryId === story.id) setHoveredStoryId(null);
              }}
              aria-label={`Watch ${story.label} story video`}
            >
              <Image
                src={story.photo.src}
                alt=""
                fill
                loading="lazy"
                draggable={false}
                sizes="(min-width: 1024px) 165px, (min-width: 768px) 145px, 120px"
                style={{ objectPosition: story.photo.position }}
                unoptimized={story.photo.src.startsWith("http")}
              />
              {/* Lazy-loaded video preview: mounts and streams ONLY when hovered/focused */}
              {hasVideo && isHovered && (
                <video
                  src={optimizedVideoSrc}
                  className="story-card-video"
                  muted
                  loop
                  autoPlay
                  playsInline
                  preload="metadata"
                />
              )}
              <span className="story-gradient" />
              <span className="story-play-badge" aria-hidden="true">
                <Play size={12} fill="currentColor" />
              </span>
              <span className="story-caption">
                <span className="story-avatar">
                  <Image
                    src={story.avatar.src}
                    alt=""
                    width={34}
                    height={34}
                    loading="lazy"
                    draggable={false}
                    unoptimized={story.avatar.src.startsWith("http")}
                  />
                </span>
                <span className="story-label">{story.label}</span>
              </span>
            </button>
          );
        })}
      </HorizontalSlider>

      <LazyMotion features={domAnimation}>
        <AnimatePresence>
          {activeStory && activeIndex !== null && (
            <m.div
              key="story-modal-backdrop"
              className="story-modal-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label={`${activeStory.label} video story`}
              onClick={closeStoryModal}
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <m.div
                key={`story-modal-frame-${activeStory.id}`}
                className="story-modal-frame"
                onClick={(event) => event.stopPropagation()}
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Story Progress Segments */}
                <div className="story-modal-progress" aria-hidden="true">
                  {stories.map((item, idx) => (
                    <span
                      key={item.id}
                      className={`story-modal-progress-bar ${
                        idx < activeIndex
                          ? "is-viewed"
                          : idx === activeIndex
                            ? "is-active"
                            : ""
                      }`}
                    />
                  ))}
                </div>

                {/* Top Header: Avatar + Title + Mute + Cross (X) Close Button */}
                <div className="story-modal-header">
                  <div className="story-modal-author">
                    <span className="story-modal-avatar">
                      <Image
                        src={activeStory.avatar.src}
                        alt={activeStory.label}
                        width={38}
                        height={38}
                        unoptimized={activeStory.avatar.src.startsWith("http")}
                      />
                    </span>
                    <div className="story-modal-meta">
                      <strong>{activeStory.label}</strong>
                      <span>
                        {activeStory.videoSrc?.trim()
                          ? "HayaNest BD Video Reel"
                          : "HayaNest BD Story Highlight"}
                      </span>
                    </div>
                  </div>

                  <div className="story-modal-actions">
                    {activeStory.videoSrc?.trim() && (
                      <button
                        type="button"
                        className="story-modal-icon-btn"
                        onClick={() => setIsMuted((prev) => !prev)}
                        aria-label={isMuted ? "Unmute story video" : "Mute story video"}
                        title={isMuted ? "Unmute" : "Mute"}
                      >
                        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                      </button>
                    )}
                    <button
                      type="button"
                      className="story-modal-close"
                      onClick={closeStoryModal}
                      aria-label="Close story video"
                      title="Close story"
                    >
                      <X size={22} />
                    </button>
                  </div>
                </div>

                {/* Main Video / Reel Stage */}
                <div className="story-modal-stage">
                  {activeStory.videoSrc?.trim() ? (
                    <video
                      key={activeStory.id}
                      src={getOptimizedVideoUrl(activeStory.videoSrc)}
                      poster={activeStory.photo.src}
                      className="story-modal-video"
                      autoPlay
                      controls
                      playsInline
                      loop
                      muted={isMuted}
                      onEnded={showNextStory}
                    />
                  ) : (
                    <div className="story-modal-reel-fallback">
                      <Image
                        src={activeStory.photo.src}
                        alt={activeStory.photo.alt || activeStory.label}
                        fill
                        sizes="(min-width: 768px) 440px, 94vw"
                        className="story-modal-reel-image"
                        style={{ objectPosition: activeStory.photo.position }}
                        unoptimized={activeStory.photo.src.startsWith("http")}
                      />
                      <div className="story-modal-reel-overlay" />
                    </div>
                  )}

                  {/* Previous / Next Story Side Controls */}
                  {stories.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="story-modal-nav story-modal-nav-prev"
                        onClick={showPrevStory}
                        aria-label="Previous story"
                      >
                        <ChevronLeft size={22} />
                      </button>
                      <button
                        type="button"
                        className="story-modal-nav story-modal-nav-next"
                        onClick={showNextStory}
                        aria-label="Next story"
                      >
                        <ChevronRight size={22} />
                      </button>
                    </>
                  )}
                </div>

                {/* Bottom Footer / CTA inside Modal */}
                <div className="story-modal-footer">
                  <div className="story-modal-caption-text">
                    <strong>{activeStory.label}</strong>
                    <span>
                      {activeIndex + 1} of {stories.length}
                    </span>
                  </div>
                  <Link
                    href={activeStory.href?.trim() || "/shop"}
                    className="story-modal-cta"
                    onClick={closeStoryModal}
                  >
                    <span>Explore Collection</span>
                    <ExternalLink size={14} />
                  </Link>
                </div>
              </m.div>
            </m.div>
          )}
        </AnimatePresence>
      </LazyMotion>
    </section>
  );
}


