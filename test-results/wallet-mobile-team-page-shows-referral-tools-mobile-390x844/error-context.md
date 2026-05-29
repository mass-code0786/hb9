# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: wallet-mobile.spec.ts >> team page shows referral tools
- Location: tests\e2e\wallet-mobile.spec.ts:71:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.waitFor: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Create Wallet' }) to be visible

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - navigation [ref=e5]:
          - generic "HB9" [ref=e7]:
            - img [ref=e10]:
              - generic [ref=e17]: HB9
              - generic [ref=e18]: HB9
            - generic [ref=e21]: HB9
          - button "Choose wallet" [ref=e25] [cursor=pointer]:
            - img [ref=e26]
            - generic [ref=e29]: Connect Wallet
        - generic [ref=e30]:
          - generic [ref=e33]:
            - heading "Decentralized Ecosystem" [level=1] [ref=e34]
            - paragraph [ref=e35]: A decentralized digital product ecosystem powered by blockchain-connected infrastructure.
            - generic [ref=e36]:
              - button "Choose wallet" [ref=e40] [cursor=pointer]:
                - img [ref=e41]
                - generic [ref=e44]: Login
              - button "Choose wallet" [ref=e48] [cursor=pointer]:
                - img [ref=e49]
                - generic [ref=e52]: Sign Up
            - generic [ref=e54]:
              - paragraph [ref=e55]: HB9 gives users instant access to digital products, decentralized activation systems, and transparent business infrastructure through wallet-connected identity.
              - paragraph [ref=e56]: Every activation is connected to proof-based accounting, treasury visibility, and blockchain-linked distribution architecture.
              - paragraph [ref=e57]: Digital products are delivered within seconds after successful activation, creating a fast and seamless onboarding experience for users worldwide.
              - paragraph [ref=e58]: The ecosystem is designed for transparency, speed, decentralized access, and modern digital business operations.
          - region "HB9 package products" [ref=e59]:
            - generic [ref=e60]:
              - generic [ref=e61]:
                - paragraph [ref=e62]: HB9 Premium
                - heading "Available Packages" [level=2] [ref=e63]
              - generic [ref=e64]: All 6 packages
            - generic [ref=e65]:
              - generic [ref=e69]:
                - img [ref=e73]:
                  - generic [ref=e79]:
                    - generic [ref=e134]: EBOOK
                    - generic [ref=e144]:
                      - generic [ref=e146]: 4X
                      - generic [ref=e147]: DIGITAL BUNDLE
                - generic [ref=e148]:
                  - generic [ref=e149]:
                    - generic [ref=e150]:
                      - heading "$4.00 Starter" [level=3] [ref=e151]
                      - img [ref=e152]
                    - paragraph [ref=e155]: 4 Books
                  - button "Buy Now" [ref=e157] [cursor=pointer]
              - generic [ref=e161]:
                - img [ref=e165]:
                  - generic [ref=e171]:
                    - generic [ref=e236]: EBOOK
                    - generic [ref=e245]:
                      - generic [ref=e247]: 20X
                      - generic [ref=e248]: DIGITAL BUNDLE
                - generic [ref=e249]:
                  - generic [ref=e250]:
                    - generic [ref=e251]:
                      - heading "$20.00 Builder" [level=3] [ref=e252]
                      - img [ref=e253]
                    - paragraph [ref=e256]: 20 Books + 700 Followers
                  - button "Buy Now" [ref=e258] [cursor=pointer]
              - generic [ref=e262]:
                - img [ref=e266]:
                  - generic [ref=e272]:
                    - generic [ref=e357]: EBOOK
                    - generic [ref=e366]:
                      - generic [ref=e368]: "100"
                      - generic [ref=e369]: DIGITAL BUNDLE
                - generic [ref=e370]:
                  - generic [ref=e371]:
                    - generic [ref=e372]:
                      - heading "$100.00 Growth" [level=3] [ref=e373]
                      - img [ref=e374]
                    - paragraph [ref=e377]: 100 Books + 4000 Followers
                  - button "Buy Now" [ref=e379] [cursor=pointer]
              - generic [ref=e383]:
                - img [ref=e387]:
                  - generic [ref=e393]:
                    - generic [ref=e438]: CHAT
                    - generic [ref=e448]:
                      - generic [ref=e450]: WA
                      - generic [ref=e451]: SOFTWARE KIT
                - generic [ref=e452]:
                  - generic [ref=e453]:
                    - generic [ref=e454]:
                      - heading "$500.00 Automation" [level=3] [ref=e455]
                      - img [ref=e456]
                    - paragraph [ref=e459]: WhatsApp Automation Software
                  - button "Buy Now" [ref=e461] [cursor=pointer]
              - generic [ref=e465]:
                - img [ref=e469]:
                  - generic [ref=e475]:
                    - generic [ref=e520]: AI
                    - generic [ref=e530]:
                      - generic [ref=e532]: AI
                      - generic [ref=e533]: SOFTWARE KIT
                - generic [ref=e534]:
                  - generic [ref=e535]:
                    - generic [ref=e536]:
                      - heading "$2,500.00 AI Business" [level=3] [ref=e537]
                      - img [ref=e538]
                    - paragraph [ref=e541]: AI Calling + Meta Ads AI
                  - button "Buy Now" [ref=e543] [cursor=pointer]
              - generic [ref=e547]:
                - img [ref=e551]:
                  - generic [ref=e557]:
                    - generic [ref=e612]: VAULT
                    - generic [ref=e622]:
                      - generic [ref=e624]: ENT
                      - generic [ref=e625]: SOFTWARE KIT
                - generic [ref=e626]:
                  - generic [ref=e627]:
                    - generic [ref=e628]:
                      - heading "$12,500.00 Enterprise" [level=3] [ref=e629]
                      - img [ref=e630]
                    - paragraph [ref=e633]: 3 Custom Software
                  - button "Buy Now" [ref=e635] [cursor=pointer]
      - generic [ref=e637]: Failed to fetch
    - generic:
      - button "Replay HB9 voice assistant message" [ref=e638] [cursor=pointer]:
        - img [ref=e639]
      - button "Play HB9 voice assistant message" [ref=e642] [cursor=pointer]:
        - img [ref=e643]
  - button "Open Next.js Dev Tools" [ref=e652] [cursor=pointer]:
    - img [ref=e653]
  - alert [ref=e656]
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | 
  3   | async function clickCreateWallet(page: Page) {
  4   |   const createButton = page.getByRole("button", { name: "Create Wallet" });
  5   |   const passwordInput = page.locator('input[placeholder="Password"]');
  6   | 
> 7   |   await createButton.waitFor();
      |                      ^ Error: locator.waitFor: Test timeout of 60000ms exceeded.
  8   |   for (let attempt = 0; attempt < 5; attempt += 1) {
  9   |     await createButton.click();
  10  |     try {
  11  |       await expect(passwordInput).toBeVisible({ timeout: 2_000 });
  12  |       return;
  13  |     } catch {
  14  |       await page.waitForTimeout(300);
  15  |     }
  16  |   }
  17  | 
  18  |   await expect(passwordInput).toBeVisible();
  19  | }
  20  | 
  21  | async function createWallet(page: Page) {
  22  |   await page.goto("/", { waitUntil: "domcontentloaded" });
  23  |   await clickCreateWallet(page);
  24  |   await page.locator('input[placeholder="Password"]').fill("Testpass123!");
  25  |   await page.locator('input[placeholder="Confirm password"]').fill("Testpass123!");
  26  |   await page.getByRole("button", { name: "Create Wallet" }).click();
  27  |   await expect(page.getByText("Wallet Created")).toBeVisible();
  28  |   await page.getByRole("button", { name: "Skip for now" }).click();
  29  |   await expect(page.getByTestId("home-screen")).toBeVisible();
  30  | }
  31  | 
  32  | test.beforeEach(async ({ page }) => {
  33  |   await page.goto("/", { waitUntil: "domcontentloaded" });
  34  |   await page.evaluate(() => localStorage.clear());
  35  | });
  36  | 
  37  | test("home screen loads without overflow and bottom nav stays fixed", async ({ page }) => {
  38  |   await createWallet(page);
  39  |   await expect(page.getByTestId("bottom-nav")).toBeVisible();
  40  |   await expect(page.getByTestId("usdt-wallet-section")).toBeVisible();
  41  |   await expect(page.getByText("Recharge Wallet")).toHaveCount(0);
  42  |   await expect(page.getByTestId("asset-row")).toHaveCount(0);
  43  |   await expect(page.getByText("Import Token")).toHaveCount(0);
  44  |   await expect(page.getByText("Crypto")).toHaveCount(0);
  45  |   await expect(page.getByText("NFTs")).toHaveCount(0);
  46  |   const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  47  |   expect(hasHorizontalOverflow).toBe(false);
  48  |   const navBox = await page.getByTestId("bottom-nav").boundingBox();
  49  |   expect(navBox?.y || 0).toBeGreaterThan(500);
  50  | });
  51  | 
  52  | test("USDT BEP20 wallet binding validates and persists", async ({ page }) => {
  53  |   await createWallet(page);
  54  |   await page.getByRole("button", { name: "Bind Wallet Address" }).click();
  55  |   await page.locator('input[placeholder="0x..."]').fill("not-an-address");
  56  |   await page.getByRole("button", { name: "Save Address" }).click();
  57  |   await expect(page.getByText("Enter a valid USDT BEP20 wallet address.")).toBeVisible();
  58  |   await page.locator('input[placeholder="0x..."]').fill("0x1111111111111111111111111111111111111111");
  59  |   await page.getByRole("button", { name: "Save Address" }).click();
  60  |   await expect(page.getByText("0x1111111111111111111111111111111111111111")).toBeVisible();
  61  |   await expect.poll(() => page.evaluate(() => localStorage.getItem("hb9.usdtBep20Address"))).toBe("0x1111111111111111111111111111111111111111");
  62  | });
  63  | 
  64  | test("products page shows activation products", async ({ page }) => {
  65  |   await createWallet(page);
  66  |   await page.getByTestId("action-products").click();
  67  |   await expect(page.getByTestId("hb-products-screen")).toBeVisible();
  68  |   await expect(page.getByRole("button", { name: /Buy with USDT|Insufficient Balance/ }).first()).toBeVisible();
  69  | });
  70  | 
  71  | test("team page shows referral tools", async ({ page }) => {
  72  |   await createWallet(page);
  73  |   await page.getByTestId("action-team").click();
  74  |   await expect(page.getByTestId("hb-team-screen")).toBeVisible();
  75  |   await expect(page.getByText("Referral Link")).toBeVisible();
  76  | });
  77  | 
  78  | test("income page shows income sections", async ({ page }) => {
  79  |   await createWallet(page);
  80  |   await page.getByRole("button", { name: "Income" }).click();
  81  |   const incomeScreen = page.getByTestId("hb-income-screen");
  82  |   await expect(incomeScreen).toBeVisible();
  83  |   await expect(incomeScreen.getByText("Single Leg section")).toBeVisible();
  84  |   await expect(incomeScreen.getByRole("button", { name: /^Recharge/ })).toHaveCount(0);
  85  |   await expect(incomeScreen.getByRole("button", { name: /^Product/ })).toHaveCount(0);
  86  | });
  87  | 
  88  | test("wallet tab shows HB wallet ledger", async ({ page }) => {
  89  |   await createWallet(page);
  90  |   await page.getByTestId("bottom-nav").getByRole("button", { name: "Wallet" }).click();
  91  |   await expect(page.getByTestId("hb-wallet-screen")).toBeVisible();
  92  |   await expect(page.getByText("HB Wallet ID")).toBeVisible();
  93  |   await expect(page.getByText("Recharge").first()).toHaveCount(0);
  94  | });
  95  | 
  96  | test("deposit screen opens", async ({ page }) => {
  97  |   await createWallet(page);
  98  |   await page.getByTestId("action-deposit").click();
  99  |   await expect(page.getByTestId("deposit-screen")).toBeVisible();
  100 |   await expect(page.getByText("Payment Details")).not.toBeVisible();
  101 | });
  102 | 
  103 | test("withdrawal screen opens", async ({ page }) => {
  104 |   await createWallet(page);
  105 |   await page.getByTestId("action-withdrawal").click();
  106 |   await expect(page.getByTestId("withdrawal-screen")).toBeVisible();
  107 |   await expect(page.getByText("Available Balance", { exact: true })).toBeVisible();
```