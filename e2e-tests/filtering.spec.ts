/**
 * Verifies static-catalog filtering, accessibility, and progressive enhancement.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const strategy = ['DevOps Dominion', 'Pipeline Conquest', 'Repo Rulers', 'Server Siege'];
const puzzle = ['Bug Buster Brainteaser', 'Code Puzzle Chronicles', 'Merge Conflict Mystery', 'Stack Trace Secrets'];
const codeForge = ['Cloud Conqueror', 'Code Puzzle Chronicles', 'Code Quest Odyssey', 'DevOps Dominion', 'Script Strike', 'Virtual Server Simulator'];

async function expectTitles(page: Page, titles: string[]): Promise<void> {
  await expect(page.locator('[data-testid="game-card"]:visible [data-testid="game-title"]'))
    .toHaveText([...titles].sort());
  await expect(page.getByRole('status')).toHaveText(`${titles.length} ${titles.length === 1 ? 'game' : 'games'} found`);
}

async function selectUnmatchedPublisher(page: Page): Promise<void> {
  // The seed covers every category/publisher pair; emulate a publisher without games.
  await page.getByLabel('Publisher', { exact: true }).evaluate((element: HTMLSelectElement) => {
    element.add(new Option('Publisher without games', '999999'));
  });
  await page.getByLabel('Publisher', { exact: true }).selectOption({ label: 'Publisher without games' });
}

test.describe('Game filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Publisher', { exact: true })).toBeEnabled();
  });

  test('filters by any selected category and restores the catalog', async ({ page }) => {
    const allTitles = await page.getByTestId('game-title').allTextContents();
    await expect(page.getByTestId('game-card')).toHaveCount(21);
    await expectTitles(page, allTitles);

    await test.step('Select one category then add a second', async () => {
      await page.getByRole('checkbox', { name: 'Strategy', exact: true }).check();
      await expectTitles(page, strategy);
      await page.getByRole('checkbox', { name: 'Puzzle', exact: true }).check();
      await expectTitles(page, [...strategy, ...puzzle]);
    });
    await test.step('Remove one category then clear all filters', async () => {
      await page.getByRole('checkbox', { name: 'Strategy', exact: true }).uncheck();
      await expectTitles(page, puzzle);
      await page.getByRole('button', { name: 'Clear filters' }).click();
      await expect(page.getByRole('checkbox', { name: 'Puzzle', exact: true })).not.toBeChecked();
      await expectTitles(page, allTitles);
    });
  });

  test('filters by publisher and combines it with categories using AND', async ({ page }) => {
    const publisher = page.getByLabel('Publisher', { exact: true });
    const allTitles = await page.getByTestId('game-title').allTextContents();
    await publisher.selectOption({ label: 'CodeForge Studios' });
    await expectTitles(page, codeForge);
    await page.getByRole('checkbox', { name: 'Strategy', exact: true }).check();
    await expectTitles(page, ['DevOps Dominion']);
    await page.getByRole('checkbox', { name: 'Puzzle', exact: true }).check();
    await expectTitles(page, ['DevOps Dominion', 'Code Puzzle Chronicles']);
    await publisher.selectOption({ label: 'DevMasters Inc.' });
    await expectTitles(page, ['Pipeline Conquest', 'Merge Conflict Mystery']);
    await publisher.selectOption({ label: 'All publishers' });
    await expectTitles(page, [...strategy, ...puzzle]);
    await publisher.selectOption({ label: 'CodeForge Studios' });
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(publisher).toHaveValue('');
    await expect(page.getByRole('checkbox', { name: 'Strategy', exact: true })).not.toBeChecked();
    await expectTitles(page, allTitles);
    await expect(page).toHaveURL('/');
  });

  test('shows no-results feedback and recovers when cleared', async ({ page }) => {
    const allTitles = await page.getByTestId('game-title').allTextContents();
    await selectUnmatchedPublisher(page);
    await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(0);
    await expect(page.getByRole('status')).toHaveText('0 games found');
    await expect(page.getByTestId('empty-state-text')).toHaveText('No games match your filters.');
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(scan.violations).toEqual([]);
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expectTitles(page, allTitles);
    await expect(page.getByTestId('empty-state')).toBeHidden();
  });

  test('supports keyboard filtering, visible focus, and filtered card navigation', async ({ page }) => {
    const category = page.getByRole('checkbox', { name: 'Strategy', exact: true });
    const action = page.getByRole('checkbox', { name: 'Action', exact: true });
    await action.focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('checkbox', { name: 'Adventure', exact: true })).toBeFocused();
    await category.focus();
    await page.keyboard.press('Space');
    await expect(category).toBeChecked();
    await expect(category).toBeFocused();
    await expectTitles(page, strategy);
    await expect(page.getByTestId('games-grid').getByRole('link')).toHaveCount(4);
    expect(await category.evaluate((element) => {
      const style = getComputedStyle(element);
      return (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') || style.boxShadow !== 'none';
    })).toBe(true);
    await expect(page.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(scan.violations).toEqual([]);

    const publisher = page.getByLabel('Publisher', { exact: true });
    await publisher.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(publisher.locator('option:checked')).toHaveText('CodeForge Studios');
    await expectTitles(page, ['DevOps Dominion']);
    await page.getByRole('button', { name: 'Clear filters' }).focus();
    await page.keyboard.press('Tab');
    const firstVisible = page.locator('[data-testid="game-card"]:visible').first();
    await expect(firstVisible).toBeFocused();
    await expect(firstVisible.getByTestId('game-title')).toHaveText('DevOps Dominion');
    const href = await firstVisible.getAttribute('href');
    if (!href) throw new Error('The filtered game card must link to its detail page.');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(href);
    await expect(page.getByTestId('game-details-title')).toHaveText('DevOps Dominion');
  });

  test('keeps controls usable on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('checkbox', { name: 'Puzzle', exact: true }).check();
    await page.getByLabel('Publisher', { exact: true }).selectOption({ label: 'GitHub Games' });
    await expectTitles(page, ['Bug Buster Brainteaser']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(21);
  });
});

test('keeps the complete catalog usable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await expect(page.getByLabel('Publisher', { exact: true })).toBeDisabled();
    await expect(page.getByRole('checkbox', { name: 'Strategy', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Clear filters' })).toBeDisabled();
    await expect(page.getByTestId('game-card')).toHaveCount(21);
    await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(21);
    await expect(page.getByText('Enable JavaScript to filter games. The full catalog is available below.')).toBeVisible();
    const first = page.getByTestId('game-card').first();
    const title = await first.getByTestId('game-title').textContent();
    if (!title) throw new Error('The game card must have a title.');
    await first.click();
    await expect(page.getByTestId('game-details-title')).toHaveText(title);
  } finally {
    await context.close();
  }
});
