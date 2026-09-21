import { test, expect } from '@playwright/test';
import { seedStudy } from './helpers';
test('desktop sidebar remains in viewport across long pages while main content scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await seedStudy(page, 20, 30);
  for (const path of ['/', '/library', '/library/learn-deck', '/progress', '/settings']) {
    await page.goto(path); const sidebar = page.locator('aside'); await expect(sidebar).toBeVisible();
    await expect(page.locator('main h1')).toBeVisible();
    const before = (await sidebar.boundingBox())!;
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(50);
    const after = (await sidebar.boundingBox())!;
    expect(Math.abs(after.y - before.y)).toBeLessThan(1); expect(after.height).toBe(600);
    await expect(sidebar.getByRole('link', { name: /BOLET/ })).toBeInViewport();
    await expect(sidebar.getByRole('navigation')).toBeInViewport();
    await expect(sidebar.getByRole('button', { name: /Switch to .* mode/ })).toBeInViewport();
    const scroll = await page.evaluate(() => ({ horizontal: document.documentElement.scrollWidth > innerWidth, mainOverflow: getComputedStyle(document.querySelector('main')!).overflowY, bodyOverflow: getComputedStyle(document.body).overflowY }));
    expect(scroll.horizontal).toBe(false); expect(['scroll', 'auto']).not.toContain(scroll.mainOverflow); expect(scroll.bodyOverflow).not.toBe('scroll');
  }
  await page.goto('/practice?deck=learn-deck&mode=learn'); await expect(page.getByRole('heading', { name: 'Set up Learn' })).toBeVisible(); await expect(page.locator('aside')).toHaveCount(0);
  await page.goto('/study/learn-deck'); await expect(page.getByTestId('flashcard')).toBeVisible(); await expect(page.locator('aside')).toHaveCount(0);
});
test('mobile navigation survives sidebar positioning change', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await seedStudy(page, 6); await page.reload();
  await expect(page.locator('aside')).toBeHidden(); await expect(page.getByRole('navigation', { name: 'Main', exact: true }).last()).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
