import { ArrowRight } from "lucide-react";
import { ComingSoonButton } from "@/components/ui/coming-soon";
import type { ReactNode } from "react";
import Link from "next/link";

type SectionHeadingProps = {
  id: string;
  title: string;
  badge?: string;
  badgeIcon?: ReactNode;
  subtitle?: string;
  seeAll?: boolean;
  seeAllHref?: string;
  children?: ReactNode;
  className?: string;
};

export function SectionHeading({
  id,
  title,
  badge,
  badgeIcon,
  subtitle,
  seeAll = false,
  seeAllHref,
  children,
  className = "",
}: SectionHeadingProps) {
  return (
    <div className={`section-heading ${badge || subtitle ? "section-heading-featured" : ""} ${className}`}>
      <div className="section-heading-main">
        {badge && (
          <span className="section-badge">
            {badgeIcon}
            <span>{badge}</span>
          </span>
        )}
        <div className="section-title-row">
          <h2 id={id}>{title}</h2>
          {children}
        </div>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {seeAll &&
        (seeAllHref ? (
          <Link href={seeAllHref} className="see-all" aria-label={`See all ${title.toLowerCase()}`}>
            See All <ArrowRight size={18} />
          </Link>
        ) : (
          <ComingSoonButton
            feature={`All ${title.toLowerCase()}`}
            className="see-all"
            aria-label={`See all ${title.toLowerCase()} — Coming soon`}
          >
            See All <ArrowRight size={18} />
          </ComingSoonButton>
        ))}
    </div>
  );
}
