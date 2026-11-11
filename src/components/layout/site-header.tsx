import { ChevronDown, UserRound } from "lucide-react";
import { categories, navigation } from "@/data/store";
import { Brand } from "@/components/ui/brand";
import { SearchControl } from "@/components/ui/search-control";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import Link from "next/link";
import { NavigationDrawer } from "./navigation-drawer";
import { SavedLink } from "./saved-link";
import { CartButton } from "@/components/cart/cart-button";

export function SiteHeader({ activePage = "home" }: { activePage?: "home" | "shop" | "saved" | "cart" | "account" }) {
  return <header className="site-header page-container"><Brand /><nav aria-label="Main navigation" className="desktop-nav">{navigation.map((item) => <Link className={item.label.toLowerCase() === activePage ? "active" : ""} href={item.href ?? "/"} key={item.label} aria-current={item.label.toLowerCase() === activePage ? "page" : undefined}>{item.label}{item.label === "Collections" && <ChevronDown size={14} />}</Link>)}</nav><div className="header-actions"><SearchControl catalogSearch /><span className="header-theme-control"><ThemeToggle /></span><SavedLink variant="header" active={activePage === "saved"} /><Link href="/account" className={`icon-button header-account ${activePage === "account" ? "active" : ""}`} aria-label="Account" aria-current={activePage === "account" ? "page" : undefined}><UserRound /></Link><CartButton /><NavigationDrawer activePage={activePage} categories={categories.map(({ id, name, href }) => ({ id, name, href }))} /></div></header>;
}
