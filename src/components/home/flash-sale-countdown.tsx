"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

const INITIAL_SECONDS = 2 * 3600 + 36 * 60 + 58;

type FlashSaleCountdownProps = {
  endsAt?: string | null;
  onExpire?: () => void;
};

export function FlashSaleCountdown({ endsAt, onExpire }: FlashSaleCountdownProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(INITIAL_SECONDS);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!endsAt) {
      const resetTimer = window.setTimeout(() => {
        setIsExpired(false);
        setRemainingSeconds(INITIAL_SECONDS);
      }, 0);
      const interval = window.setInterval(() => {
        setRemainingSeconds((prev) => (prev > 1 ? prev - 1 : INITIAL_SECONDS));
      }, 1000);
      return () => {
        window.clearTimeout(resetTimer);
        window.clearInterval(interval);
      };
    }

    const targetMs = Date.parse(endsAt);
    if (Number.isNaN(targetMs)) {
      return;
    }

    let notifiedExpire = false;
    const updateRemaining = () => {
      const diff = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
      setRemainingSeconds(diff);
      if (diff <= 0) {
        setIsExpired(true);
        if (!notifiedExpire) {
          notifiedExpire = true;
          onExpire?.();
        }
      } else {
        setIsExpired(false);
      }
    };

    const initialTimer = window.setTimeout(updateRemaining, 0);
    const interval = window.setInterval(updateRemaining, 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [endsAt, onExpire]);

  const days = Math.floor(remainingSeconds / 86400);
  const hours = String(Math.floor((remainingSeconds % 86400) / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(remainingSeconds % 60).padStart(2, "0");

  return (
    <div
      className="sale-countdown"
      role="timer"
      aria-label={
        isExpired
          ? "Flash sale has ended"
          : `Flash sale ends in ${days > 0 ? `${days} days, ` : ""}${hours} hours, ${minutes} minutes, ${seconds} seconds`
      }
    >
      <span className="countdown-demo">{isExpired ? "Sale Ended" : "Ends in"}</span>
      <Timer aria-hidden="true" />
      {days > 0 && !isExpired ? <span aria-hidden="true">{days}d</span> : null}
      <span aria-hidden="true">{isExpired ? "00" : hours}</span>
      <span aria-hidden="true">{isExpired ? "00" : minutes}</span>
      <span aria-hidden="true">{isExpired ? "00" : seconds}</span>
    </div>
  );
}

