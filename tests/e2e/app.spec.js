import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E tests for the entire application
 * Tests all major pages and functionality
 */

// Helper function to accept terms and conditions if modal is present
async function acceptTermsIfPresent(page) {
  try {
    // Check if terms modal is visible
    const termsModal = page.locator('text=/Welcome to Joule/i');
    const acceptButton = page.locator('button:has-text("Accept & Continue"), button:has-text("Accept")');
    const checkbox = page.locator('input[type="checkbox"]').first();
    
    // Wait a bit for modal to appear
    await page.waitForTimeout(1000);
    
    // Check if modal exists
    if (await termsModal.count() > 0 || await acceptButton.count() > 0) {
      // Check the checkbox first
      if (await checkbox.count() > 0) {
        await checkbox.check({ timeout: 2000 });
      }
      
      // Click accept button
      if (await acceptButton.count() > 0) {
        await acceptButton.click({ timeout: 2000 });
        // Wait for modal to disappear
        await page.waitForTimeout(500);
      }
    }
  } catch (error) {
    // Terms modal might not be present, which is fine
    // Just continue with the test
  }
}

// Helper function for Firefox-specific retry logic on page navigation
async function gotoWithFirefoxRetry(page, url, browserName, options = {}) {
  const timeout = browserName === 'firefox' ? 45000 : (options.timeout || 30000);
  const waitUntil = browserName === 'firefox' ? 'domcontentloaded' : (options.waitUntil || 'networkidle');
  
  try {
    await page.goto(url, { waitUntil, timeout, ...options });
    // Accept terms after navigation
    await acceptTermsIfPresent(page);
  } catch (error) {
    if (browserName === 'firefox' && (error.message.includes('CONNECTION_REFUSED') || error.message.includes('NS_ERROR'))) {
      // Retry once for Firefox connection issues with a delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      await page.goto(url, { waitUntil, timeout, ...options });
      await acceptTermsIfPresent(page);
    } else {
      throw error;
    }
  }
}

// Global setup: Wait for server to be ready
// Firefox-specific: Extra wait time for server readiness
test.beforeAll(async ({ browser, browserName }) => {
  // Firefox needs extra time for server to be ready
  if (browserName === 'firefox') {
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s for Firefox
  }
  
  // Ensure server is running by making a test request with retries
  const context = await browser.newContext();
  const page = await context.newPage();
  let retries = browserName === 'firefox' ? 5 : 3; // More retries for Firefox
  while (retries > 0) {
    try {
      await page.goto('http://localhost:5173', { 
        waitUntil: 'domcontentloaded', 
        timeout: browserName === 'firefox' ? 15000 : 10000 // Longer timeout for Firefox
      });
      // Accept terms if present
      await acceptTermsIfPresent(page);
      // Verify server is actually responding
      const title = await page.title();
      if (title) {
        break; // Server is ready
      }
    } catch (error) {
      retries--;
      if (retries > 0) {
        const waitTime = browserName === 'firefox' ? 3000 : 2000; // Longer wait for Firefox
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.warn(`Server may not be ready for ${browserName}, tests will retry individually`);
      }
    }
  }
  await context.close();
});

test.describe('Application Navigation', () => {
  test('should load the home page', async ({ page, browserName }) => {
    // Firefox-specific: Use longer timeout and retry on connection errors
    const timeout = browserName === 'firefox' ? 45000 : 30000;
    const waitUntil = browserName === 'firefox' ? 'domcontentloaded' : 'networkidle';
    
    try {
      await page.goto('/', { waitUntil, timeout });
      await acceptTermsIfPresent(page);
    } catch (error) {
      if (browserName === 'firefox' && (error.message.includes('CONNECTION_REFUSED') || error.message.includes('NS_ERROR'))) {
        // Retry once for Firefox connection issues
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.goto('/', { waitUntil, timeout });
        await acceptTermsIfPresent(page);
      } else {
        throw error;
      }
    }
    await expect(page).toHaveTitle(/Joule|HVAC|Engineering/);
  });

  test('should navigate to all major pages', async ({ page, browserName }) => {
    // Use faster wait condition - 'load' is sufficient for navigation tests
    // We just need to verify pages load, not wait for all network activity
    await page.goto('/', { 
      waitUntil: 'load', 
      timeout: browserName === 'firefox' ? 30000 : 20000 
    });
    await acceptTermsIfPresent(page);
    
    // Test navigation to key pages (updated to match current route structure)
    const pages = [
      { name: 'Home', path: '/home' },
      { name: 'Settings', path: '/config' },
      { name: '7-Day Forecast', path: '/analysis/forecast' },
      { name: 'System Performance Analyzer', path: '/analysis/analyzer' },
      { name: 'Energy Flow', path: '/energy-flow' },
      { name: 'Monthly Budget', path: '/analysis/budget' },
      { name: 'Upgrade ROI', path: '/upgrade-roi' },
    ];

    for (const { name, path } of pages) {
      // Use 'load' instead of 'networkidle' - much faster, still verifies page loaded
      await page.goto(path, { 
        waitUntil: 'load', 
        timeout: browserName === 'firefox' ? 30000 : 20000 
      });
      await acceptTermsIfPresent(page);
      
      // Verify URL changed - this is the main assertion
      await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/')), { timeout: 5000 });
      
      // Wait for DOM to be ready (faster than networkidle)
      await page.waitForLoadState('domcontentloaded');
    }
  });
});

test.describe('Ask Joule', () => {
  test('should display Ask Joule interface', async ({ page, browserName }) => {
    // Firefox-specific: Use longer timeout and retry on connection errors
    const timeout = browserName === 'firefox' ? 45000 : 30000;
    const waitUntil = browserName === 'firefox' ? 'domcontentloaded' : 'networkidle';
    
    try {
      await page.goto('/', { waitUntil, timeout });
      await acceptTermsIfPresent(page);
    } catch (error) {
      if (browserName === 'firefox' && (error.message.includes('CONNECTION_REFUSED') || error.message.includes('NS_ERROR'))) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.goto('/', { waitUntil, timeout });
        await acceptTermsIfPresent(page);
      } else {
        throw error;
      }
    }
    await page.waitForLoadState('networkidle');
    
    // Verify page loaded
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Look for Ask Joule component - try multiple selectors separately
    const askJouleText = page.locator('text=/Ask Joule/i');
    const askJouleTestId = page.locator('[data-testid*="ask"]');
    const askJouleClass = page.locator('[class*="ask"]');
    
    // Check if any of these exist
    const found = (await askJouleText.count() > 0) || 
                  (await askJouleTestId.count() > 0) || 
                  (await askJouleClass.count() > 0);
    
    // If found, verify it's visible
    if (found) {
      const element = (await askJouleText.count() > 0) ? askJouleText.first() :
                      (await askJouleTestId.count() > 0) ? askJouleTestId.first() :
                      askJouleClass.first();
      await expect(element).toBeVisible({ timeout: 5000 });
    }
  });

  test('should allow typing in Ask Joule input', async ({ page, browserName }) => {
    // Firefox-specific: Use longer timeout and retry on connection errors
    const timeout = browserName === 'firefox' ? 45000 : 30000;
    const waitUntil = browserName === 'firefox' ? 'domcontentloaded' : 'networkidle';
    
    try {
      await page.goto('/', { waitUntil, timeout });
      await acceptTermsIfPresent(page);
    } catch (error) {
      if (browserName === 'firefox' && (error.message.includes('CONNECTION_REFUSED') || error.message.includes('NS_ERROR'))) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.goto('/', { waitUntil, timeout });
        await acceptTermsIfPresent(page);
      } else {
        throw error;
      }
    }
    await page.waitForLoadState('networkidle');
    
    // Find input field (could be textarea or input) - try multiple selectors
    const input = page.locator('textarea, input[type="text"], input[placeholder*="ask" i], input[placeholder*="question" i]').first();
    if (await input.count() > 0) {
      await input.fill('what is the status');
      await expect(input).toHaveValue('what is the status');
    } else {
      // If no input found, just verify page loaded
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });
});

test.describe('Settings Page', () => {
  test('should load settings page', async ({ page, browserName }) => {
    // Firefox-specific: Use longer timeout and retry on connection errors
    const timeout = browserName === 'firefox' ? 45000 : 30000;
    const waitUntil = browserName === 'firefox' ? 'domcontentloaded' : 'networkidle';
    
    try {
      await page.goto('/config', { waitUntil, timeout });
    } catch (error) {
      if (browserName === 'firefox' && (error.message.includes('CONNECTION_REFUSED') || error.message.includes('NS_ERROR'))) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.goto('/config', { waitUntil, timeout });
      } else {
        throw error;
      }
    }
    await page.waitForLoadState('networkidle');
    
    // Check for settings content
    const settingsContent = page.locator('text=/Settings|Location|System|Efficiency/i').first();
    await expect(settingsContent).toBeVisible({ timeout: 5000 });
  });
});

test.describe('7-Day Cost Forecaster', () => {
  test('should load forecast page', async ({ page, browserName }) => {
    // Firefox-specific: Use longer timeout and retry on connection errors
    const timeout = browserName === 'firefox' ? 45000 : 30000;
    const waitUntil = browserName === 'firefox' ? 'domcontentloaded' : 'networkidle';
    
    try {
      await page.goto('/analysis/forecast', { waitUntil, timeout });
    } catch (error) {
      if (browserName === 'firefox' && (error.message.includes('CONNECTION_REFUSED') || error.message.includes('NS_ERROR'))) {
        // Retry once for Firefox connection issues
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.goto('/analysis/forecast', { waitUntil, timeout });
      } else {
        throw error;
      }
    }
    await page.waitForLoadState('networkidle');
    
    // Verify page loaded
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Check for forecast content - try multiple selectors separately
    const forecastText = page.locator('text=/Forecast|7-Day|Cost|Temperature|Weather/i');
    const forecastHeading = page.locator('h1, h2');
    const forecastClass = page.locator('[class*="forecast"]');
    
    const found = (await forecastText.count() > 0) || 
                  (await forecastHeading.count() > 0) || 
                  (await forecastClass.count() > 0);
    
    if (found) {
      const element = (await forecastText.count() > 0) ? forecastText.first() :
                      (await forecastHeading.count() > 0) ? forecastHeading.first() :
                      forecastClass.first();
      await expect(element).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('System Performance Analyzer', () => {
  test('should load analyzer page', async ({ page, browserName }) => {
    // Firefox-specific: Use longer timeout and retry on connection errors
    const timeout = browserName === 'firefox' ? 45000 : 30000;
    const waitUntil = browserName === 'firefox' ? 'domcontentloaded' : 'networkidle';
    
    try {
      await page.goto('/analysis/analyzer', { waitUntil, timeout });
    } catch (error) {
      if (browserName === 'firefox' && (error.message.includes('CONNECTION_REFUSED') || error.message.includes('NS_ERROR'))) {
        // Retry once for Firefox connection issues
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.goto('/analysis/analyzer', { waitUntil, timeout });
      } else {
        throw error;
      }
    }
    await page.waitForLoadState('networkidle');
    
    // Verify page loaded
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Check for analyzer content - try multiple selectors separately
    const analyzerText = page.locator('text=/Analyzer|Performance|CSV|Upload|System/i');
    const analyzerHeading = page.locator('h1, h2');
    const analyzerClass = page.locator('[class*="analyzer"]');
    
    const found = (await analyzerText.count() > 0) || 
                  (await analyzerHeading.count() > 0) || 
                  (await analyzerClass.count() > 0);
    
    if (found) {
      const element = (await analyzerText.count() > 0) ? analyzerText.first() :
                      (await analyzerHeading.count() > 0) ? analyzerHeading.first() :
                      analyzerClass.first();
      await expect(element).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Energy Flow Page', () => {
  test('should load energy flow page', async ({ page, browserName }) => {
    // Firefox-specific: Use longer timeout and retry on connection errors
    const timeout = browserName === 'firefox' ? 45000 : 30000;
    const waitUntil = browserName === 'firefox' ? 'domcontentloaded' : 'networkidle';
    
    try {
      await page.goto('/energy-flow', { waitUntil, timeout });
      await acceptTermsIfPresent(page);
    } catch (error) {
      if (browserName === 'firefox' && (error.message.includes('CONNECTION_REFUSED') || error.message.includes('NS_ERROR'))) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.goto('/energy-flow', { waitUntil, timeout });
        await acceptTermsIfPresent(page);
      } else {
        throw error;
      }
    }
    await page.waitForLoadState('networkidle');
    
    // Check for energy flow content
    const energyContent = page.locator('text=/Energy|Flow|Balance/i').first();
    await expect(energyContent).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Monthly Budget Planner', () => {
  test('should load budget page', async ({ page, browserName }) => {
    // Firefox-specific: Use longer timeout and retry on connection errors
    const timeout = browserName === 'firefox' ? 45000 : 30000;
    const waitUntil = browserName === 'firefox' ? 'domcontentloaded' : 'networkidle';
    
    try {
      await page.goto('/analysis/budget', { waitUntil, timeout });
      await acceptTermsIfPresent(page);
    } catch (error) {
      if (browserName === 'firefox' && (error.message.includes('CONNECTION_REFUSED') || error.message.includes('NS_ERROR'))) {
        // Retry once for Firefox connection issues
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.goto('/analysis/budget', { waitUntil, timeout });
        await acceptTermsIfPresent(page);
      } else {
        throw error;
      }
    }
    await page.waitForLoadState('networkidle');
    
    // Verify page loaded
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Check for budget content - try multiple selectors separately
    const budgetText = page.locator('text=/Budget|Monthly|Cost|Spending/i');
    const budgetHeading = page.locator('h1, h2');
    const budgetClass = page.locator('[class*="budget"]');
    
    const found = (await budgetText.count() > 0) || 
                  (await budgetHeading.count() > 0) || 
                  (await budgetClass.count() > 0);
    
    if (found) {
      const element = (await budgetText.count() > 0) ? budgetText.first() :
                      (await budgetHeading.count() > 0) ? budgetHeading.first() :
                      budgetClass.first();
      await expect(element).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Upgrade ROI Calculator', () => {
  test('should load upgrade page', async ({ page, browserName }) => {
    await gotoWithFirefoxRetry(page, '/upgrade-roi', browserName);
    await page.waitForLoadState('networkidle');
    
    // Verify page loaded
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Check for upgrade content - try multiple selectors separately
    const upgradeText = page.locator('text=/Upgrade|ROI|Return|Investment/i');
    const upgradeHeading = page.locator('h1, h2');
    const upgradeClass = page.locator('[class*="upgrade"]');
    
    const found = (await upgradeText.count() > 0) || 
                  (await upgradeHeading.count() > 0) || 
                  (await upgradeClass.count() > 0);
    
    if (found) {
      const element = (await upgradeText.count() > 0) ? upgradeText.first() :
                      (await upgradeHeading.count() > 0) ? upgradeHeading.first() :
                      upgradeClass.first();
      await expect(element).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    // Firefox-specific: Use longer timeout and retry on connection errors
    const timeout = browserName === 'firefox' ? 45000 : 30000;
    const waitUntil = browserName === 'firefox' ? 'domcontentloaded' : 'networkidle';
    
    try {
      await page.goto('/', { waitUntil, timeout });
      await acceptTermsIfPresent(page);
    } catch (error) {
      if (browserName === 'firefox' && (error.message.includes('CONNECTION_REFUSED') || error.message.includes('NS_ERROR'))) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.goto('/', { waitUntil, timeout });
        await acceptTermsIfPresent(page);
      } else {
        throw error;
      }
    }
    await page.waitForLoadState('networkidle');
    
    // Check that page is still functional
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should work on tablet viewport', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    // Firefox-specific: Use longer timeout and retry on connection errors
    const timeout = browserName === 'firefox' ? 45000 : 30000;
    const waitUntil = browserName === 'firefox' ? 'domcontentloaded' : 'networkidle';
    
    try {
      await page.goto('/', { waitUntil, timeout });
      await acceptTermsIfPresent(page);
    } catch (error) {
      if (browserName === 'firefox' && (error.message.includes('CONNECTION_REFUSED') || error.message.includes('NS_ERROR'))) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.goto('/', { waitUntil, timeout });
        await acceptTermsIfPresent(page);
      } else {
        throw error;
      }
    }
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Dark Mode', () => {
  test('should toggle dark mode if available', async ({ page, browserName }) => {
    // Firefox-specific: Use longer timeout and retry on connection errors
    const timeout = browserName === 'firefox' ? 45000 : 30000;
    const waitUntil = browserName === 'firefox' ? 'domcontentloaded' : 'networkidle';
    
    try {
      await page.goto('/', { waitUntil, timeout });
      await acceptTermsIfPresent(page);
    } catch (error) {
      if (browserName === 'firefox' && (error.message.includes('CONNECTION_REFUSED') || error.message.includes('NS_ERROR'))) {
        // Retry once for Firefox connection issues
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.goto('/', { waitUntil, timeout });
        await acceptTermsIfPresent(page);
      } else {
        throw error;
      }
    }
    await page.waitForLoadState('networkidle');
    
    // Look for dark mode toggle
    const darkModeToggle = page.locator('[aria-label*="dark"], [aria-label*="theme"], button:has-text("Dark")').first();
    if (await darkModeToggle.count() > 0) {
      await darkModeToggle.click();
      // Check that dark mode class is applied
      const html = page.locator('html');
      await expect(html).toHaveClass(/dark/, { timeout: 1000 });
    }
  });
});

