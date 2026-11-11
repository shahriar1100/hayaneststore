# Storefront verification

Verified locally on 2026-10-09 with Node.js 22.17, Next.js 16.4, and headless Google Chrome.

## Product details phase

The new route is `/products/[slug]`, using the existing 28-product catalogue. Names, prices and primary photos remain shared with homepage/shop cards. No new images, dependencies or commerce services were added. Size, variants and stock are typed local demo values; the page identifies them as such.

| Check | Result |
| --- | --- |
| ESLint / TypeScript / production build | Passed; all 28 known product paths are prerendered |
| Responsive layouts | Stacked on mobile, two columns on tablet/desktop; no overflow at 320, 360, 390, 768, 834, 1024 or 1440px, in either theme |
| Gallery | Existing photos load; arrows, thumbnails and colour-dependent galleries work; missing-image simulation shows the shared placeholder |
| Colour / quantity | Native radio keyboard navigation works; quantity stays within stock, clamps on lower-stock selections, and disables with Add to Bag when out of stock |
| Add to Bag | Announces “Cart feature coming next”; demo bag count remains 3 |
| Routing | All 28 detail URLs return 200 and matching product names/prices; each homepage product section and circular Top Products open valid details |
| Invalid slug | Returns 404 with a working Back to Shop link |
| Shared frame | Existing menu, theme toggle, footer and bottom navigation work on product pages; footer clears bottom navigation by over 20px |
| Accessibility | No axe WCAG 2 A/AA or 2.1 AA violations at 390, 834 or 1440px in either theme, including the out-of-stock state |
| Visual review | Mobile, tablet and desktop captures inspected in light/dark themes |

Run `npm run check:products` against the local server. Reports and screenshots are in ignored `output/product-qa/`. Full-page screenshots show fixed navigation at the original viewport edge; scroll measurements confirm content remains reachable. Browser checks found no unexpected console or runtime errors. The homepage and shop regression suites also passed after updating product links.

## Navigation update

`npm run check:navigation` passed on `/` and `/shop` in light and dark themes at 320, 390, 768, 834, 1024 and 1440px (24 combinations), with no unexpected console or runtime errors.

- Mobile/tablet header contains the logo, Search and Menu; desktop navigation, theme switch and cart remain visible only at their existing desktop breakpoints.
- Bottom navigation is Home, Shop, Saved, Bag and Account, with the active route marked and Bag's quantity retained. Footer clearance exceeds 20px at maximum scroll; bottom and horizontal safe-area padding is included.
- Home, Shop All and all five category links navigate correctly and close the menu. All unbuilt destinations announce Coming soon inside the drawer.
- Initial focus, Tab/Shift+Tab wrapping, keyboard category expansion, Escape, backdrop, Close and focus restoration passed. Background wheel scrolling is blocked while open and unlocked after closing.
- Theme switching by keyboard and pointer, saved preference after reload and desktop/menu state consistency passed. Reduced-motion mode disables the slide animation.
- A short 834×390 landscape viewport can scroll the expanded menu while keeping Close and the theme control reachable. Resizing to desktop closes the drawer and restores focus to the logo.
- Axe found no WCAG 2 A/AA or 2.1 AA violations in expanded drawers with Coming soon feedback at 390 and 834px, in both themes. Light/dark drawer, mobile header/bottom navigation and desktop captures were visually reviewed.

The existing homepage and shop browser suites also passed after this update, along with ESLint, TypeScript and the production build. Screenshots and reports are in the ignored `output/navigation-qa/` folder. Existing pages, product data and image files were preserved; no routes or backend features were added.

## Shop phase

The new route is `/shop`; the homepage's design, photos, section order and product selections are preserved. No new images or dependencies were added. The catalogue has 28 typed local demo products, shared with homepage selections, and all image URLs remain in the data layer. The complete shop browser suite passed against the production build on local port 3100, with no unexpected console or runtime errors.

| Check | Result |
| --- | --- |
| ESLint / TypeScript / production build | Passed; `/` and `/shop` are static routes |
| Responsive shop | 2 mobile, 3 tablet, 4 desktop columns; no page overflow at 320, 360, 390, 768, 834, 1024 or 1440px in either theme |
| Filter presentation | Desktop sidebar; mobile/tablet modal drawer with draft selections, Apply, Clear and cancel |
| Keyboard | Drawer initial focus, Tab/Shift+Tab containment, Escape and focus restoration passed |
| Combined filters | OR within a group, AND across category/fabric/colour/price/search; counts and removable chips passed |
| Search / sort | Fast typing, editing within text, empty-state clearing, header search and all five sort choices passed |
| Load More | 12 → 24 → 28 distinct products, correct completion and reset on filter/sort changes |
| Navigation | All five homepage category links, Shop link, URL reload and Back/Forward passed |
| Images / product controls | Local images load; simulated missing images show the styled fallback; product cards now open their detail routes |
| Automated accessibility | No axe WCAG 2 A/AA or 2.1 AA violations at 390, 834 or 1440px in either theme, in the drawer or in the empty state |
| Visual review | Mobile, tablet, desktop and drawer captures inspected in light/dark themes; footer remains clear of mobile navigation |
| Homepage regression | Existing `check:ui` suite passed at all eight widths in both themes after the shared component changes |

Run `npm run check:shop` against a running local server (`PREVIEW_URL` selects a different URL). Shop screenshots and reports are in the ignored `output/shop-qa/` folder. Full-page captures show fixed navigation at the original viewport edge; maximum-scroll measurements verify footer clearance. These are local demo interactions, with no backend, cart, checkout or authentication.

## Homepage and theme checks

| Check | Result |
| --- | --- |
| ESLint | Passed, no errors or warnings |
| TypeScript (`tsc --noEmit`) | Passed |
| Production build (`next build`) | Passed; homepage prerendered as static content |
| Browser console and runtime errors | None |
| Image loading | All rendered local images loaded |
| Section order | Matches the requested order |
| Page overflow | None at 320, 360, 390, 768, 834, 1024, 1200, or 1440px in either theme |
| Categories | One horizontal circular row at every tested width |
| Just For You | 2 mobile, 3 tablet, 4 desktop columns |
| Flash Sale | 3 mobile/tablet, 6 desktop columns |
| Footer | Visible on every tested screen size; two-column mobile, four-column tablet and five-column desktop layouts |
| Bottom navigation | Hidden on desktop; more than 26px clearance below the footer content on mobile/tablet at maximum scroll |
| Dark mode | Desktop header and mobile/tablet menu controls share the same theme preference; it persists after reload, follows system changes before manual selection, and synchronizes across tabs |
| Theme resilience | Keyboard toggling and blocked-storage behaviour passed; no hydration or runtime errors |
| Interactions | CTA scroll, Coming soon feedback, dismissal, search input and feedback, Escape and search focus restoration passed |
| Automated accessibility | No axe WCAG 2 A/AA or 2.1 AA violations in either theme at 390, 834, or 1440px; mobile search dialog also checked in both themes |
| Visual review | Light and dark homepage/footer captures inspected, including mobile footer clearance |

Raw reports and screenshots are in the ignored local `output/qa/` folder. Full-page screenshots show the fixed bottom navigation at the original viewport edge; separate footer screenshots and clearance measurements verify that all footer content is reachable and visible above the navigation.

The 15 pre-existing local placeholder photos are unchanged in the footer/theme update. No new pictures were created; future work must use provided or existing images unless image generation is explicitly requested. Prices, bag count, static sale countdown and contacts are demo data.

The production dependency audit is clean. npm currently reports five advisory entries in the development-only Next ESLint dependency chain (`braces` / `micromatch` / `fast-glob`); npm's suggested fix would downgrade Next's lint configuration across major versions and was not applied. ESLint 9 is retained to satisfy the current Next lint plugins' peer ranges.
