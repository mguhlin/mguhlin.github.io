import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const projects = JSON.parse(readFileSync(new URL('../data/projects.json', import.meta.url), 'utf8'));

test('all reviewed projects, images, and launch links render without errors', async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).origin !== new URL(page.url()).origin && page.url() !== 'about:blank') external.push(request.url()); });
  await page.goto('./');
  await expect(page).toHaveTitle(/Creations by Miguel Guhlin/);
  await expect(page.locator('.project-card')).toHaveCount(projects.length);
  for (const project of projects) {
    await expect(page.getByRole('link', {name: `Open ${project.name}`, exact: true})).toHaveAttribute('href', project.url);
    await expect(page.getByRole('link', {name: `${project.name} source on GitHub`, exact: true})).toHaveAttribute('href', `https://github.com/mguhlin/${project.repo}`);
  }
  await page.locator('img').evaluateAll(images => images.forEach(image => image.loading = 'eager'));
  await expect.poll(() => page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('search and category filters combine, reset, and survive reload', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', {name: 'Learning', exact: true}).click();
  await expect(page.locator('.project-card:visible')).toHaveCount(5);
  await page.getByRole('searchbox', {name:'Search projects'}).fill('coaching');
  await expect(page.locator('.project-card:visible')).toHaveCount(2);
  await expect(page).toHaveURL(/q=coaching/);
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue('coaching');
  await expect(page.locator('.project-card:visible')).toHaveCount(2);
  await page.getByRole('searchbox').fill('no-match-xyz');
  await expect(page.getByRole('heading', {name:'No projects found.'})).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('0 of 13 projects');
  await page.getByRole('button', {name:'Clear search & filters'}).click();
  await expect(page.locator('.project-card:visible')).toHaveCount(13);
  await expect(page.getByRole('searchbox')).toBeFocused();
});

test('alphabetical order and query parameters are applied consistently', async ({ page }) => {
  await page.goto('./?category=Play+%26+explore&sort=az');
  await expect(page.locator('.project-card:visible')).toHaveCount(4);
  const names = await page.locator('.project-card:visible h3').allTextContents();
  expect(names).toEqual([...names].sort((a,b) => a.localeCompare(b)));
  await page.getByLabel('Sort by').selectOption('featured');
  await expect(page.locator('.project-card:visible h3').first()).toHaveText('Prospect 47');
  await page.goto('./?q=%3Cscript%3E&category=invalid');
  await expect(page.getByRole('status')).toHaveText('0 of 13 projects');
  await expect(page.getByRole('button', {name:'All projects', exact:true})).toHaveAttribute('aria-pressed','true');
});

test('layouts stay within the viewport and interactive controls remain reachable', async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({width, height:900});
    await page.goto('./');
    await expect(page.getByRole('heading', {level:1})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', {name:'Experiments', exact:true}).click();
    await expect(page.locator('.project-card:visible')).toHaveCount(1);
    await expect(page.getByRole('link', {name:'Open Website Design Study',exact:true})).toBeVisible();
    await expect(page.getByText('Unofficial concept', {exact:true})).toBeVisible();
  }
});

test('the directory and all launch links work without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({javaScriptEnabled:false});
  const page = await context.newPage();
  await page.goto(baseURL!);
  await expect(page.locator('.project-card')).toHaveCount(13);
  await expect(page.locator('#directory-controls')).toBeHidden();
  await expect(page.getByRole('link', {name:'Open DrawSplat',exact:true})).toHaveAttribute('href','https://drawsplat.org/');
  await context.close();
});

test('keyboard navigation begins with the skip link and reaches project search', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Desktop keyboard behavior is covered in Chromium and Firefox.');
  await page.goto('./');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  await page.getByRole('searchbox').focus();
  await page.keyboard.type('spreadsheet');
  await expect(page.locator('.project-card:visible')).toHaveCount(1);
  await expect(page.locator('.project-card:visible h3')).toHaveText('GridSplat');
});
