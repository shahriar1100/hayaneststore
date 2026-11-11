import Image from "next/image";
import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/#home"
      aria-label="HayaNest BD Home"
      className={`brand flex items-center gap-2.5 transition-opacity hover:opacity-95 ${
        compact ? "brand-small" : ""
      }`}
    >
      <div className="relative shrink-0 overflow-hidden rounded-full border border-amber-200/50 shadow-xs">
        <Image
          src="/hayanest-logo.jpg"
          alt="HayaNest BD Logo"
          width={compact ? 36 : 42}
          height={compact ? 36 : 42}
          className="object-cover"
          priority
        />
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-serif tracking-tight font-bold text-[22px] md:text-[26px] text-[#541438] dark:text-rose-100">
          HayaNest<span className="text-[#c59b6d] text-xs font-sans font-bold tracking-widest ml-1 uppercase">BD</span>
        </span>
        {!compact && (
          <span className="text-[9px] tracking-[0.2em] uppercase text-[#c59b6d] font-medium mt-0.5">
            Everything She Loves
          </span>
        )}
      </div>
    </Link>
  );
}
