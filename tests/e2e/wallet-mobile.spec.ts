import { expect, test, type Page } from "@playwright/test";

async function clickCreateWallet(page: Page) {
  const createButton = page.getByRole("button", { name: "Create Wallet" });
  const passwordInput = page.locator('input[placeholder="Password"]');

  await createButton.waitFor();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await createButton.click();
    try {
      await expect(passwordInput).toBeVisible({ timeout: 2_000 });
      return;
    } catch {
      await page.waitForTimeout(300);
    }
  }

  await expect(passwordInput).toBeVisible();
}

async function createWallet(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await clickCreateWallet(page);
  await page.locator('input[placeholder="Password"]').fill("Testpass123!");
  await page.locator('input[placeholder="Confirm password"]').fill("Testpass123!");
  await page.getByRole("button", { name: "Create Wallet" }).click();
  await expect(page.getByText("Wallet Created")).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByTestId("home-screen")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
});

test("home screen loads without overflow and bottom nav stays fixed", async ({ page }) => {
  await createWallet(page);
  await expect(page.getByTestId("bottom-nav")).toBeVisible();
  await expect(page.getByTestId("usdt-wallet-section")).toBeVisible();
  await expect(page.getByText("Recharge Wallet")).toHaveCount(0);
  await expect(page.getByTestId("asset-row")).toHaveCount(0);
  await expect(page.getByText("Import Token")).toHaveCount(0);
  await expect(page.getByText("Crypto")).toHaveCount(0);
  await expect(page.getByText("NFTs")).toHaveCount(0);
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
  const navBox = await page.getByTestId("bottom-nav").boundingBox();
  expect(navBox?.y || 0).toBeGreaterThan(500);
});

test("USDT BEP20 wallet binding validates and persists", async ({ page }) => {
  await createWallet(page);
  await page.getByRole("button", { name: "Bind Wallet Address" }).click();
  await page.locator('input[placeholder="0x..."]').fill("not-an-address");
  await page.getByRole("button", { name: "Save Address" }).click();
  await expect(page.getByText("Enter a valid USDT BEP20 wallet address.")).toBeVisible();
  await page.locator('input[placeholder="0x..."]').fill("0x1111111111111111111111111111111111111111");
  await page.getByRole("button", { name: "Save Address" }).click();
  await expect(page.getByText("0x1111111111111111111111111111111111111111")).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("hb9.usdtBep20Address"))).toBe("0x1111111111111111111111111111111111111111");
});

test("products page shows activation products", async ({ page }) => {
  await createWallet(page);
  await page.getByTestId("action-products").click();
  await expect(page.getByTestId("hb-products-screen")).toBeVisible();
  await expect(page.getByRole("button", { name: /Buy with USDT|Insufficient Balance/ }).first()).toBeVisible();
});

test("team page shows referral tools", async ({ page }) => {
  await createWallet(page);
  await page.getByTestId("action-team").click();
  await expect(page.getByTestId("hb-team-screen")).toBeVisible();
  await expect(page.getByText("Referral Link")).toBeVisible();
});

test("income page shows income sections", async ({ page }) => {
  await createWallet(page);
  await page.getByRole("button", { name: "Income" }).click();
  const incomeScreen = page.getByTestId("hb-income-screen");
  await expect(incomeScreen).toBeVisible();
  await expect(incomeScreen.getByText("Single Leg section")).toBeVisible();
  await expect(incomeScreen.getByRole("button", { name: /^Recharge/ })).toHaveCount(0);
  await expect(incomeScreen.getByRole("button", { name: /^Product/ })).toHaveCount(0);
});

test("wallet tab shows HB wallet ledger", async ({ page }) => {
  await createWallet(page);
  await page.getByTestId("bottom-nav").getByRole("button", { name: "Wallet" }).click();
  await expect(page.getByTestId("hb-wallet-screen")).toBeVisible();
  await expect(page.getByText("HB Wallet ID")).toBeVisible();
  await expect(page.getByText("Recharge").first()).toHaveCount(0);
});

test("deposit screen opens", async ({ page }) => {
  await createWallet(page);
  await page.getByTestId("action-deposit").click();
  await expect(page.getByTestId("deposit-screen")).toBeVisible();
  await expect(page.getByText("Payment Details")).not.toBeVisible();
});

test("withdrawal screen opens", async ({ page }) => {
  await createWallet(page);
  await page.getByTestId("action-withdrawal").click();
  await expect(page.getByTestId("withdrawal-screen")).toBeVisible();
  await expect(page.getByText("Available Balance", { exact: true })).toBeVisible();
});

test("settings screen opens", async ({ page }) => {
  await createWallet(page);
  await page.getByLabel("Open settings").click();
  await expect(page.getByTestId("settings-screen")).toBeVisible();
});
