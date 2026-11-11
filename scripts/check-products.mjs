import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const baseURL = process.env.PREVIEW_URL || "http://localhost:3000";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const output = new URL("../output/product-qa/", import.meta.url);
await mkdir(output, { recursive: true });
const errors = [];
const reports = [];
const observe = (page) => {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
};
async function a11y(page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  assert.deepEqual(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })), []);
}

try {
  for (const theme of ["light", "dark"]) {
    for (const width of [320, 360, 390, 768, 834, 1024, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: "reduce" });
      const page = await context.newPage();
      observe(page);
      const response = await page.goto(`${baseURL}/products/premium-modal-rose`, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200);
      await expect(page.getByRole("heading", { name: "Premium Modal Hijab", level: 1 })).toBeVisible();
      await expect(page.locator(".product-detail-price")).toHaveText("৳650");
      await expect(page.locator(".product-specifications")).toContainText("180 × 70 cm");
      await expect(page.locator(".product-specifications")).toContainText("Modal");
      await expect(page.getByRole("radio", { name: "Rose", exact: true })).toBeChecked();
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
      const layout = await page.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        width: innerWidth,
        pageWidth: document.documentElement.scrollWidth,
        columns: getComputedStyle(document.querySelector(".product-detail-layout")).gridTemplateColumns.split(" ").length,
        footerClearance: document.querySelector(".mobile-bottom-nav").getBoundingClientRect().top - document.querySelector(".footer-grid").getBoundingClientRect().bottom,
      }));
      assert.ok(layout.pageWidth <= width);
      assert.equal(layout.columns, width < 768 ? 1 : 2);
      if (width < 1024) {
        assert.ok(layout.footerClearance > 20);
        await expect(page.getByRole("navigation", { name: "Mobile navigation", exact: true }).getByRole("link", { name: "Shop", exact: true })).toHaveAttribute("aria-current", "page");
      }
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForFunction(() => Array.from(document.querySelectorAll(".product-gallery img")).every((image) => image.complete && image.naturalWidth > 0));
      await page.getByRole("button", { name: "Next image", exact: true }).click();
      await expect(page.locator(".product-thumbnail").nth(1)).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "Previous image", exact: true }).click();
      await expect(page.locator(".product-thumbnail").first()).toHaveAttribute("aria-pressed", "true");
      if ([390, 834, 1440].includes(width)) {
        await a11y(page);
        await page.screenshot({ path: fileURLToPath(new URL(`product-${theme}-${width}.png`, output)), fullPage: true });
      }
      await page.getByRole("button", { name: "Increase quantity", exact: true }).click();
      await expect(page.getByLabel("Selected quantity", { exact: true })).toHaveText("2");
      await page.getByRole("button", { name: "Add to Bag", exact: true }).click();
      await expect(page.locator("#cart-feature-note")).toHaveText("Added 2 to your shopping bag");
      if (width < 1024) {
        await expect(page.locator(".mobile-bottom-nav .bag-badge")).toHaveText("2");
      } else {
        await expect(page.locator(".site-header .bag-badge")).toHaveText("2");
      }
      reports.push(layout);
      console.log(`PASS ${theme} ${width}px: product layout, gallery, images, quantity, feedback and footer`);
      await context.close();
    }
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  observe(page);
  await page.goto(`${baseURL}/products/premium-modal-rose`, { waitUntil: "networkidle" });
  const quantity = page.getByLabel("Selected quantity", { exact: true });
  const increase = page.getByRole("button", { name: "Increase quantity", exact: true });
  const decrease = page.getByRole("button", { name: "Decrease quantity", exact: true });
  await expect(decrease).toBeDisabled();
  for (let index = 1; index < 8; index++) await increase.click();
  await expect(quantity).toHaveText("8");
  await expect(increase).toBeDisabled();
  await page.getByRole("radio", { name: "Sand", exact: true }).check();
  await expect(quantity).toHaveText("4");
  await expect(page.locator(".product-stock")).toHaveText("In stock · 4 available");
  await expect(increase).toBeDisabled();
  await expect(page.locator(".product-gallery-main img")).toHaveAttribute("alt", "Light sand hijab with a soft, flowing drape");
  await decrease.click();
  await expect(quantity).toHaveText("3");
  await page.locator(".product-thumbnail").nth(1).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".product-gallery-main img")).toHaveAttribute("alt", "Airy ivory chiffon fabric");
  await page.getByRole("radio", { name: "Black", exact: true }).check();
  await expect(page.getByRole("button", { name: "Next image", exact: true })).toHaveCount(0);
  await page.getByRole("radio", { name: "Burgundy", exact: true }).check();
  await expect(page.locator(".product-stock")).toHaveText("Out of stock in this colour");
  await expect(page.getByRole("button", { name: "Add to Bag", exact: true })).toBeDisabled();
  await expect(increase).toBeDisabled();
  await expect(decrease).toBeDisabled();
  await a11y(page);
  await page.getByRole("radio", { name: "Burgundy", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Rose", exact: true })).toBeChecked();
  await expect(quantity).toHaveText("1");
  await expect(page.getByRole("button", { name: "Add to Bag", exact: true })).toBeEnabled();

  // All catalog cards must resolve to real detail pages, including accessories.
  await page.goto(`${baseURL}/shop`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Load More", exact: true }).click();
  await page.getByRole("button", { name: "Load More", exact: true }).click();
  const products = await page.locator(".shop-product-grid .product-card").evaluateAll((cards) => cards.map((card) => ({
    href: card.querySelector("a").getAttribute("href"), name: card.querySelector(".product-name").textContent, price: card.querySelector(".current-price").textContent,
  })));
  assert.equal(products.length, 28);
  assert.equal(new Set(products.map(({ href }) => href)).size, 28);
  for (const product of products) {
    const response = await page.request.get(`${baseURL}${product.href}`);
    assert.equal(response.status(), 200, product.href);
    const html = await response.text();
    assert.ok(html.includes(product.name) && html.includes(product.price), `Mismatched product at ${product.href}`);
  }
  await page.goto(`${baseURL}/products/gold-hijab-pins`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Gold Hijab Pins", level: 1 })).toBeVisible();
  await expect(page.locator(".product-specifications")).toContainText("Set of 4 pins");
  await expect(page.getByRole("radio", { name: "Gold", exact: true })).toBeChecked();
  await expect(page.locator(".product-detail-price")).toHaveText("৳180");
  await page.goto(`${baseURL}/products/sale-black`, { waitUntil: "networkidle" });
  await expect(page.locator(".product-detail-price")).toHaveText("৳520");
  await expect(page.locator(".product-detail-prices del")).toContainText("৳650");
  await expect(page.locator(".product-saving")).toHaveText("Save 20%");

  for (const selector of [".new-items-grid", ".top-products-row", ".sale-grid", ".popular-grid", ".for-you-grid"]) {
    await page.goto(baseURL, { waitUntil: "networkidle" });
    const link = page.locator(`${selector} a`).first();
    const href = await link.getAttribute("href");
    assert.ok(products.some((product) => product.href === href));
    await link.click();
    await expect(page).toHaveURL(`${baseURL}${href}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.goto(baseURL, { waitUntil: "networkidle" });
  const homepageLinks = await page.locator("a.product-link, a.top-product").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  assert.ok(homepageLinks.every((href) => products.some((product) => product.href === href)));
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto(`${baseURL}/products/premium-modal-rose`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu", exact: true });
  await menu.getByRole("button", { name: "Dark mode", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open menu", exact: true })).toBeFocused();
  await page.getByRole("navigation", { name: "Mobile navigation", exact: true }).getByRole("link", { name: "Shop", exact: true }).click();
  await expect(page.locator(".shop-result-count")).toHaveText("28 products");
  await context.close();
  assert.deepEqual(errors, [], "Unexpected browser errors");

  // Expected 404s are isolated from the normal page error report.
  const fallbackContext = await browser.newContext();
  const fallbackPage = await fallbackContext.newPage();
  await fallbackPage.route("**/_next/image?**", (route) => route.fulfill({ status: 404, body: "Missing test image" }));
  await fallbackPage.goto(`${baseURL}/products/premium-modal-rose`, { waitUntil: "networkidle" });
  await expect(fallbackPage.locator(".product-gallery-main .product-photo-placeholder")).toBeVisible();
  await fallbackPage.getByRole("radio", { name: "Sand", exact: true }).check();
  await expect(fallbackPage.locator(".product-gallery-main .product-photo-placeholder")).toBeVisible();
  const missing = await fallbackPage.goto(`${baseURL}/products/not-a-real-product`, { waitUntil: "networkidle" });
  assert.equal(missing.status(), 404);
  await expect(fallbackPage.getByRole("heading", { name: "Product not found", level: 1 })).toBeVisible();
  await fallbackPage.getByRole("link", { name: "Back to Shop", exact: true }).click();
  await expect(fallbackPage).toHaveURL(`${baseURL}/shop`);
  await fallbackContext.close();
  console.log("PASS all 28 product routes, homepage links, colour/stock/quantity limits, keyboard, navigation, images and 404 handling");
} finally {
  await writeFile(new URL("report.json", output), JSON.stringify({ reports, errors }, null, 2));
  await browser.close();
}
