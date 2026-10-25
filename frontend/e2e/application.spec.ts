import { expect, test } from '@playwright/test';

test('upload, verified evidence, eligibility, bilingual chat, roadmap and download', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Scholarship PDF' }).click();
  await page.getByLabel('Previous marks (%)').fill('85');
  await page.getByRole('button', { name: 'Analyze with Gemma 4' }).click();
  await expect(page.getByRole('heading', { name: 'Riverbend Student Support Grant 2026' })).toBeVisible();
  await expect(page.locator('.document-canvas canvas')).toBeVisible();
  await page.getByRole('tab', { name: 'Eligibility', exact: true }).click();
  await expect(page.getByText('Appears to meet extracted rules', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Page 1.*Applicants must have/ }).click();
  await expect(page.locator('.evidence-quote')).toContainText('Verified quotation');
  await expect(page.getByLabel('Page', { exact: true })).toHaveValue('1');
  await page.getByRole('tab', { name: 'Assistant', exact: true }).click();
  await page.getByLabel('Ask about this notice').fill('What documents should I prepare?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.locator('.chat-message.assistant')).toContainText('Prepare your previous examination marksheet');
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
  expect((await download).suggestedFilename()).toBe('FormBridge-Application-Roadmap.txt');
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
  await page.screenshot({ path: `test-results/workspace-${test.info().project.name}.png`, fullPage: true });
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
