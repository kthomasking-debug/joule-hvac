import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('app should load without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out expected/benign errors
    const criticalErrors = errors.filter(
      (err) =>
        !err.includes('ERR_CONNECTION_REFUSED') &&
        !err.includes('Failed to load resource') &&
        !err.includes('favicon')
    );

    expect(criticalErrors.length).toBe(0);
  });

  test('should persist settings in localStorage', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Check that localStorage has userSettings
    const userSettings = await page.evaluate(() => {
      return localStorage.getItem('userSettings');
    });

    expect(userSettings).toBeTruthy();
  });

  test('should handle route changes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to different routes
    const routes = ['/cost-forecaster', '/settings', '/monthly-budget'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(route);
    }
  });
});



