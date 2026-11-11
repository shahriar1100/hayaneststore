import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const baseURL = process.env.PREVIEW_URL || "http://localhost:3000";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const output = new URL("../output/qa/", import.meta.url);
await mkdir(output, { recursive: true });
const reports = [];
const errors = [];

try {
  const scenarios = ["light", "dark"].flatMap((colorScheme) =>
    [320, 360, 390, 768, 834, 1024, 1200, 1440].map((width) => ({ colorScheme, width })),
  );
  for (const { colorScheme, width } of scenarios) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${width}px: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error") errors.push(`${width}px: ${message.text()}`); });
    await page.goto(baseURL, { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1, name: "Everyday Elegance" }).waitFor();
    await expect(page.locator("html")).toHaveAttribute("data-theme", colorScheme);
    await expect(page.locator(".header-theme-control .theme-toggle")).toHaveAttribute("aria-pressed", String(colorScheme === "dark"));

    // Walk the page so the real lazy-loaded photographs are included in screenshots.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });
    await page.waitForFunction(() => Array.from(document.images).every((image) => {
      const rect = image.getBoundingClientRect();
      return rect.width === 0 || rect.right <= 0 || rect.left >= innerWidth || (image.complete && image.naturalWidth > 0);
    }), undefined, { timeout: 30000 });

    const layout = await page.evaluate(() => {
      const columns = (selector) => getComputedStyle(document.querySelector(selector)).gridTemplateColumns.split(" ").length;
      const nav = document.querySelector(".mobile-bottom-nav");
      const cards = Array.from(document.querySelectorAll(".for-you-grid .product-card")).filter((card) => card.getBoundingClientRect().width > 0);
      const lastCard = cards.at(-1).getBoundingClientRect();
      const footer = document.querySelector(".site-footer");
      const footerContent = document.querySelector(".footer-grid").getBoundingClientRect();
      const categoryYs = Array.from(document.querySelectorAll(".category-item")).map((item) => Math.round(item.getBoundingClientRect().top));
      return {
        viewport: innerWidth,
        theme: document.documentElement.dataset.theme,
        documentWidth: document.documentElement.scrollWidth,
        recommendationColumns: columns(".for-you-grid"),
        saleColumns: columns(".sale-grid"),
        categoryRows: new Set(categoryYs).size,
        navVisible: getComputedStyle(nav).display !== "none",
        navClearance: nav.getBoundingClientRect().top - lastCard.bottom,
        footerVisible: getComputedStyle(footer).display !== "none" && footerContent.width > 0 && footerContent.height > 0,
        footerNavClearance: nav.getBoundingClientRect().top - footerContent.bottom,
        sections: Array.from(document.querySelectorAll("main > section")).map((section) => section.getAttribute("aria-label") || section.querySelector("h1, h2")?.textContent),
      };
    });
    assert.ok(layout.documentWidth <= width, `Page overflow at ${width}px: ${layout.documentWidth}px`);
    assert.equal(layout.recommendationColumns, width < 768 ? 2 : width < 1024 ? 3 : 4);
    assert.equal(layout.saleColumns, width < 768 ? 2 : width < 1024 ? 3 : 4);
    assert.equal(layout.categoryRows, 1, "Categories must remain one row");
    assert.equal(layout.navVisible, width < 1024);
    assert.equal(layout.footerVisible, true, `Footer missing at ${width}px`);
    if (width < 1024) assert.ok(layout.navClearance >= 12, `Bottom navigation overlaps at ${width}px`);
    if (width < 1024) assert.ok(layout.footerNavClearance >= 20, `Bottom navigation overlaps footer at ${width}px`);
    assert.deepEqual(layout.sections, ["EverydayElegance", "NOOR stories", "Categories", "Top Products", "New Items", "Flash Sale", "Most Popular", "Just For You"]);

    if ([390, 834, 1440].includes(width)) {
      await page.screenshot({ path: fileURLToPath(new URL(`footer-${colorScheme}-${width}.png`, output)) });
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    if ([390, 834, 1440].includes(width)) {
      await page.screenshot({ path: fileURLToPath(new URL(`homepage-${colorScheme}-${width}.png`, output)), fullPage: true });
      const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const violations = accessibility.violations.map((violation) => ({ id: violation.id, impact: violation.impact, description: violation.description, targets: violation.nodes.map((node) => node.target) }));
      reports.push({ ...layout, accessibilityViolations: violations });
      assert.deepEqual(violations, [], `Accessibility issues at ${width}px: ${JSON.stringify(violations)}`);
    } else reports.push(layout);

    await page.getByRole("link", { name: "Explore Collection", exact: true }).click();
    assert.equal(new URL(page.url()).hash, "#new-items");
    await page.getByRole("button", { name: "See all new items — Coming soon", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Coming soon" }).waitFor();
    await page.getByRole("button", { name: "Dismiss notification" }).click();

    if (width < 1200) {
      await page.getByRole("button", { name: "Open search", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("textbox", { name: "Search hijabs, colors or styles" }).fill("olive");
      if (width === 390) {
        const dialogAccessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        assert.deepEqual(dialogAccessibility.violations.map(({ id }) => id), [], `${colorScheme} search accessibility`);
      }
      await page.keyboard.press("Escape");
      assert.equal(await dialog.isVisible(), false);
      assert.equal(await page.getByRole("button", { name: "Open search", exact: true }).evaluate((button) => button === document.activeElement), true);
      await page.getByRole("button", { name: "Open search", exact: true }).click();
      await dialog.getByRole("textbox", { name: "Search hijabs, colors or styles" }).fill("olive");
      await dialog.getByRole("button", { name: "Submit search" }).click();
      await page.waitForURL("**/shop?q=olive");
    } else {
      await page.getByRole("textbox", { name: "Search hijabs", exact: true }).fill("olive");
      await page.getByRole("textbox", { name: "Search hijabs", exact: true }).press("Enter");
      await page.waitForURL("**/shop?q=olive");
    }

    console.log(`PASS ${colorScheme} ${width}px: footer visible, no overlap/overflow; images, grids and interactions OK`);
    await context.close();
  }

  // Verify system changes, saved choices, cross-tab updates and keyboard use.
  const themeContext = await browser.newContext({ colorScheme: "light", reducedMotion: "reduce" });
  const themePage = await themeContext.newPage();
  themePage.on("pageerror", (error) => errors.push(`Theme: ${error.message}`));
  await themePage.goto(baseURL, { waitUntil: "networkidle" });
  await expect(themePage.locator("html")).toHaveAttribute("data-theme", "light");
  await themePage.emulateMedia({ colorScheme: "dark" });
  await expect(themePage.locator("html")).toHaveAttribute("data-theme", "dark");
  await themePage.getByRole("button", { name: "Dark mode", exact: true }).focus();
  await themePage.keyboard.press("Space");
  await expect(themePage.locator("html")).toHaveAttribute("data-theme", "light");
  await themePage.reload({ waitUntil: "networkidle" });
  await expect(themePage.locator("html")).toHaveAttribute("data-theme", "light");
  assert.equal(await themePage.evaluate(() => localStorage.getItem("noor-theme")), "light");

  const otherTab = await themeContext.newPage();
  await otherTab.goto(baseURL, { waitUntil: "networkidle" });
  await otherTab.getByRole("button", { name: "Dark mode", exact: true }).click();
  await expect(themePage.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(themePage.getByRole("button", { name: "Dark mode", exact: true })).toHaveAttribute("aria-pressed", "true");
  assert.equal(await themePage.locator('meta[name="theme-color"]').getAttribute("content"), "#171513");
  await otherTab.evaluate(() => localStorage.removeItem("noor-theme"));
  await expect(themePage.locator("html")).toHaveAttribute("data-theme-preference", "system");
  await themePage.emulateMedia({ colorScheme: "light" });
  await expect(themePage.locator("html")).toHaveAttribute("data-theme", "light");
  await themeContext.close();

  const blockedContext = await browser.newContext({ colorScheme: "dark" });
  await blockedContext.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException("Storage blocked", "SecurityError"); };
    Storage.prototype.setItem = () => { throw new DOMException("Storage blocked", "SecurityError"); };
  });
  const blockedPage = await blockedContext.newPage();
  blockedPage.on("pageerror", (error) => errors.push(`Blocked storage: ${error.message}`));
  await blockedPage.goto(baseURL, { waitUntil: "networkidle" });
  await expect(blockedPage.locator("html")).toHaveAttribute("data-theme", "dark");
  await blockedPage.getByRole("button", { name: "Dark mode", exact: true }).click();
  await expect(blockedPage.locator("html")).toHaveAttribute("data-theme", "light");
  await blockedContext.close();
  console.log("PASS theme preference: system, persistence, cross-tab sync, keyboard and blocked storage");
  assert.deepEqual(errors, [], "Browser errors detected");
  console.log("All responsive, accessibility and interaction checks passed.");
} finally {
  await writeFile(new URL("report.json", output), JSON.stringify({ reports, errors }, null, 2));
  await browser.close();
}
