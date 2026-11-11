import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const baseURL = process.env.PREVIEW_URL || "http://localhost:3000";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const output = new URL("../output/navigation-qa/", import.meta.url);
await mkdir(output, { recursive: true });
const reports = [];
const errors = [];
const observe = (page) => {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
};
const menu = (page) => page.getByRole("dialog", { name: "Menu", exact: true });
const openMenu = async (page) => {
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(menu(page)).toBeVisible();
};
async function accessibility(page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  assert.deepEqual(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })), []);
}

try {
  for (const theme of ["light", "dark"]) {
    for (const path of ["/", "/shop"]) {
      for (const width of [320, 390, 768, 834, 1024, 1440]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: "reduce" });
        const page = await context.newPage();
        observe(page);
        await page.goto(`${baseURL}${path}`, { waitUntil: "networkidle" });
        const header = page.getByRole("banner");
        const bottom = page.getByRole("navigation", { name: "Mobile navigation", exact: true });
        const trigger = page.getByRole("button", { name: "Open menu", exact: true });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (width >= 1024) {
          await expect(trigger).not.toBeVisible();
          await expect(bottom).not.toBeVisible();
          await expect(header.getByRole("button", { name: "Dark mode", exact: true })).toBeVisible();
          await expect(header.getByRole("button", { name: /^Shopping bag/ })).toBeVisible();
          await expect(header.getByRole("navigation", { name: "Main navigation", exact: true })).toBeVisible();
        } else {
          await expect(header.getByRole("link", { name: "NOOR home", exact: true })).toBeVisible();
          assert.deepEqual(await header.getByRole("button").allTextContents(), ["", ""]);
          await expect(header.getByRole("button", { name: "Open search", exact: true })).toBeVisible();
          await expect(trigger).toBeVisible();
          await expect(header.getByRole("button", { name: /^Shopping bag/ })).not.toBeVisible();
          assert.deepEqual(await bottom.locator(".bottom-nav-item > span:last-child").allTextContents(), ["Home", "Shop", "Saved", "Bag", "Account"]);
          await expect(bottom.locator('[aria-current="page"]')).toHaveText(path === "/" ? "Home" : "Shop");
          await expect(bottom.locator(".bag-badge")).toHaveCount(0);
          await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
          await expect.poll(() => page.evaluate(() => document.querySelector(".mobile-bottom-nav").getBoundingClientRect().top - document.querySelector(".footer-grid").getBoundingClientRect().bottom)).toBeGreaterThan(20);
          await page.evaluate(() => scrollTo(0, 0));

          await openMenu(page);
          const drawer = menu(page);
          const close = drawer.getByRole("button", { name: "Close menu", exact: true });
          await expect(close).toBeFocused();
          await expect(trigger).toHaveAttribute("aria-expanded", "true");
          await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe("hidden");
          await expect(drawer).toHaveCSS("animation-name", "none");
          await page.keyboard.press("Shift+Tab");
          await expect(drawer.getByRole("button", { name: "Dark mode", exact: true })).toBeFocused();
          await page.keyboard.press("Tab");
          await expect(close).toBeFocused();
          await drawer.getByRole("button", { name: "Categories", exact: true }).focus();
          await page.keyboard.press("Space");
          await expect(drawer.getByRole("button", { name: "Categories", exact: true })).toHaveAttribute("aria-expanded", "true");
          assert.deepEqual(await drawer.locator(".menu-category-links a").allTextContents(), ["Modal", "Chiffon", "Jersey", "Silk", "Accessories"]);
          await drawer.getByRole("button", { name: "My Orders — Coming soon", exact: true }).click();
          await expect(drawer.getByRole("status")).toContainText("My Orders — Coming soon");
          await expect(drawer.getByRole("button", { name: "My Orders — Coming soon", exact: true })).toBeFocused();
          assert.equal(new URL(page.url()).pathname, path);
          if ([390, 834].includes(width) && path === "/shop") {
            await accessibility(page);
            await page.screenshot({ path: fileURLToPath(new URL(`drawer-${theme}-${width}.png`, output)) });
          }
          const before = await page.evaluate(() => scrollY);
          await page.mouse.move(4, 400);
          await page.mouse.wheel(0, 700);
          await page.waitForTimeout(150);
          assert.equal(await page.evaluate(() => scrollY), before, "Background scrolled while menu was open");
          await page.keyboard.press("Escape");
          await expect(drawer).not.toBeVisible();
          await expect(trigger).toBeFocused();
          await expect(trigger).toHaveAttribute("aria-expanded", "false");
          await openMenu(page);
          await page.mouse.click(4, 400);
          await expect(drawer).not.toBeVisible();
          await expect(trigger).toBeFocused();
          await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe("hidden");
          await openMenu(page);
          await close.click();
          await expect(trigger).toBeFocused();
        }
        if ([390, 834, 1440].includes(width)) {
          await page.screenshot({ path: fileURLToPath(new URL(`${path === "/" ? "home" : "shop"}-${theme}-${width}.png`, output)) });
        }
        reports.push({ theme, path, width, passed: true });
        console.log(`PASS ${theme} ${path} ${width}px: navigation, active page, layout and drawer`);
        await context.close();
      }
    }
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 700 }, colorScheme: "light", reducedMotion: "reduce" });
  const page = await context.newPage();
  observe(page);
  await page.goto(baseURL, { waitUntil: "networkidle" });
  const bottom = page.getByRole("navigation", { name: "Mobile navigation", exact: true });
  await bottom.getByRole("link", { name: "Shop", exact: true }).click();
  await expect(page.locator(".shop-result-count")).toHaveText("28 products");
  await expect(bottom.getByRole("link", { name: "Shop", exact: true })).toHaveAttribute("aria-current", "page");
  await bottom.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Everyday Elegance", level: 1 })).toBeVisible();
  await openMenu(page);
  await menu(page).getByRole("link", { name: "Home", exact: true }).click();
  await expect(menu(page)).not.toBeVisible();
  await openMenu(page);
  await menu(page).getByRole("link", { name: "Shop All", exact: true }).click();
  await expect(page.locator(".shop-result-count")).toHaveText("28 products");
  await expect(menu(page)).not.toBeVisible();
  for (const [label, count] of [["Modal", 10], ["Chiffon", 6], ["Jersey", 4], ["Silk", 5], ["Accessories", 3]]) {
    await openMenu(page);
    await menu(page).getByRole("button", { name: "Categories", exact: true }).click();
    await menu(page).getByRole("link", { name: label, exact: true }).click();
    await expect(page.locator(".shop-result-count")).toHaveText(`${count} products found`);
    await expect(menu(page)).not.toBeVisible();
  }
  await openMenu(page);
  for (const label of ["My Orders", "About Us", "Contact Us", "Delivery & Returns", "Help / FAQ"]) {
    await menu(page).getByRole("button", { name: `${label} — Coming soon`, exact: true }).click();
    await expect(menu(page).getByRole("status")).toContainText(`${label} — Coming soon`);
    await expect(menu(page)).toBeVisible();
  }
  const themeButton = menu(page).getByRole("button", { name: "Dark mode", exact: true });
  await themeButton.focus();
  await page.keyboard.press("Space");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  assert.equal(await page.evaluate(() => localStorage.getItem("noor-theme")), "dark");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await openMenu(page);
  await expect(themeButton).toHaveAttribute("aria-pressed", "true");
  await themeButton.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(menu(page)).not.toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "NOOR home", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "Dark mode", exact: true })).toHaveAttribute("aria-pressed", "false");

  // A short landscape viewport must scroll the menu, with Close/theme reachable.
  await page.setViewportSize({ width: 834, height: 390 });
  await openMenu(page);
  await menu(page).getByRole("button", { name: "Categories", exact: true }).click();
  await menu(page).getByRole("button", { name: "Help / FAQ — Coming soon", exact: true }).click();
  await expect(menu(page).getByRole("status")).toContainText("Help / FAQ — Coming soon");
  assert.ok(await page.locator(".navigation-drawer-scroll").evaluate((element) => element.scrollHeight > element.clientHeight && element.scrollTop > 0));
  await expect(themeButton).toBeInViewport();
  await expect(menu(page).getByRole("button", { name: "Close menu", exact: true })).toBeInViewport();
  await page.screenshot({ path: fileURLToPath(new URL("drawer-landscape.png", output)) });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open search", exact: true }).click();
  await page.getByRole("textbox", { name: "Search hijabs, colors or styles", exact: true }).fill("burgundy");
  await page.getByRole("button", { name: "Submit search", exact: true }).click();
  await expect(page.locator(".shop-result-count")).toHaveText("1 product found");
  await context.close();
  assert.deepEqual(errors, [], "Unexpected browser errors");
  console.log("PASS navigation links, all categories, Coming soon, theme persistence, keyboard, resize, landscape and search");
} finally {
  await writeFile(new URL("report.json", output), JSON.stringify({ reports, errors }, null, 2));
  await browser.close();
}
