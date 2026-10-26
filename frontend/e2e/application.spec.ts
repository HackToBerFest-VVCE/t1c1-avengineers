import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('upload, verified evidence, eligibility, bilingual chat, roadmap and download', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Scholarship PDF' }).click();
  await page.getByLabel('Previous marks (%)').fill('85');
  await page.getByRole('button', { name: 'Analyze with Gemma 4' }).click();
  await expect(page.getByRole('heading', { name: 'Riverbend Student Support Grant 2026' })).toBeVisible();
  await expect(page.locator('.document-canvas canvas')).toBeVisible();
  await page.locator('#results').screenshot({ path: `test-results/overview-${test.info().project.name}.png`, animations: 'disabled' });
  await page.getByRole('tab', { name: 'Eligibility', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: 'Eligibility', exact: true }).getByText('Appears to meet extracted rules', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Page 1.*Applicants must have/ }).click();
  await expect(page.locator('.evidence-quote')).toContainText('Verified quotation');
  await expect(page.getByLabel('Page', { exact: true })).toHaveValue('1');
  await page.locator('#results').screenshot({ path: `test-results/eligibility-${test.info().project.name}.png`, animations: 'disabled' });
  await page.getByRole('tab', { name: 'Assistant', exact: true }).click();
  await page.getByLabel('Ask about this notice').fill('What documents should I prepare?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.locator('.chat-message.assistant')).toContainText('Prepare your previous examination marksheet');
  await page.locator('#results').screenshot({ path: `test-results/chat-${test.info().project.name}.png`, animations: 'disabled' });
  await page.getByRole('button', { name: 'ಕನ್ನಡ', exact: true }).click();
  await page.getByLabel('ಈ ಪ್ರಕಟಣೆಯ ಬಗ್ಗೆ ಕೇಳಿ').fill('ಯಾವ ದಾಖಲೆಗಳು ಬೇಕು?');
  await page.getByRole('button', { name: 'ಪ್ರಶ್ನೆ ಕಳುಹಿಸಿ' }).click();
  await expect(page.locator('.chat-message.assistant').last()).toContainText('ಅಂಕಪಟ್ಟಿಯನ್ನು ಸಿದ್ಧಪಡಿಸಿ');
  await page.getByRole('tab', { name: 'ಕ್ರಿಯಾ ಯೋಜನೆ', exact: true }).click();
  await page.getByLabel('ಅರ್ಹತೆಯನ್ನು ಪರಿಶೀಲಿಸಿ', { exact: true }).check();
  await page.getByRole('tab', { name: 'ಸಾರಾಂಶ', exact: true }).click();
  await page.getByRole('tab', { name: 'ಕ್ರಿಯಾ ಯೋಜನೆ', exact: true }).click();
  await expect(page.getByLabel('ಅರ್ಹತೆಯನ್ನು ಪರಿಶೀಲಿಸಿ', { exact: true })).toBeChecked();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ಪಟ್ಟಿಯನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ' }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toBe('FormBridge-Application-Roadmap.txt');
  expect(await readFile((await exported.path())!, 'utf8')).toContain('[x]');
  const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth,
    elements: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > window.innerWidth + 1).map(el => ({ tag: el.tagName, cls: el.className, right: el.getBoundingClientRect().right })).slice(0, 15) }));
  expect(layout.width, JSON.stringify(layout.elements)).toBeLessThanOrEqual(layout.viewport);
  const nonblank = await page.locator('.document-canvas canvas').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')!;
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let colored = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] < 230 && data[i + 1] < 230 && data[i + 2] < 230) colored++;
    return colored > 100;
  });
  expect(nonblank).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: `test-results/workspace-${test.info().project.name}.png`, fullPage: true, animations: 'disabled' });
});

test('real PDF.js navigation and zoom on a multipage PDF', async ({ page, request }) => {
  const pdf = await request.get('http://127.0.0.1:18030/test-only/multipage.pdf');
  await page.goto('/');
  await page.getByLabel('Choose a scholarship notice').setInputFiles({ name: 'multipage.pdf', mimeType: 'application/pdf', buffer: await pdf.body() });
  await page.getByRole('button', { name: 'Analyze with Gemma 4' }).click();
  await expect(page.locator('.document-canvas canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByLabel('Page', { exact: true })).toHaveValue('2');
  await expect(page.locator('.document-canvas')).toContainText('second page evidence');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.locator('.viewer-toolbar')).toContainText('125%');
  await page.getByRole('button', { name: 'Fit to width' }).click();
  await expect(page.locator('.viewer-toolbar')).toContainText('100%');
});

test('provider failure preserves input and exposes retry', async ({ page }) => {
  await page.route('**/api/analyze', route => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ detail: 'Gemma temporary failure. Please retry.' }) }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Notice image' }).click();
  await page.getByLabel('Previous marks (%)').fill('80');
  await page.getByRole('button', { name: 'Analyze with Gemma 4' }).click();
  await expect(page.getByRole('alert')).toContainText('Gemma temporary failure');
  await expect(page.getByLabel('Previous marks (%)')).toHaveValue('80');
  await expect(page.getByText('DEMO_City_Learners_Award.png', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
});

test('image analysis, workspace navigation, keyboard focus and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.screenshot({ path: `test-results/dashboard-${test.info().project.name}.png`, animations: 'disabled' });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to workspace' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  const mobile = page.viewportSize()!.width < 768;
  const openNavigation = async () => { if (mobile) await page.getByRole('button', { name: 'Open navigation' }).click(); };
  if (mobile) {
    await openNavigation();
    const drawer = page.getByRole('dialog', { name: 'Workspace navigation' });
    await expect(drawer).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await drawer.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
    await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
  } else if (page.viewportSize()!.width >= 1024) {
    await page.getByRole('button', { name: 'Collapse navigation' }).click();
    await expect(page.locator('.sidebar')).toHaveClass(/compact/);
    await page.getByRole('button', { name: 'Expand navigation' }).click();
  }
  await openNavigation();
  await page.getByRole('link', { name: 'Document analyzer', exact: true }).click();
  await page.getByRole('button', { name: 'Notice image', exact: true }).click();
  await expect(page.getByAltText('Selected scholarship notice')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replace document' })).toBeEnabled();
  await page.getByRole('button', { name: 'Analyze with Gemma 4' }).click();
  await expect(page.locator('.document-canvas img')).toBeVisible();
  await expect(page.locator('.result-outcome')).toContainText('Needs verification');
  const overview = page.getByRole('tab', { name: 'Overview', exact: true });
  await overview.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Eligibility', exact: true })).toBeFocused();
  await expect(page.getByRole('tabpanel', { name: 'Eligibility', exact: true })).toContainText('Text verification unavailable');
  await page.getByRole('button', { name: 'Expand viewer', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Original document' });
  await expect(viewer).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await viewer.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Expand viewer', exact: true })).toBeFocused();
  await openNavigation();
  await page.getByRole('link', { name: 'Scholarship assistant', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Assistant', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Which details are missing?' }).click();
  await expect(page.locator('.chat-message.assistant')).toBeVisible();
  await openNavigation();
  await page.getByRole('link', { name: 'Application roadmap', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Action plan', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.application-roadmap')).toBeVisible();
  await expect(page.locator('.evidence-viewer')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
});
