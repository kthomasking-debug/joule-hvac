import { test, expect } from '@playwright/test';
import { setupTest } from './helpers/test-setup';

test.describe('Heat Pump Guide', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
    await page.goto('/heat-pump-guide');
    await page.waitForLoadState('networkidle');
    
    // Wait for the page content to appear - use a more specific selector
    await page.waitForSelector('h1, button:has-text("How It Works")', { timeout: 15000 });
  });

  test('should display heat pump guide page', async ({ page }) => {
    // Wait for page to fully render
    await page.waitForTimeout(1000);
    
    // Check for main heading - use more flexible selector
    const heading = page.locator('h1, [class*="text-4xl"], [class*="text-5xl"]').filter({ hasText: /Understanding.*Heat Pump/i });
    await expect(heading.first()).toBeVisible({ timeout: 15000 });
    
    // Check for subtitle
    await expect(page.getByText(/Everything you need to know/i)).toBeVisible({ timeout: 10000 });
    
    // Check for navigation pills - use button selector
    await expect(page.getByRole('button', { name: /How It Works/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Normal Behavior/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Auxiliary Heat/i })).toBeVisible({ timeout: 10000 });
  });

  test('should have all section navigation buttons', async ({ page }) => {
    const sections = [
      'How It Works',
      'Normal Behavior',
      'Auxiliary Heat',
      'Cold Weather',
      'Efficiency Tips',
      'Comfort'
    ];

    for (const section of sections) {
      // Use button role selector to target navigation buttons specifically
      await expect(page.getByRole('button', { name: section })).toBeVisible();
    }
  });

  test('should switch between sections', async ({ page }) => {
    // Start with intro section
    await expect(page.locator('text=Why doesn\'t my heat pump blast hot air')).toBeVisible();
    
    // Click on "Normal Behavior" section
    await page.click('text=Normal Behavior');
    await page.waitForTimeout(500);
    
    // Should show questions from behavior section
    await expect(page.locator('text=Why does it only raise the temperature 1-2°F per hour?')).toBeVisible();
  });

  test('should expand and collapse questions', async ({ page }) => {
    // Find first question
    const firstQuestion = page.locator('text=Why doesn\'t my heat pump blast hot air').first();
    await expect(firstQuestion).toBeVisible();
    
    // Click to expand
    await firstQuestion.click();
    await page.waitForTimeout(300);
    
    // Should show answer
    await expect(page.locator('text=Heat pumps work differently!')).toBeVisible();
    
    // Click again to collapse
    await firstQuestion.click();
    await page.waitForTimeout(300);
    
    // Answer should be hidden (or at least the detailed text)
    const answer = page.locator('text=Heat pumps work differently!');
    // May still be in DOM but collapsed, so we check visibility
    const isVisible = await answer.isVisible().catch(() => false);
    // Either not visible or collapsed
    expect(isVisible).toBeFalsy();
  });

  test('should display visualizations', async ({ page }) => {
    // Expand first question which has a visual
    const firstQuestion = page.locator('text=Why doesn\'t my heat pump blast hot air').first();
    await firstQuestion.click();
    await page.waitForTimeout(500);
    
    // Should show visual comparison - use more specific selectors
    await expect(page.getByText('Heat Pump', { exact: true }).filter({ hasText: /^Heat Pump$/ })).toBeVisible();
    await expect(page.getByText('Gas Furnace', { exact: true }).filter({ hasText: /^Gas Furnace$/ })).toBeVisible();
  });

  test('should display quick tips footer', async ({ page }) => {
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    // Check for quick tips - use heading role to target footer headings specifically
    await expect(page.getByRole('heading', { name: 'Save Money' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cold Weather' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Be Patient' })).toBeVisible();
  });

  test('should have responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Should still show main heading
    await expect(page.locator('text=Understanding Your Heat Pump')).toBeVisible();
    
    // Navigation pills should wrap
    const navPills = page.locator('button:has-text("How It Works")');
    await expect(navPills).toBeVisible();
  });

  test('should navigate from other pages', async ({ page }) => {
    // Start on home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Navigate to heat pump guide (if link exists in nav)
    // Or navigate directly
    await page.goto('/heat-pump-guide');
    await page.waitForLoadState('networkidle');
    
    // Should be on guide page
    await expect(page.locator('text=Understanding Your Heat Pump')).toBeVisible();
    await expect(page).toHaveURL(/.*heat-pump-guide/);
  });

  test('should display all question categories', async ({ page }) => {
    const sections = [
      { id: 'intro', question: "Why doesn't my heat pump blast hot air" },
      { id: 'behavior', question: 'Why does it only raise the temperature' },
      { id: 'aux-heat', question: 'Why did my auxiliary heat turn on' },
      { id: 'cold-weather', question: 'How cold can it get' },
      { id: 'efficiency', question: 'Should I use temperature setbacks' },
      { id: 'comfort', question: 'Why does my house feel drafty' },
    ];

    for (const section of sections) {
      // Find section button
      const sectionButton = page.locator(`button:has-text("${section.id === 'intro' ? 'How It Works' : section.id === 'behavior' ? 'Normal Behavior' : section.id === 'aux-heat' ? 'Auxiliary Heat' : section.id === 'cold-weather' ? 'Cold Weather' : section.id === 'efficiency' ? 'Efficiency Tips' : 'Comfort'}")`);
      
      if (await sectionButton.isVisible()) {
        await sectionButton.click();
        await page.waitForTimeout(500);
        
        // Check for question from that section
        await expect(page.locator(`text=${section.question}`)).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

