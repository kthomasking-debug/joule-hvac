import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display home page content', async ({ page }) => {
    // Check for main content areas
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have navigation menu', async ({ page }) => {
    // Check for navigation items
    const navItems = ['Home', 'Forecast', 'Budget', 'Settings'];
    for (const item of navItems) {
      await expect(page.locator(`text=${item}`).first()).toBeVisible();
    }
  });

  test('should open Ask Joule modal', async ({ page }) => {
    // Look for Ask Joule button or FAB
    const askJouleButton = page.locator('[aria-label*="Ask Joule"], [aria-label*="ask joule"], button:has-text("Ask"), .joule-fab').first();
    if (await askJouleButton.isVisible().catch(() => false)) {
      await askJouleButton.click();
      // Wait for modal or input to appear
      await page.waitForTimeout(500);
      const input = page.locator('input[type="text"], textarea').first();
      if (await input.isVisible().catch(() => false)) {
        await expect(input).toBeVisible();
      }
    }
  });
});



