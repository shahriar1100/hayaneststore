"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { CatalogProduct } from "@/types/store";
import {
  categoryOptions,
  colourOptions,
  fabricOptions,
  priceOptions,
  sortOptions,
  type CatalogTaxonomy,
} from "@/data/shop-options";
import { emptyFilters, filterCount, filterProducts, parseShopFilters, shopUrl, type ShopFilters } from "@/lib/shop";
import { FilterFields } from "./filter-fields";
import { ShopResults } from "./shop-results";

const filterChangeEvent = "noor:shop-filter-change";

function subscribeToFilterURL(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(filterChangeEvent, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(filterChangeEvent, onChange);
  };
}

function readFilterURL() { return window.location.search.slice(1); }

export function ShopCatalog({
  products,
  taxonomy,
}: {
  products: CatalogProduct[];
  taxonomy?: CatalogTaxonomy;
}) {
  const [fetchedCatalog, setFetchedCatalog] = useState<{
    products?: CatalogProduct[];
    taxonomy?: CatalogTaxonomy;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function refreshCatalog() {
      try {
        const res = await fetch("/api/catalog", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          products?: CatalogProduct[];
          taxonomy?: CatalogTaxonomy;
        };
        if (cancelled || !data.ok) return;
        setFetchedCatalog({
          ...(Array.isArray(data.products) ? { products: data.products } : {}),
          ...(data.taxonomy ? { taxonomy: data.taxonomy } : {}),
        });
      } catch {
        // Keep current products and taxonomy on network error
      }
    }
    void refreshCatalog();
    window.addEventListener("focus", refreshCatalog);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshCatalog);
    };
  }, []);

  const liveProducts = fetchedCatalog?.products ?? products;
  const liveTaxonomy = fetchedCatalog?.taxonomy ?? taxonomy;

  // Also subscribe to Next navigation so header/category links refresh this page.
  const searchParams = useSearchParams();
  // Read the browser URL synchronously for controlled inputs and Back/Forward.
  // Waiting for a router transition can otherwise lose fast input characters.
  const queryString = useSyncExternalStore(subscribeToFilterURL, readFilterURL, () => searchParams.toString());
  const filters = parseShopFilters(new URLSearchParams(queryString), liveTaxonomy);
  const matching = filterProducts(liveProducts, filters);
  const selectedCount = filterCount(filters);
  const hasFilters = selectedCount > 0 || Boolean(filters.query.trim());
  const [draft, setDraft] = useState<ShopFilters>(emptyFilters);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const draftCount = filterProducts(liveProducts, draft).length;

  // Next updates browser history after rendering route changes. Notify our URL
  // subscribers after that commit as well as after local filter interactions.
  useEffect(() => {
    window.dispatchEvent(new Event(filterChangeEvent));
  }, [searchParams]);

  function updateFilters(next: ShopFilters, replace = false) {
    // Next's native History API integration keeps query links, reload and Back/
    // Forward in sync without fetching a backend or remounting the search field.
    if (replace) window.history.replaceState(null, "", shopUrl(next));
    else window.history.pushState(null, "", shopUrl(next));
    window.dispatchEvent(new Event(filterChangeEvent));
  }

  function closeDrawer() {
    drawer.current?.close();
  }

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onResize = () => { if (desktop.matches) drawer.current?.close(); };
    desktop.addEventListener("change", onResize);
    return () => desktop.removeEventListener("change", onResize);
  }, []);

  const groups = [
    {
      key: "categories",
      label: "Category",
      options: liveTaxonomy?.categories?.length ? liveTaxonomy.categories : categoryOptions,
    },
    {
      key: "fabrics",
      label: "Fabric",
      options: liveTaxonomy?.fabrics?.length ? liveTaxonomy.fabrics : fabricOptions,
    },
    {
      key: "colours",
      label: "Colour",
      options: liveTaxonomy?.colours?.length ? liveTaxonomy.colours : colourOptions,
    },
  ] as const;

  return <div className="shop-catalog">
    <div className="shop-toolbar">
      <form role="search" aria-label="Product search" className="shop-search" onSubmit={(event) => event.preventDefault()}>
        <Search size={19} aria-hidden="true" />
        <label htmlFor="shop-search-input" className="sr-only">Search products</label>
        <input id="shop-search-input" type="search" autoComplete="off" placeholder="Search hijabs, fabrics, colours…" value={filters.query} maxLength={160} onChange={(event) => updateFilters({ ...filters, query: event.target.value }, true)} />
        {filters.query && <button type="button" className="icon-button" aria-label="Clear search" onClick={() => updateFilters({ ...filters, query: "" }, true)}><X size={17} /></button>}
      </form>
      <button ref={trigger} type="button" className="shop-filter-trigger" aria-haspopup="dialog" aria-expanded={drawerOpen} aria-controls="shop-filter-drawer" onClick={() => { setDraft(filters); drawer.current?.showModal(); setDrawerOpen(true); }}><SlidersHorizontal size={18} aria-hidden="true" />Filters{selectedCount > 0 && <span className="shop-filter-count">{selectedCount}</span>}</button>
      <label className="shop-sort"><span>Sort by</span><select aria-label="Sort products" value={filters.sort} onChange={(event) => updateFilters({ ...filters, sort: sortOptions.find((option) => option.value === event.target.value)?.value ?? "featured" })}>{sortOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
    </div>

    <div className="shop-summary">
      <p className="shop-result-count" role="status" aria-live="polite" aria-atomic="true"><strong>{matching.length}</strong> {matching.length === 1 ? "product" : "products"}{hasFilters && <span> found</span>}</p>
      {hasFilters && <div className="shop-active-filters" aria-label="Applied filters">
        {filters.query.trim() && <button type="button" className="shop-filter-chip" onClick={() => updateFilters({ ...filters, query: "" })} aria-label={`Remove search: ${filters.query}`}><span>“{filters.query}”</span><X size={13} aria-hidden="true" /></button>}
        {groups.flatMap((group) => group.options.filter((option) => (filters[group.key] as readonly string[]).includes(option.value)).map((option) => <button type="button" className="shop-filter-chip" key={`${group.key}-${option.value}`} aria-label={`Remove ${group.label.toLowerCase()}: ${option.label}`} onClick={() => updateFilters({ ...filters, [group.key]: (filters[group.key] as readonly string[]).filter((value) => value !== option.value) })}><span>{option.label}</span><X size={13} aria-hidden="true" /></button>))}
        {filters.price !== "all" && <button type="button" className="shop-filter-chip" aria-label="Remove price filter" onClick={() => updateFilters({ ...filters, price: "all" })}><span>{priceOptions.find((option) => option.value === filters.price)?.label}</span><X size={13} aria-hidden="true" /></button>}
        <button type="button" className="shop-clear-link" onClick={() => updateFilters(emptyFilters)}>Clear all</button>
      </div>}
    </div>

    <div className="shop-layout">
      <aside className="shop-sidebar" aria-label="Product filters"><div className="shop-sidebar-heading"><h2>Filters</h2><button type="button" className="shop-clear-link" disabled={!hasFilters} onClick={() => updateFilters(emptyFilters)}>Clear</button></div><FilterFields value={filters} onChange={updateFilters} prefix="sidebar" taxonomy={liveTaxonomy} /></aside>
      <section className="shop-results" aria-labelledby="shop-products-heading"><h2 id="shop-products-heading" className="sr-only">Products</h2><ShopResults key={shopUrl(filters)} products={matching} onClear={() => updateFilters(emptyFilters)} /></section>
    </div>

    <dialog ref={drawer} id="shop-filter-drawer" className="shop-filter-drawer" aria-labelledby="shop-filter-title" aria-describedby="shop-filter-description" onClose={() => { setDrawerOpen(false); if (trigger.current?.getClientRects().length) trigger.current.focus(); else document.getElementById("shop-search-input")?.focus(); }} onClick={(event) => { if (event.target === event.currentTarget) closeDrawer(); }} onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]');
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <div className="shop-drawer-shell"><div className="shop-drawer-heading"><div><h2 id="shop-filter-title">Find your favourites</h2><p id="shop-filter-description">Choose your filters, then apply.</p></div><button type="button" className="icon-button" aria-label="Close filters" onClick={closeDrawer}><X size={22} /></button></div>
        <div className="shop-drawer-scroll"><FilterFields value={draft} onChange={setDraft} prefix="drawer" taxonomy={liveTaxonomy} /></div>
        <div className="shop-drawer-actions"><button type="button" className="shop-clear-button" onClick={() => setDraft({ ...emptyFilters, sort: draft.sort })}>Clear</button><button type="button" className="shop-primary-button" onClick={() => { updateFilters(draft); closeDrawer(); }}>Apply filters <span>({draftCount})</span></button></div>
      </div>
    </dialog>
  </div>;
}
