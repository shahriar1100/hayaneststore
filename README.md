# NOOR — storefront preview

A responsive hijab boutique homepage, shop and product details with light and dark themes, built with Next.js App Router, TypeScript and Tailwind CSS. Routes are `/`, `/shop` and `/products/[slug]`. There are no commerce services, cart, checkout, API routes, authentication, payments or deployment configuration.

## Run locally

Use Node.js 22.13 or newer and npm:

```sh
npm install
npm run dev
```

Open http://localhost:3000. On this Windows machine, PowerShell blocks `npm.ps1`; use `npm.cmd install` and `npm.cmd run dev` instead. This does not require changing the execution policy.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
npm run start
```

With the local server running, `npm run check:ui` checks widths 320, 360, 390, 768, 834, 1024, 1200 and 1440px in both themes using headless Chrome. It checks overflow, section order, images, grids, footer visibility, bottom-navigation clearance, search, feedback and axe accessibility rules. It also verifies theme persistence, system preference changes, cross-tab synchronization, keyboard toggling and blocked browser storage. Full-page and footer screenshots plus a JSON report are saved in the ignored `output/qa/` folder. The check uses an installed Google Chrome browser; set `PREVIEW_URL` if your server is not at http://localhost:3000.

See [verification results and known demo limitations](docs/verification.md).

`npm run check:shop` checks the shop in both themes at 320, 360, 390, 768, 834, 1024 and 1440px. It covers responsive grids, sidebar/drawer behaviour, focus containment and restoration, Apply/Clear, combined filters, sorting, search, pagination, query links and browser history, image loading/fallback and axe accessibility. Its reports and screenshots are saved to the ignored `output/shop-qa/` folder.

`npm run check:navigation` checks the homepage and shop in both themes at 320, 390, 768, 834, 1024 and 1440px. It covers the responsive header, bottom navigation and active links, menu/category routing, keyboard focus, dismissal, background scroll locking, reduced motion, theme persistence, Coming soon feedback and a short landscape viewport. Screenshots and reports are saved to the ignored `output/navigation-qa/` folder.

`npm run check:products` checks product details in both themes at 320, 360, 390, 768, 834, 1024 and 1440px. It covers gallery controls, image loading/fallback, colour selection, stock/quantity limits, keyboard access, cart-preview feedback, all 28 product routes, homepage links, shared navigation and invalid slugs. Screenshots and reports are saved to the ignored `output/product-qa/` folder.

## Editing the storefront

- `src/data/catalog.ts`: the shared typed catalogue of 28 demo products, stable slugs, BDT prices, fabric/category/colour and dates used for sorting. Homepage selections use this same catalogue while preserving their approved names, prices, images and order.
- `src/data/product-details.ts`: local demo descriptions, dimensions, materials, colour variants, stock and galleries assembled from existing photo references. These are sample product details, not live inventory.
- `src/data/photos.ts`: every photo URL, alt description and crop position, ready to be replaced with future uploaded assets.
- `src/data/store.ts`: homepage product selections, stories, category links, navigation, demo contacts and the static sale timer.
- `src/data/shop-options.ts` and `src/lib/shop.ts`: typed filter choices, URL parsing, filtering and sorting.
- `src/types/store.ts`: shared data types.
- `src/components/home/`: homepage sections; `product/`: reusable product card, photo fallback, gallery and local product controls; `layout/`: shared header, menu drawer, footer and bottom navigation.
- `src/components/shop/`: interactive catalogue, shared filter fields and Load More. The page title and shared frame remain Server Components. A small product-photo component provides a simple styled placeholder if an image fails.
- `src/app/globals.css`: brand tokens, layout and responsive styling. The main breakpoints are 768px (tablet), 1024px (desktop), and 1200px (expanded desktop search).
- `src/app/shop/shop.css`: scoped shop styles; desktop filters start at 1024px, and the catalogue uses 2/3/4 columns at mobile/tablet/desktop widths.
- `src/app/products/[slug]/`: product page, metadata, scoped styles and a friendly missing-product state. Static names, prices, descriptions, specifications and delivery notes are rendered by the Server Component; gallery, colour and quantity selections are Client Components.
- `public/images/`: existing local WebP assets. Replace these files or update `photos.ts`. No new pictures were created for the shop. A future remote image host also needs an explicit `images.remotePatterns` entry in `next.config.ts`.

The placeholders were generated specifically for this mockup using the built-in image-generation tool. No screenshots or screenshot fragments are used as page content. See [demo image provenance and prompts](docs/demo-images.md).

Additional portrait and folded-fabric prompts are recorded in [the additional image notes](docs/additional-demo-images.md).

For future changes, use supplied or existing images only. Do not generate new images unless explicitly requested. Image references remain centralized for the planned dynamic data source; this phase does not add that backend.

## Preview behaviour

The homepage hero CTA and section links still scroll to their original sections. Header Shop and homepage category links open `/shop`; category links preselect their corresponding fabric or Accessories. Product cards and circular Top Products link to `/products/[slug]`. Story, saved, account, header/bottom bag, social and other unfinished controls keep their Coming soon feedback. The bag count of 3, contact details and static sale timer remain demo content.

Product details reuse the same product names, BDT prices and primary photos as the cards. Example: `/products/premium-modal-rose`. The 28 known product paths are prerendered with [generateStaticParams](https://nextjs.org/docs/app/api-reference/functions/generate-static-params); unknown slugs return a 404 with a Back to Shop link. Gallery arrows and thumbnails work locally. Selecting a colour changes the gallery and demo stock; quantity stays between 1 and available stock, clamps when switching to a lower-stock colour, and is disabled when out of stock. Selection resets on a fresh page load. Add to Bag only announces “Cart feature coming next”; it does not change the badge, store a cart or send an order. Dimensions and availability are visibly identified as demo data, and delivery timing/charges are left unconfirmed. No images were generated for this phase: galleries reference the existing URLs in the data layer, with the shared placeholder on image failure.

The shop searches names, fabrics, colours and categories as you type. Options within a filter group are ORed; separate groups and the search are ANDed. Price bands use the displayed current price (including demo discounts). Sort options are featured order, newest, price ascending/descending, and name. Load More adds 12 products; changing search, filters or sort starts again with 12. The empty state clears all filters and search. Mobile/tablet drawer selections are drafts until Apply; Clear resets the draft, and Escape/close discards it. The desktop sidebar applies changes immediately.

Shop state is shareable through query parameters: `q`, comma-separated `fabric`, `category`, `colour`, `price`, and `sort`. Example: `/shop?fabric=modal&colour=rose&price=500-699`. Unknown values are ignored. The [Next.js native History API](https://nextjs.org/docs/app/getting-started/linking-and-navigating#native-history-api) keeps filtering, reload and Back/Forward synchronized. A synchronous URL subscription keeps controlled inputs responsive during router transitions, including fast typing and history navigation. Search uses replacement history so each keystroke does not add an entry. The shop header search also works; the homepage's original search preview behaviour is preserved.

Stories directly follow the hero. Categories stay in a single compact circular row. New Items and Most Popular scroll horizontally on mobile, then show three tablet cards and four desktop cards. Flash Sale uses three columns on mobile/tablet and six on desktop. Just For You uses 2/3/4 columns; its curated preview contains four cards on mobile/desktop and six on tablet, following the supplied designs. The footer is visible on every device. Mobile/tablet also retain fixed navigation, with safe-area padding below the footer to keep its content accessible.

Below 1024px, the header shows the NOOR logo, Search and Menu. The bottom navigation is Home, Shop, Saved, Bag and Account; Home/Shop highlight the current page and Bag retains its demo quantity. The menu opens from the right with Home, Shop All, expandable categories, My Orders, About Us, Contact Us, Delivery & Returns, Help / FAQ and the existing theme toggle. Category destinations reuse the homepage's filter URLs. Unbuilt pages give live Coming soon feedback inside the drawer. Close, backdrop, Escape and client navigation dismiss the drawer; keyboard focus is contained and restored to Menu on dismissal. The background is locked, long menu content scrolls, safe-area padding is retained and reduced-motion users get no slide animation. Resizing to desktop closes the drawer and moves focus to the logo, since Menu is then hidden. The desktop header, theme control and cart remain unchanged; the bottom navigation stays hidden there.

The desktop header's moon/sun button and the mobile/tablet menu's Dark mode switch use the same theme control. On the first visit, the page follows the device's colour preference; a manual choice is saved in `localStorage` under `noor-theme` and synchronized between tabs. A small head script applies the theme before the first paint. With storage blocked, the toggle still works for the current visit. Theme colours are CSS variables in `globals.css`; existing photographs retain their natural colours.

Static page and section content are Server Components. Client components handle interactive buttons, feedback, search, the catalogue and drawer, photo failure fallback, and theme selection. The native [modal dialog](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal) makes background content inert; drawer keyboard handling wraps focus and restores it on close. The theme toggle uses React's [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore), with the initial theme following [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme). System fonts avoid external font requests.

Setup follows the official [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation) and [Tailwind PostCSS guide](https://tailwindcss.com/docs/installation/using-postcss).
