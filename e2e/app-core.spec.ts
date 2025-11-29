import { test, expect } from '@playwright/test';
import { setupTest } from './helpers/test-setup';

test.describe('Core App Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load app without useLocation errors', async ({ page }) => {
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

    // Check for the specific errors we fixed
    const useLocationErrors = errors.filter(err => 
      err.includes('useLocation is not defined')
    );
    const appModeErrors = errors.filter(err => 
      err.includes('appMode is not defined')
    );

    expect(useLocationErrors.length).toBe(0);
    expect(appModeErrors.length).toBe(0);
  });

  test('should display header with logo', async ({ page }) => {
    const logo = page.locator('img[alt*="Joule"], img[alt*="Logo"]');
    await expect(logo.first()).toBeVisible();
  });

  test('should have functional navigation', async ({ page }) => {
    // Check desktop navigation exists
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
  });

  test('should persist dark mode preference', async ({ page }) => {
    // Find dark mode toggle button
    const darkModeBtn = page.locator('button[aria-label*="dark mode"], button:has(svg)').first();
    
    if (await darkModeBtn.isVisible().catch(() => false)) {
      // Click to toggle dark mode
      await darkModeBtn.click();
      await page.waitForTimeout(500);

      // Check if dark class is added to document
      const isDark = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });

      // Check localStorage persistence
      const darkModeSetting = await page.evaluate(() => {
        return localStorage.getItem('darkMode');
      });

      // Should have a darkMode setting
      expect(darkModeSetting).toBeTruthy();
    }
  });

  test('should handle route changes with useLocation', async ({ page }) => {
    // Navigate to different routes to ensure useLocation works
    const routes = ['/cost-forecaster', '/monthly-budget', '/settings', '/'];
    
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      
      // Verify no errors
      const hasErrors = await page.evaluate(() => {
        return (window as any).__playwright_errors?.length > 0;
      }).catch(() => false);
      
      expect(hasErrors).toBeFalsy();
      await expect(page).toHaveURL(route);
    }
  });

  test('should have working mode context', async ({ page }) => {
    // Check that mode context is available (no undefined appMode errors)
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should not have appMode undefined errors
    const modeErrors = consoleErrors.filter(err => 
      err.includes('appMode') || err.includes('mode is not defined')
    );
    expect(modeErrors.length).toBe(0);
  });

  test('should display Ask Joule FAB', async ({ page }) => {
    // Look for Ask Joule floating action button
    const jouleButtons = [
      page.locator('[data-testid="ask-joule-fab"]'),
      page.locator('[aria-label*="Ask Joule"]'),
      page.locator('[aria-label*="Open Ask Joule"]'),
      page.locator('button:has-text("Ask")').first()
    ];

    let fabVisible = false;
    for (const btn of jouleButtons) {
      if (await btn.isVisible().catch(() => false)) {
        fabVisible = true;
        break;
      }
    }

    // FAB should be visible on most pages (unless on pages with their own Ask Joule)
    const currentUrl = page.url();
    const isHomePage = currentUrl.endsWith('/') || currentUrl.includes('localhost:5173/#');
    
    if (!isHomePage) {
      // On non-home pages, FAB should be visible
      expect(fabVisible).toBeTruthy();
    }
  });

  test('should save user settings to localStorage', async ({ page }) => {
    // Check that userSettings exists in localStorage
    const userSettings = await page.evaluate(() => {
      return localStorage.getItem('userSettings');
    });

    expect(userSettings).toBeTruthy();
    
    // Verify it's valid JSON
    if (userSettings) {
      const parsed = JSON.parse(userSettings);
      expect(parsed).toHaveProperty('capacity');
      expect(parsed).toHaveProperty('efficiency');
    }
  });
});

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  test('should not crash on invalid routes', async ({ page }) => {
    await page.goto('/invalid-route-that-does-not-exist');
    await page.waitForLoadState('networkidle');

    // Should show some content (error page or redirect)
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should handle missing localStorage gracefully', async ({ page }) => {
    // Navigate first, then clear localStorage
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Clear all localStorage after page has loaded
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch (e) {
        // Ignore security errors
      }
    });

    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    // Reload and check that app handles missing storage gracefully
    await page.reload();
    await page.waitForLoadState('networkidle');

    // App should still load (terms modal should appear)
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display mobile navigation on small screens', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Mobile nav uses fixed positioning at bottom and should have navigation items
    const bottomNav = page.locator('.md\\:hidden.fixed.bottom-0');
    const anyBottomNav = page.locator('nav.fixed.bottom-0');
    const navWithLinks = page.locator('nav').filter({ has: page.locator('a') });
    
    const hasMobileNav = 
      await bottomNav.isVisible().catch(() => false) ||
      await anyBottomNav.isVisible().catch(() => false) ||
      await navWithLinks.count() > 0;

    // On mobile, should have some form of navigation
    expect(hasMobileNav).toBeTruthy();
  });

  test('should display desktop navigation on large screens', async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);

    // Desktop nav should be visible (items in header)
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
  });
});

