import { expect, test, type Page } from "@playwright/test";

async function createWallet(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Wallet" }).waitFor();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Create Wallet" }).click();
  await expect(page.getByText("Seed Phrase Warning")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Show Recovery Phrase" }).click();
  const words = await page.getByTestId("seed-word").allTextContents();
  await expect(words.length).toBe(12);
  await page.getByRole("button", { name: "I Wrote It Down" }).click();
  await page.getByPlaceholder("word one two...").fill(words.join(" "));
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('input[placeholder="Password"]').fill("Testpass123!");
  await page.locator('input[placeholder="Confirm password"]').fill("Testpass123!");
  await page.getByRole("button", { name: "Encrypt Wallet" }).click();
  await expect(page.getByTestId("home-screen")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("home screen loads without overflow and bottom nav stays fixed", async ({ page }) => {
  await createWallet(page);
  await expect(page.getByTestId("bottom-nav")).toBeVisible();
  await expect(page.getByTestId("asset-row").first()).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
  const navBox = await page.getByTestId("bottom-nav").boundingBox();
  expect(navBox?.y || 0).toBeGreaterThan(500);
});

test("network selector filters assets", async ({ page }) => {
  await createWallet(page);
  await page.getByTestId("network-selector").selectOption("polygon");
  await expect(page.getByText("MATIC").first()).toBeVisible();
  await expect(page.getByText("Polygon").first()).toBeVisible();
});

test("markets page shows market rows", async ({ page }) => {
  await createWallet(page);
  await page.getByRole("button", { name: "Markets" }).click();
  await expect(page.getByTestId("markets-screen")).toBeVisible();
  await expect(page.getByTestId("market-row").first()).toBeVisible();
});

test("trade page shows swap UI", async ({ page }) => {
  await createWallet(page);
  await page.getByRole("button", { name: "Trade" }).click();
  await expect(page.getByTestId("trade-screen")).toBeVisible();
  await expect(page.getByText("Live swap aggregator integration coming soon")).toBeVisible();
});

test("rewards page shows reward cards", async ({ page }) => {
  await createWallet(page);
  await page.getByRole("button", { name: "Rewards" }).click();
  await expect(page.getByTestId("rewards-screen")).toBeVisible();
  await expect(page.getByText("Referral rewards")).toBeVisible();
});

test("discover page shows DApp cards", async ({ page }) => {
  await createWallet(page);
  await page.getByRole("button", { name: "Discover" }).click();
  await expect(page.getByTestId("discover-screen")).toBeVisible();
  await expect(page.getByTestId("dapp-card").first()).toBeVisible();
});

test("manage token page opens", async ({ page }) => {
  await createWallet(page);
  await page.getByRole("button", { name: "Manage" }).click();
  await expect(page.getByTestId("manage-tokens-screen")).toBeVisible();
});

test("receive screen opens", async ({ page }) => {
  await createWallet(page);
  await page.getByTestId("action-receive").click();
  await expect(page.getByTestId("receive-screen")).toBeVisible();
});

test("recharge screen opens", async ({ page }) => {
  await createWallet(page);
  await page.getByTestId("action-recharge").click();
  await expect(page.getByTestId("recharge-screen")).toBeVisible();
});

test("QR Pay screen opens", async ({ page }) => {
  await createWallet(page);
  await page.getByTestId("action-qr-pay").click();
  await expect(page.getByTestId("qr-pay-screen")).toBeVisible();
});

test("settings screen opens", async ({ page }) => {
  await createWallet(page);
  await page.getByLabel("Open settings").click();
  await expect(page.getByTestId("settings-screen")).toBeVisible();
});
