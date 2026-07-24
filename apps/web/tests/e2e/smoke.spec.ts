import { test, expect } from "@playwright/test";

test("keşif → mekan detay → bilgi yanlış bildir", async ({ page }) => {
  await page.goto("/kadikoy");
  await expect(page.getByTestId("venue-list")).toBeVisible();

  await page.getByTestId("venue-card").first().click();
  await expect(page.getByTestId("venue-detail")).toBeVisible();

  await page.getByLabel(/neden/i).fill("Fiyat yanlış görünüyor");
  await page.getByRole("button", { name: /gönder/i }).click();
  await expect(page.getByText(/teşekkürler/i)).toBeVisible();
});

test("giriş yapmadan favori eklemeye çalışmak /giris'e yönlendirir", async ({ page }) => {
  await page.goto("/kadikoy");
  await page.getByTestId("venue-card").first().click();
  await page.getByRole("button", { name: /favorilere ekle/i }).click();
  await expect(page).toHaveURL(/\/giris/);
});
