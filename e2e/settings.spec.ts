import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should display settings page', async ({ page }) => {
    await expect(page).toHaveURL('/settings');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have settings form elements', async ({ page }) => {
    // Settings page should have various input fields
    // Check for common settings fields
    const inputs = page.locator('input[type="number"], input[type="text"]');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
  });
});



