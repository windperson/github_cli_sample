import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  for (const path of ['/', '/game/1', '/about', '/missing-page']) {
    for (const contrast of ['normal', 'high']) {
      test(`${path} has no WCAG AA violations in ${contrast} contrast, including open navigation`, async ({ page }) => {
        await page.goto(path);
        const toggle = page.getByRole('button', { name: 'High contrast', exact: true });
        await expect(toggle).toHaveAttribute('aria-pressed', 'false');
        if (contrast === 'high') await toggle.click();

        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        await expect(page.locator('html')).toHaveAttribute('data-contrast', contrast);
        const scan = new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
        expect((await scan.analyze()).violations).toEqual([]);
        if (path === '/game/1') {
          await page.getByRole('button', { name: 'Support This Game' }).hover();
          expect((await scan.analyze()).violations).toEqual([]);
        }

        await page.getByRole('button', { name: 'Toggle menu' }).click();
        await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
        await page.getByRole('navigation').getByRole('link', { name: 'About' }).hover();
        expect((await scan.analyze()).violations).toEqual([]);
      });
    }
  }

  test('skip link bypasses the header and Escape restores menu focus', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();

    const menuButton = page.getByRole('button', { name: 'Toggle menu' });
    await menuButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Home', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menuButton).toBeFocused();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('navigation')).toBeHidden();
  });

  test('reduced motion disables card movement, transitions, and smooth scrolling', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const card = page.getByTestId('game-card').first();
    await card.hover();
    await expect(card).toHaveCSS('transform', 'none');
    await expect(card).toHaveCSS('transition-duration', '0s');
    await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
  });

  test('keyboard navigation - should be able to navigate header menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="games-grid"]', { timeout: 10000 });

    const menuButton = page.getByRole('button', { name: /toggle menu/i });
    const menu = page.locator('#menu');

    await test.step('Tab until the menu button is focused', async () => {
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab');
        if (await menuButton.evaluate(el => el === document.activeElement)) break;
      }
      await expect(menuButton).toBeFocused();
    });

    await test.step('Open menu with Enter and verify it is visible', async () => {
      await page.keyboard.press('Enter');
      await expect(menu).not.toHaveClass(/hidden/);
    });

    await test.step('Verify menu items are reachable', async () => {
      const homeLink = menu.getByRole('link', { name: /home/i });
      // Focus may already be on the first menu item after opening
      if (!await homeLink.evaluate(el => el === document.activeElement)) {
        for (let i = 0; i < 10; i++) {
          await page.keyboard.press('Tab');
          if (await homeLink.evaluate(el => el === document.activeElement)) break;
        }
      }
      await expect(homeLink).toBeFocused();

      const aboutLink = menu.getByRole('link', { name: /about/i });
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        if (await aboutLink.evaluate(el => el === document.activeElement)) break;
      }
      await expect(aboutLink).toBeFocused();
    });
  });

  test('keyboard navigation - should be able to navigate to game cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="games-grid"]', { timeout: 10000 });

    await test.step('Tab through page until a game card receives focus', async () => {
      const MAX_TABS = 50;
      let tabCount = 0;

      await expect.poll(async () => {
        if (tabCount < MAX_TABS) {
          await page.keyboard.press('Tab');
          tabCount++;
        }
        return page.locator('[data-testid="game-card"]:focus').count();
      }, { timeout: 15000, message: 'Expected a game card to receive focus via Tab' }).toBeGreaterThan(0);
    });
  });

  test('keyboard navigation - should be able to activate game card with Enter', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="games-grid"]', { timeout: 10000 });

    let gameId: string | null = null;

    await test.step('Tab to a game card using real keyboard navigation', async () => {
      let tabCount = 0;
      let gameCardFocused = false;

      while (tabCount < 20 && !gameCardFocused) {
        await page.keyboard.press('Tab');
        tabCount++;

        const focusedElement = page.locator(':focus');
        const testId = await focusedElement.getAttribute('data-testid').catch(() => null);

        if (testId === 'game-card') {
          gameId = await focusedElement.getAttribute('data-game-id');
          gameCardFocused = true;
        }
      }

      expect(gameCardFocused).toBeTruthy();
      expect(gameId).not.toBeNull();
    });

    await test.step('Press Enter and verify navigation to game page', async () => {
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(`/game/${gameId}`);
    });
  });

  test('focus indicators - should have visible focus indicators on interactive elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="games-grid"]', { timeout: 10000 });
    
    // Check menu button has focus indicator
    const menuButton = page.locator('#menu-toggle');
    await menuButton.focus();
    
    // Get computed styles to check for outline or box-shadow
    const hasVisibleFocus = await menuButton.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      const outline = styles.outline;
      const outlineWidth = styles.outlineWidth;
      const boxShadow = styles.boxShadow;
      
      // Check if there's a visible outline or box-shadow (focus ring)
      return (outline !== 'none' && outlineWidth !== '0px') || boxShadow !== 'none';
    });
    
    expect(hasVisibleFocus).toBeTruthy();
  });

  test('ARIA labels - header menu should have proper ARIA attributes', async ({ page }) => {
    await page.goto('/');
    
    // Check menu button has aria-label or aria-labelledby
    const menuButton = page.locator('#menu-toggle');
    const hasAriaLabel = await menuButton.evaluate((el) => {
      return el.hasAttribute('aria-label') || 
             el.hasAttribute('aria-labelledby') ||
             el.hasAttribute('aria-describedby');
    });
    
    // SVG should have proper role or title
    const menuIcon = menuButton.locator('svg');
    const svgAccessible = await menuIcon.evaluate((el) => {
      return el.hasAttribute('role') || 
             el.hasAttribute('aria-label') ||
             el.querySelector('title') !== null;
    });
    
    expect(hasAriaLabel || svgAccessible).toBeTruthy();
  });

  test('color contrast - should meet WCAG AA standards', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="games-grid"]', { timeout: 10000 });
    
    // Run axe with specific color contrast checks
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include('body')
      .analyze();
    
    // Filter for color contrast violations
    const contrastViolations = accessibilityScanResults.violations.filter(
      violation => violation.id === 'color-contrast'
    );
    
    expect(contrastViolations).toEqual([]);
  });

  test('semantic HTML - main landmarks should be present', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="games-grid"]', { timeout: 10000 });
    
    // Check for header landmark (use first() to avoid strict mode violation from dev tools)
    const header = page.locator('header').first();
    await expect(header).toBeVisible();
    
    // Check for main landmark
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('decorative SVGs should have aria-hidden attribute', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="games-grid"]', { timeout: 10000 });
    
    // Check menu button SVG has aria-hidden
    const menuButtonSvg = page.locator('#menu-toggle svg');
    await expect(menuButtonSvg).toHaveAttribute('aria-hidden', 'true');
    
    // Check game card arrow SVGs have aria-hidden (scope to first card to avoid strict mode violation)
    const firstGameCard = page.locator('[data-testid="game-card"]').first();
    const gameCardSvgs = firstGameCard.locator('svg');
    const count = await gameCardSvgs.count();
    
    // Verify at least one SVG exists and all have aria-hidden
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(gameCardSvgs.nth(i)).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
