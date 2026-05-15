import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('Layout and Usability Tests', () => {
  test.beforeEach(async () => {
    // Seed the database before each test to ensure fresh state
    try {
      execSync('node seed-e2e.cjs');
    } catch (e) {
      console.error('Seeding failed:', e);
    }
  });

  test('Settings dialog should be scrollable and all fields accessible', async ({ page }) => {
    await page.goto('/');

    // Open settings
    await page.locator('button:has(svg.lucide-settings)').click();

    // Go to LLM tab
    await page.getByRole('tab', { name: 'LLM' }).click();

    // Find the scroll area viewport
    const scrollArea = page.locator('[role="dialog"] [data-radix-scroll-area-viewport]');

    // Ensure the scroll area exists
    await expect(scrollArea).toBeVisible();

    // Scroll to the bottom
    await scrollArea.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    // Check if the bottom-most fields are visible/accessible
    // "Model Parameters" is at the bottom
    const modelParams = page.getByRole('button', { name: 'Model Parameters' });
    await expect(modelParams).toBeVisible();

    // Ensure the footer with Save button is visible
    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeVisible();
  });

  test('Article detail page should be scrollable', async ({ page }) => {
    await page.goto('/');

    // Wait for the grid to appear and click the first article
    // Increase timeout for slow loads
    const firstArticle = page.locator('.grid > div, .space-y-4 > div').first();
    await expect(firstArticle).toBeVisible({ timeout: 10000 });
    await firstArticle.click();

    // Wait for article detail
    await expect(page.locator('h1')).toBeVisible();

    // Check for the scrollable container
    const scrollContainer = page.locator('.h-screen.overflow-y-auto');
    await expect(scrollContainer).toBeVisible();

    // Verify it is actually scrollable (scrollHeight > clientHeight)
    const isScrollable = await scrollContainer.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(isScrollable).toBe(true);

    // Verify it has the overflow-y-auto style
    const overflow = await scrollContainer.evaluate((el) => window.getComputedStyle(el).overflowY);
    expect(overflow).toBe('auto');
  });
});
