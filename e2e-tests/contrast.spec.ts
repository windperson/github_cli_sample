import { test, expect } from '@playwright/test';

test.describe('High contrast preference', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('keyboard activation changes the palette and persists both on and off states', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'High contrast', exact: true });

    await test.step('Keep the original palette until the user opts in', async () => {
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('body')).toHaveCSS('background-color', 'oklch(0.208 0.042 265.755)');
      expect(await page.evaluate(() => localStorage.getItem('tailspin-contrast'))).toBeNull();
    });

    await test.step('Reach the toggle with Tab and activate with Space', async () => {
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('skip-link')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('menu-toggle')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('nav-brand')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(toggle).toBeFocused();
      await expect(toggle).toHaveCSS('outline-style', 'solid');
      await expect(toggle).toHaveCSS('outline-width', '2px');
      await page.keyboard.press('Space');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(toggle).toBeFocused();
      await expect(toggle).toHaveCSS('outline-color', 'rgb(255, 255, 0)');
      await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
      await expect(page.getByTestId('game-description').first()).toHaveCSS('color', 'rgb(255, 255, 255)');
      await expect(page.getByTestId('game-card').first()).toHaveCSS('border-top-color', 'rgb(255, 255, 255)');
      await expect(page.getByTestId('game-category').first()).toHaveCSS('color', 'rgb(255, 255, 0)');
      expect(await page.evaluate(() => localStorage.getItem('tailspin-contrast'))).toBe('high');
    });

    await test.step('Restore the preference after reload and across every page type', async () => {
      await page.reload();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await page.getByTestId('game-card').first().click();
      await expect(page).toHaveURL(/\/game\/\d+$/);
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('back-game-button')).toHaveCSS('border-top-color', 'rgb(255, 255, 255)');
      await page.getByRole('button', { name: 'Toggle menu' }).click();
      await expect(page.getByRole('navigation')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
      await expect(page.getByRole('navigation')).toHaveCSS('color', 'rgb(255, 255, 255)');
      await page.getByRole('navigation').getByRole('link', { name: 'About' }).click();
      await expect(page).toHaveURL('/about');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await page.goto('/missing-page');
      await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    });

    await test.step('Turn off with Enter and preserve the original palette after reload', async () => {
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      expect(await page.evaluate(() => localStorage.getItem('tailspin-contrast'))).toBe('normal');
      await page.reload();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('body')).toHaveCSS('background-color', 'oklch(0.208 0.042 265.755)');
      await page.getByTestId('not-found-home-link').click();
      await expect(page).toHaveURL('/');
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });
  });

  test('restores saved contrast before the document body can render', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('tailspin-contrast', 'high'));
    await page.addInitScript(() => {
      new MutationObserver((_mutations, observer) => {
        if (document.body) {
          document.body.setAttribute('data-initial-contrast', document.documentElement.dataset.contrast ?? 'unset');
          observer.disconnect();
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-initial-contrast', 'high');
    await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  });

  test('ignores unrecognized saved preferences', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('tailspin-contrast', 'invalid'));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-contrast', 'normal');
    await expect(page.getByRole('button', { name: 'High contrast' })).toHaveAttribute('aria-pressed', 'false');
  });

  for (const failure of ['read', 'write']) {
    test(`storage ${failure} failures leave the toggle usable and announce unsaved preferences`, async ({ page }) => {
      await page.addInitScript((operation) => {
        if (operation === 'read') {
          Object.defineProperty(window, 'localStorage', {
            get: () => { throw new DOMException('Storage unavailable', 'SecurityError'); },
          });
        } else {
          Storage.prototype.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError'); };
        }
      }, failure);
      await page.reload();
      const toggle = page.getByRole('button', { name: 'High contrast' });
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
      await expect(page.getByRole('status')).toHaveText('Your contrast preference could not be saved. It applies to this page only.');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });
  }

  test('header controls remain usable at narrow widths and 200% zoom equivalent', async ({ page }) => {
    for (const width of [640, 320]) {
      await page.setViewportSize({ width, height: 720 });
      const toggle = page.getByRole('button', { name: 'High contrast' });
      await expect(toggle).toBeVisible();
      for (const control of [toggle, page.getByTestId('menu-toggle'), page.getByTestId('nav-brand')]) {
        const box = await control.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(box?.width).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await toggle.click();
      await page.getByRole('button', { name: 'Toggle menu' }).click();
      await expect(page.getByRole('navigation')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('menu-toggle')).toBeFocused();
    }
  });
});
