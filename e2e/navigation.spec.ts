import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to home page', async ({ page }) => {
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Home')).toBeVisible();
  });

  test('should navigate to forecast page', async ({ page }) => {
    await page.click('text=Forecast');
    await expect(page).toHaveURL('/cost-forecaster');
  });

  test('should navigate to budget page', async ({ page }) => {
    await page.click('text=Budget');
    await expect(page).toHaveURL('/monthly-budget');
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.click('text=Settings');
    await expect(page).toHaveURL('/settings');
  });

  test('should navigate to agent console', async ({ page }) => {
    await page.click('text=Agent');
    await expect(page).toHaveURL('/agent-console');
  });

  test('should navigate to contactor demo', async ({ page }) => {
    await page.goto('/contactor-demo');
    await expect(page).toHaveURL('/contactor-demo');
    // Check for key elements
    await expect(page.locator('text=Thermostat')).toBeVisible();
  });
});



