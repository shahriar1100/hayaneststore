import { Mail, MapPin, Phone } from "lucide-react";
import { demoContact, footerLinks } from "@/data/store";
import { Brand } from "@/components/ui/brand";
import { ComingSoonButton } from "@/components/ui/coming-soon";
import { SocialIcon } from "@/components/ui/social-icon";
import { getStoreSettings } from "@/lib/server/store-repository";
import Link from "next/link";

export async function SiteFooter() {
  const settings = await getStoreSettings();
  const contactEmail = settings.contactEmail?.trim() || demoContact.email;
  const contactPhone = settings.contactPhone?.trim() || demoContact.phone;
  const contactLocation = settings.contactLocation?.trim() || demoContact.location;
  const isCustomContact =
    contactEmail !== demoContact.email ||
    contactPhone !== demoContact.phone ||
    contactLocation !== demoContact.location;

  const socialUrls: Record<"Facebook" | "Instagram" | "YouTube" | "TikTok", string | undefined> = {
    Facebook: settings.socialLinks?.facebook?.trim(),
    Instagram: settings.socialLinks?.instagram?.trim(),
    YouTube: settings.socialLinks?.youtube?.trim(),
    TikTok: settings.socialLinks?.tiktok?.trim(),
  };

  return (
    <footer className="site-footer">
      <div className="page-container footer-grid">
        <div className="footer-brand">
          <Brand compact />
          <p>Everything She Loves<br />Modest Elegance & Everyday Essentials</p>
        </div>
        {footerLinks.map((group) => (
          <div key={group.title} className="footer-group">
            <h2>{group.title}</h2>
            <ul>
              {group.items.map((item) => (
                <li key={item.label}>
                  {item.href ? (
                    <Link href={item.href}>{item.label}</Link>
                  ) : (
                    <ComingSoonButton feature={item.feature ?? item.label}>{item.label}</ComingSoonButton>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="footer-contact">
          <h2>
            Contact {!isCustomContact && <span className="demo-contact-label">Demo details</span>}
          </h2>
          <ul>
            <li><Mail />{contactEmail}</li>
            <li><Phone />{contactPhone}</li>
            <li><MapPin />{contactLocation}</li>
          </ul>
        </div>
        <div className="footer-social">
          <div className="social-links">
            {(["Facebook", "Instagram", "YouTube", "TikTok"] as const).map((name) => {
              const href = socialUrls[name];
              return href ? (
                <a
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="icon-button"
                  aria-label={name}
                >
                  <SocialIcon name={name} />
                </a>
              ) : (
                <ComingSoonButton
                  key={name}
                  feature={`${name} page`}
                  className="icon-button"
                  aria-label={`${name} — Coming soon`}
                >
                  <SocialIcon name={name} />
                </ComingSoonButton>
              );
            })}
          </div>
          <p>© {new Date().getFullYear()} HayaNest BD. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
