"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { Category } from "@/types/store";

const secondaryPages = [
  { label: "My Orders", href: "/account" },
  { label: "About Us", href: "/about" },
  { label: "Contact Us", href: "/contact" },
  { label: "Delivery & Returns", href: "/shipping-returns" },
  { label: "Help / FAQ", href: "/faq" },
];

export function NavigationDrawer({ activePage, categories }: {
  activePage: "home" | "shop" | "saved" | "cart" | "account";
  categories: Pick<Category, "id" | "name" | "href">[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [dynamicCategories, setDynamicCategories] = useState<Pick<Category, "id" | "name" | "href">[]>(categories);

  function close() { dialog.current?.close(); }

  function refreshCategories() {
    fetch("/api/catalog", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            ok?: boolean;
            taxonomy?: {
              categories?: Array<{ value: string; label: string }>;
              fabrics?: Array<{ value: string; label: string }>;
            };
          } | null,
        ) => {
          if (!data?.ok || !data.taxonomy) return;
          const customCats = (data.taxonomy.categories ?? [])
            .filter((c) => c.value !== "hijabs" && c.value !== "accessories")
            .map((c) => ({
              id: c.value,
              name: c.label,
              href: `/shop?category=${encodeURIComponent(c.value)}`,
            }));
          const fabricCats = (data.taxonomy.fabrics ?? []).map((f) => ({
            id: f.value,
            name: f.label,
            href: `/shop?fabric=${encodeURIComponent(f.value)}`,
          }));
          const accessoriesCat = (data.taxonomy.categories ?? []).find(
            (c) => c.value === "accessories",
          );
          const merged = [
            ...customCats,
            ...fabricCats,
            ...(accessoriesCat
              ? [{ id: "accessories", name: accessoriesCat.label, href: "/shop?category=accessories" }]
              : []),
          ];
          if (merged.length > 0) {
            setDynamicCategories(merged);
          }
        },
      )
      .catch(() => {
        // Keep static categories fallback
      });
  }

  useEffect(() => {
    refreshCategories();
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onResize = () => { if (desktop.matches) dialog.current?.close(); };
    const onHistory = () => dialog.current?.close();
    desktop.addEventListener("change", onResize);
    window.addEventListener("popstate", onHistory);
    return () => {
      desktop.removeEventListener("change", onResize);
      window.removeEventListener("popstate", onHistory);
    };
  }, []);

  function containFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]'))
      .filter((element) => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  return <>
    <button ref={trigger} type="button" className="icon-button menu-trigger" aria-label="Open menu" aria-haspopup="dialog" aria-controls="navigation-drawer" aria-expanded={open} onClick={() => {
      refreshCategories();
      setCategoriesOpen(false);
      dialog.current?.showModal();
      setOpen(true);
    }}><Menu aria-hidden="true" /></button>

    <dialog ref={dialog} id="navigation-drawer" className="navigation-drawer" aria-labelledby="navigation-drawer-title" onKeyDown={containFocus} onClick={(event) => { if (event.target === event.currentTarget) close(); }} onClose={() => {
      setOpen(false);
      if (trigger.current?.getClientRects().length) trigger.current.focus({ preventScroll: true });
      else document.querySelector<HTMLAnchorElement>(".site-header .brand")?.focus({ preventScroll: true });
    }}>
      <div className="navigation-drawer-shell">
        <div className="navigation-drawer-heading"><div><span className="menu-eyebrow">EXPLORE HAYANEST BD</span><h2 id="navigation-drawer-title">Menu</h2></div><button type="button" className="icon-button" aria-label="Close menu" onClick={close}><X aria-hidden="true" /></button></div>
        <nav className="navigation-drawer-scroll" aria-label="Menu navigation">
          <ul className="menu-primary-links">
            <li><Link href="/#home" className="menu-link" aria-current={activePage === "home" ? "page" : undefined} onNavigate={close}>Home<ChevronRight aria-hidden="true" /></Link></li>
            <li><Link href="/shop" className="menu-link" aria-current={activePage === "shop" ? "page" : undefined} onNavigate={close}>Shop All<ChevronRight aria-hidden="true" /></Link></li>
            <li><Link href="/saved" className="menu-link" aria-current={activePage === "saved" ? "page" : undefined} onNavigate={close}>Saved products<ChevronRight aria-hidden="true" /></Link></li>
            <li><Link href="/account" className="menu-link" aria-current={activePage === "account" ? "page" : undefined} onNavigate={close}>My Account<ChevronRight aria-hidden="true" /></Link></li>
            <li><button type="button" className="menu-link menu-category-toggle" aria-expanded={categoriesOpen} aria-controls="menu-category-links" onClick={() => setCategoriesOpen(!categoriesOpen)}>Categories<ChevronDown aria-hidden="true" /></button>
              <ul id="menu-category-links" className="menu-category-links" hidden={!categoriesOpen}>{dynamicCategories.map((category) => <li key={category.id}><Link href={category.href} onNavigate={close}>{category.name}<ChevronRight aria-hidden="true" /></Link></li>)}</ul>
            </li>
          </ul>
          <ul className="menu-secondary-links">
            {secondaryPages.map((page) => (
              <li key={page.label}>
                <Link href={page.href} className="menu-link" onNavigate={close}>
                  {page.label}
                  <ChevronRight aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="navigation-drawer-footer"><ThemeToggle variant="menu" /></div>
      </div>
    </dialog>
  </>;
}
