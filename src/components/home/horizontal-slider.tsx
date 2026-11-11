"use client";

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type HorizontalSliderProps = {
  children: ReactNode;
  rowClassName: string;
  autoSlide?: boolean;
  speedPxPerFrame?: number;
  showControls?: boolean;
  ariaLabel?: string;
};

export function HorizontalSlider({
  children,
  rowClassName,
  autoSlide = false,
  speedPxPerFrame = 0.65,
  showControls = false,
  ariaLabel,
}: HorizontalSliderProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const didDragMoveRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const lastXRef = useRef(0);
  const velocityRef = useRef(0);
  const momentumFrameRef = useRef(0);
  const isPausedRef = useRef(false);
  const subPixelAccumulatorRef = useRef(0);

  const [isGrabbing, setIsGrabbing] = useState(false);

  useEffect(() => {
    return () => {
      if (momentumFrameRef.current) {
        window.cancelAnimationFrame(momentumFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!autoSlide) return;
    const container = rowRef.current;
    if (!container) return;

    let frameId = 0;

    const tick = () => {
      if (container && !isPausedRef.current && !isDraggingRef.current) {
        const halfWidth = container.scrollWidth / 2;
        if (halfWidth > 0 && container.scrollWidth > container.clientWidth) {
          subPixelAccumulatorRef.current += speedPxPerFrame;
          if (subPixelAccumulatorRef.current >= 1) {
            const step = Math.floor(subPixelAccumulatorRef.current);
            subPixelAccumulatorRef.current -= step;
            container.scrollLeft += step;
            if (container.scrollLeft >= halfWidth) {
              container.scrollLeft -= halfWidth;
            }
          }
        }
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [autoSlide, speedPxPerFrame]);

  function stopMomentum() {
    if (momentumFrameRef.current) {
      window.cancelAnimationFrame(momentumFrameRef.current);
      momentumFrameRef.current = 0;
    }
    velocityRef.current = 0;
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const container = rowRef.current;
    if (!container) return;

    stopMomentum();
    isDraggingRef.current = true;
    didDragMoveRef.current = false;
    startXRef.current = event.clientX;
    lastXRef.current = event.clientX;
    startScrollLeftRef.current = container.scrollLeft;
    if (event.pointerType === "mouse") {
      setIsGrabbing(true);
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) return;
    const container = rowRef.current;
    if (!container) return;

    const deltaX = event.clientX - startXRef.current;
    if (Math.abs(deltaX) > 6) {
      didDragMoveRef.current = true;
    }
    if (event.pointerType === "mouse" && didDragMoveRef.current) {
      const stepDelta = event.clientX - lastXRef.current;
      velocityRef.current = stepDelta;
      lastXRef.current = event.clientX;

      container.scrollLeft = startScrollLeftRef.current - deltaX;
      if (autoSlide) {
        const halfWidth = container.scrollWidth / 2;
        if (halfWidth > 0) {
          if (container.scrollLeft >= halfWidth) {
            container.scrollLeft -= halfWidth;
            startScrollLeftRef.current -= halfWidth;
          } else if (container.scrollLeft <= 0) {
            container.scrollLeft += halfWidth;
            startScrollLeftRef.current += halfWidth;
          }
        }
      }
    }
  }

  function stopDragging() {
    const wasDragging = isDraggingRef.current && didDragMoveRef.current;
    isDraggingRef.current = false;
    setIsGrabbing(false);

    const container = rowRef.current;
    if (wasDragging && container && Math.abs(velocityRef.current) > 1.5) {
      let currentVelocity = velocityRef.current * 1.35;
      const glide = () => {
        if (!container || Math.abs(currentVelocity) < 0.5) {
          momentumFrameRef.current = 0;
          return;
        }
        container.scrollLeft -= currentVelocity;
        currentVelocity *= 0.92;
        momentumFrameRef.current = window.requestAnimationFrame(glide);
      };
      momentumFrameRef.current = window.requestAnimationFrame(glide);
    }
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (didDragMoveRef.current) {
      event.preventDefault();
      event.stopPropagation();
      didDragMoveRef.current = false;
    }
  }

  function slideByDirection(direction: -1 | 1) {
    const container = rowRef.current;
    if (!container) return;
    const step = Math.max(180, Math.round(container.clientWidth * 0.6));
    container.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  return (
    <div
      className="horizontal-slider-shell"
      onMouseEnter={() => {
        isPausedRef.current = true;
      }}
      onMouseLeave={() => {
        isPausedRef.current = false;
        stopDragging();
      }}
      onTouchStart={() => {
        isPausedRef.current = true;
      }}
      onTouchEnd={() => {
        isPausedRef.current = false;
      }}
    >
      {showControls && (
        <button
          type="button"
          className="slider-nav-btn slider-nav-prev"
          aria-label={`Slide ${ariaLabel ?? "items"} left`}
          onClick={() => slideByDirection(-1)}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
      )}

      <div
        ref={rowRef}
        className={`${rowClassName} interactive-slider-row ${isGrabbing ? "is-grabbing" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onClickCapture={handleClickCapture}
      >
        {children}
      </div>

      {showControls && (
        <button
          type="button"
          className="slider-nav-btn slider-nav-next"
          aria-label={`Slide ${ariaLabel ?? "items"} right`}
          onClick={() => slideByDirection(1)}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
