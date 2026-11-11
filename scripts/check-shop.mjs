import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const baseURL = process.env.PREVIEW_URL || "http://localhost:3000";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const output = new URL("../output/shop-qa/", import.meta.url);
await mkdir(output, { recursive: true });
const errors = [];
const reports = [];

function observe(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
}
async function count(page, number) {
  await expect(page.locator(".shop-result-count")).toHaveText(new RegExp(`^${number} products?( found)?$`));
}
async function ids(page) {
  return page.locator(".shop-product-grid .product-card").evaluateAll((cards) => cards.map((card) => card.dataset.productId));
}
async function selectFilter(control) {
  await control.check();
  await expect(control).toBeChecked();
}
async function checkA11y(page, label) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const violations = result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
  assert.deepEqual(violations, [], `${label}: ${JSON.stringify(violations)}`);
}

try {
  for (const theme of ["light", "dark"]) {
    for (const width of [320, 360, 390, 768, 834, 1024, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: "reduce" });
      const page = await context.newPage();
      observe(page);
      await page.goto(`${baseURL}/shop`, { waitUntil: "networkidle" });
      await count(page, 28);
      await expect(page.getByRole("heading", { level: 1, name: "Shop the collection" })).toBeVisible();
      await expect(page.locator(".shop-product-grid .product-card")).toHaveCount(12);
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
      });
      await page.waitForFunction(() => Array.from(document.querySelectorAll(".shop-product-grid img")).every((image) => image.complete && image.naturalWidth > 0));
      const layout = await page.evaluate(() => ({
        width: innerWidth,
        pageWidth: document.documentElement.scrollWidth,
        columns: getComputedStyle(document.querySelector(".shop-product-grid")).gridTemplateColumns.split(" ").length,
        sidebar: getComputedStyle(document.querySelector(".shop-sidebar")).display !== "none",
        drawerTrigger: getComputedStyle(document.querySelector(".shop-filter-trigger")).display !== "none",
        footerClearance: document.querySelector(".mobile-bottom-nav").getBoundingClientRect().top - document.querySelector(".footer-grid").getBoundingClientRect().bottom,
      }));
      assert.ok(layout.pageWidth <= width, `Overflow at ${width}px`);
      assert.equal(layout.columns, width < 768 ? 2 : width < 1024 ? 3 : 4);
      assert.equal(layout.sidebar, width >= 1024);
      assert.equal(layout.drawerTrigger, width < 1024);
      if (width < 1024) assert.ok(layout.footerClearance > 20);
      reports.push({ theme, ...layout });
      await page.evaluate(() => scrollTo(0, 0));

      if ([390, 834, 1440].includes(width)) {
        await page.screenshot({ path: fileURLToPath(new URL(`shop-${theme}-${width}.png`, output)), fullPage: true });
        await checkA11y(page, `${theme} ${width}px`);
      }

      if (width < 1024) {
        const trigger = page.getByRole("button", { name: /^Filters/ });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "Find your favourites" });
        await expect(dialog).toBeVisible();
        const close = dialog.getByRole("button", { name: "Close filters" });
        await expect(close).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await expect(dialog.getByRole("button", { name: /Apply filters/ })).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(close).toBeFocused();
        await dialog.getByRole("checkbox", { name: "Modal", exact: true }).check();
        await expect(page.locator(".shop-result-count")).toHaveText("28 products");
        if (width === 390) {
          await checkA11y(page, `${theme} drawer`);
          await page.screenshot({ path: fileURLToPath(new URL(`drawer-${theme}.png`, output)) });
        }
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
        await expect(trigger).toBeFocused();
        await count(page, 28);
        await trigger.click();
        await expect(dialog.getByRole("checkbox", { name: "Modal", exact: true })).not.toBeChecked();
        await dialog.getByRole("checkbox", { name: "Modal", exact: true }).check();
        await dialog.getByRole("button", { name: /Apply filters/ }).click();
        await count(page, 10);
        await expect(trigger).toBeFocused();
        await page.reload({ waitUntil: "networkidle" });
        await count(page, 10);
        await page.getByRole("button", { name: /^Filters/ }).click();
        await dialog.getByRole("button", { name: "Clear", exact: true }).click();
        await dialog.getByRole("button", { name: /Apply filters/ }).click();
        await count(page, 28);
      }
      console.log(`PASS ${theme} ${width}px: ${layout.columns} columns, images, footer, overflow and drawer`);
      await context.close();
    }
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  observe(page);
  await page.goto(`${baseURL}/shop`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Load More", exact: true }).click();
  await expect(page.locator(".shop-product-grid .product-card")).toHaveCount(24);
  await page.getByRole("button", { name: "Load More", exact: true }).click();
  await expect(page.locator(".shop-product-grid .product-card")).toHaveCount(28);
  assert.equal(new Set(await ids(page)).size, 28, "Load More duplicated products");
  await expect(page.getByRole("button", { name: "Load More", exact: true })).toHaveCount(0);

  const sidebar = page.getByRole("complementary", { name: "Product filters" });
  await selectFilter(sidebar.getByRole("checkbox", { name: "Hijabs", exact: true }));
  await selectFilter(sidebar.getByRole("checkbox", { name: "Modal", exact: true }));
  await selectFilter(sidebar.getByRole("checkbox", { name: "Rose", exact: true }));
  await selectFilter(sidebar.getByRole("radio", { name: "৳500 – ৳699", exact: true }));
  await page.getByRole("searchbox", { name: "Search products" }).fill("premium");
  await count(page, 1);
  assert.deepEqual(await ids(page), ["premium-modal-rose"]);
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await selectFilter(sidebar.getByRole("checkbox", { name: "Chiffon", exact: true }));
  await count(page, 2);
  assert.deepEqual(await ids(page), ["premium-modal-rose", "for-you-rose"], "OR within fabrics and AND across filters");
  await page.reload({ waitUntil: "networkidle" });
  await count(page, 2);
  await page.getByRole("button", { name: "Remove colour: Rose", exact: true }).click();
  await expect(sidebar.getByRole("checkbox", { name: "Rose", exact: true })).not.toBeChecked();
  await page.goBack({ waitUntil: "networkidle" });
  await count(page, 2);
  await expect(sidebar.getByRole("checkbox", { name: "Rose", exact: true })).toBeChecked();
  await page.goForward({ waitUntil: "networkidle" });
  await expect(sidebar.getByRole("checkbox", { name: "Rose", exact: true })).not.toBeChecked();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await count(page, 28);
  await expect(page.locator(".shop-product-grid .product-card")).toHaveCount(12);

  for (const [sort, firstID] of [["price-asc", "gold-hijab-pins"], ["price-desc", "mocha-silk"], ["newest", "premium-modal-rose"], ["name-asc", "popular-black"]]) {
    await page.getByRole("combobox", { name: "Sort products" }).selectOption(sort);
    await expect(page.locator(".shop-product-grid .product-card").first()).toHaveAttribute("data-product-id", firstID);
    if (sort.startsWith("price")) {
      const prices = await page.locator(".shop-product-grid .current-price").allTextContents();
      const numbers = prices.map((price) => Number(price.replace(/[^0-9]/g, "")));
      assert.deepEqual(numbers, [...numbers].sort((a, b) => sort === "price-asc" ? a - b : b - a));
    }
  }
  await page.getByRole("searchbox", { name: "Search products" }).fill("NO-MATCH-123");
  await count(page, 0);
  await expect(page.getByRole("heading", { name: "No pieces found" })).toBeVisible();
  await checkA11y(page, "empty state");
  await page.getByRole("button", { name: "Clear Filters", exact: true }).click();
  await count(page, 28);
  await page.getByRole("searchbox", { name: "Search products" }).pressSequentially("olive", { delay: 1 });
  await count(page, 4);
  await expect(page.getByRole("searchbox", { name: "Search products" })).toHaveValue("olive");
  await page.getByRole("searchbox", { name: "Search products" }).press("Home");
  await page.getByRole("searchbox", { name: "Search products" }).pressSequentially("modal ", { delay: 1 });
  await expect(page.getByRole("searchbox", { name: "Search products" })).toHaveValue("modal olive");
  await count(page, 1);
  await page.locator(".shop-product-grid .product-link").first().click();
  await expect(page).toHaveURL(/\/products\/popular-olive$/);
  await expect(page.getByRole("heading", { name: "Olive Modal Hijab", level: 1 })).toBeVisible();

  await page.goto(`${baseURL}/shop?fabric=unknown&colour=invalid&price=bad&sort=bad`, { waitUntil: "networkidle" });
  await count(page, 28);
  for (const [name, parameter, value, expected] of [["Modal", "fabric", "modal", 10], ["Chiffon", "fabric", "chiffon", 6], ["Jersey", "fabric", "jersey", 4], ["Silk", "fabric", "silk", 5], ["Accessories", "category", "accessories", 3]]) {
    await page.goto(baseURL, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: `Shop ${name} collection`, exact: true }).click();
    await count(page, expected);
    assert.equal(new URL(page.url()).searchParams.get(parameter), value);
  }
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("link", { name: "Shop", exact: true }).click();
  await count(page, 28);
  await expect(page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("link", { name: "Shop", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("textbox", { name: "Search hijabs", exact: true }).fill("burgundy");
  await page.getByRole("textbox", { name: "Search hijabs", exact: true }).press("Enter");
  await count(page, 1);
  assert.deepEqual(await ids(page), ["burgundy-modal"]);
  await context.close();
  console.log("PASS combined filters, live search, sorting, pagination, URL history, all category links and product navigation");

  // A missing product image gets a simple styled placeholder, never a broken icon.
  const fallbackContext = await browser.newContext();
  const fallbackPage = await fallbackContext.newPage();
  await fallbackPage.route("**/_next/image?**", (route) => route.fulfill({ status: 404, body: "Missing test asset" }));
  await fallbackPage.goto(`${baseURL}/shop`, { waitUntil: "networkidle" });
  await expect(fallbackPage.locator(".product-photo-placeholder").first()).toBeVisible();
  await fallbackContext.close();
  assert.deepEqual(errors, [], "Unexpected browser errors");
  console.log("PASS fallback image. All shop checks passed.");
} finally {
  await writeFile(new URL("report.json", output), JSON.stringify({ reports, errors }, null, 2));
  await browser.close();
}
