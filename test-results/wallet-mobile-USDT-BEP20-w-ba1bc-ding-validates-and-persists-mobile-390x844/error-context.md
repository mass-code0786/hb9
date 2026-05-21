# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: wallet-mobile.spec.ts >> USDT BEP20 wallet binding validates and persists
- Location: tests\e2e\wallet-mobile.spec.ts:52:5

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
          - button "Connect external wallet" [ref=e25] [cursor=pointer]:
            - img [ref=e26]
            - generic [ref=e29]: Connect Wallet
        - generic [ref=e30]:
          - generic [ref=e33]:
            - heading "Decentralized Ecosystem" [level=1] [ref=e34]
            - paragraph [ref=e35]: A decentralized digital product ecosystem powered by blockchain-connected infrastructure.
            - generic [ref=e36]:
              - button "Connect external wallet" [ref=e40] [cursor=pointer]:
                - img [ref=e41]
                - generic [ref=e44]: Connect Wallet
              - button "Connect external wallet" [ref=e48] [cursor=pointer]:
                - img [ref=e49]
                - generic [ref=e52]: Sign Up
            - generic [ref=e54]:
              - paragraph [ref=e55]: HB9 gives users instant access to digital products, decentralized activation systems, and transparent business infrastructure through wallet-connected identity.
              - paragraph [ref=e56]: Every activation is connected to proof-based accounting, treasury visibility, and blockchain-linked distribution architecture.
              - paragraph [ref=e57]: Digital products are delivered within seconds after successful activation, creating a fast and seamless onboarding experience for users worldwide.
              - paragraph [ref=e58]: The ecosystem is designed for transparency, speed, decentralized access, and modern digital business operations.
          - region "HB9 package products" [ref=e59]:
            - generic [ref=e60]:
              - article [ref=e61]:
                - img "starter package product illustration" [ref=e64]:
                  - generic [ref=e85]: 150+
                - generic [ref=e86]:
                  - generic [ref=e87]:
                    - heading "$4 Package" [level=3] [ref=e88]
                    - img [ref=e90]
                  - list [ref=e95]:
                    - listitem [ref=e96]:
                      - img [ref=e98]
                      - generic [ref=e100]: 4 Business Idea Books
                    - listitem [ref=e101]:
                      - img [ref=e103]
                      - generic [ref=e105]: Digital Startup Guides
                    - listitem [ref=e106]:
                      - img [ref=e108]
                      - generic [ref=e110]: Instant Product Delivery
                  - button "Activate Package" [ref=e111] [cursor=pointer]
              - article [ref=e112]:
                - img "growth package product illustration" [ref=e115]:
                  - generic [ref=e137]: 700+
                - generic [ref=e138]:
                  - generic [ref=e139]:
                    - heading "$20 Package" [level=3] [ref=e140]
                    - img [ref=e142]
                  - list [ref=e146]:
                    - listitem [ref=e147]:
                      - img [ref=e149]
                      - generic [ref=e151]: 20 Business Idea Books
                    - listitem [ref=e152]:
                      - img [ref=e154]
                      - generic [ref=e156]: Money Management Books
                    - listitem [ref=e157]:
                      - img [ref=e159]
                      - generic [ref=e161]: Social Media Growth Kit
                    - listitem [ref=e162]:
                      - img [ref=e164]
                      - generic [ref=e166]: 700 Social Media Followers
                    - listitem [ref=e167]:
                      - img [ref=e169]
                      - generic [ref=e171]: Instant Delivery
                  - button "Activate Package" [ref=e172] [cursor=pointer]
              - article [ref=e173]:
                - img "creator package product illustration" [ref=e176]:
                  - generic [ref=e197]: 4000+
                - generic [ref=e198]:
                  - generic [ref=e199]:
                    - heading "$100 Package" [level=3] [ref=e200]
                    - img [ref=e202]
                  - list [ref=e205]:
                    - listitem [ref=e206]:
                      - img [ref=e208]
                      - generic [ref=e210]: 100 Story Templates
                    - listitem [ref=e211]:
                      - img [ref=e213]
                      - generic [ref=e215]: Business Idea Collection
                    - listitem [ref=e216]:
                      - img [ref=e218]
                      - generic [ref=e220]: Money Management Books
                    - listitem [ref=e221]:
                      - img [ref=e223]
                      - generic [ref=e225]: Branding Resources
                    - listitem [ref=e226]:
                      - img [ref=e228]
                      - generic [ref=e230]: 4000 Social Media Followers
                  - button "Activate Package" [ref=e231] [cursor=pointer]
              - article [ref=e232]:
                - img "whatsapp package product illustration" [ref=e235]
                - generic [ref=e257]:
                  - generic [ref=e258]:
                    - heading "$500 Package" [level=3] [ref=e259]
                    - img [ref=e261]
                  - list [ref=e263]:
                    - listitem [ref=e264]:
                      - img [ref=e266]
                      - generic [ref=e268]: All $100 Features
                    - listitem [ref=e269]:
                      - img [ref=e271]
                      - generic [ref=e273]: WhatsApp Automatic Message Software
                    - listitem [ref=e274]:
                      - img [ref=e276]
                      - generic [ref=e278]: CRM-style Messaging System
                    - listitem [ref=e279]:
                      - img [ref=e281]
                      - generic [ref=e283]: Automation Features
                  - button "Activate Package" [ref=e284] [cursor=pointer]
              - article [ref=e285]:
                - img "ai ads package product illustration" [ref=e288]
                - generic [ref=e307]:
                  - generic [ref=e308]:
                    - heading "$2500 Package" [level=3] [ref=e309]
                    - img [ref=e311]
                  - list [ref=e323]:
                    - listitem [ref=e324]:
                      - img [ref=e326]
                      - generic [ref=e328]: All $500 Features
                    - listitem [ref=e329]:
                      - img [ref=e331]
                      - generic [ref=e333]: AI Calling Agent Software
                    - listitem [ref=e334]:
                      - img [ref=e336]
                      - generic [ref=e338]: Meta Auto Ads Run AI Software
                    - listitem [ref=e339]:
                      - img [ref=e341]
                      - generic [ref=e343]: AI Automation Ecosystem
                  - button "Activate Package" [ref=e344] [cursor=pointer]
              - article [ref=e345]:
                - img "enterprise package product illustration" [ref=e348]
                - generic [ref=e367]:
                  - generic [ref=e368]:
                    - heading "$12500 Package" [level=3] [ref=e369]
                    - img [ref=e371]
                  - list [ref=e376]:
                    - listitem [ref=e377]:
                      - img [ref=e379]
                      - generic [ref=e381]: All $2500 Features
                    - listitem [ref=e382]:
                      - img [ref=e384]
                      - generic [ref=e386]: 3 Custom Software Projects
                    - listitem [ref=e387]:
                      - img [ref=e389]
                      - generic [ref=e391]: Centralized or Decentralized Solutions
                    - listitem [ref=e392]:
                      - img [ref=e394]
                      - generic [ref=e396]: Premium Business Infrastructure
                    - listitem [ref=e397]:
                      - img [ref=e399]
                      - generic [ref=e401]: Custom Development Support
                  - button "Activate Package" [ref=e402] [cursor=pointer]
      - generic [ref=e403]: HB9 API request failed.
  - button "Open Next.js Dev Tools" [ref=e409] [cursor=pointer]:
    - img [ref=e410]
  - alert [ref=e413]
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
  41  |   await expect(page.getByText("Recharge Wallet")).toBeVisible();
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
  93  |   await expect(page.getByText("Recharge").first()).toBeVisible();
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