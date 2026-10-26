import { expect, test } from '@playwright/test';

const fixtures = [
  { kind: 'A', title: 'Academic Test Scholarship', field: 'Previous marks (%)', value: '65', status: 'may_not_meet', source: 2, quote: 'Applicants must secure at least 75 percent.' },
  { kind: 'B', title: 'Income Test Scholarship', field: 'Annual family income (₹)', value: '180000', status: 'likely_meets', source: 3, quote: 'Annual family income must not exceed Rs. 2,50,000.' },
  { kind: 'C', title: 'Postgraduate Test Scholarship', field: 'Education level', value: 'Undergraduate', status: 'may_not_meet', source: 1, quote: 'Only postgraduate students may apply.' },
  { kind: 'D', title: 'ಕಾಲ್ಪನಿಕ ವಿದ್ಯಾ ವಿದ್ಯಾರ್ಥಿವೇತನ', field: 'Previous marks (%)', value: '65', status: 'may_not_meet', source: 2, quote: 'ಅರ್ಜಿದಾರರು ಕನಿಷ್ಠ 75% ಅಂಕಗಳನ್ನು ಪಡೆದಿರಬೇಕು.' },
  { kind: 'E', title: 'Scanned Test Scholarship', field: 'Previous marks (%)', value: '65', status: 'needs_review', source: 1, quote: 'Applicants must secure at least 75 percent.' },
];

for (const fixture of fixtures) test(`fixture ${fixture.kind}: bilingual content, comparison and original-page evidence`, async ({ page, request }) => {
  let analyses = 0;
  page.on('request', req => { if (req.url().endsWith('/api/analyze')) analyses++; });
  const pdf = await request.get(`http://127.0.0.1:18030/test-only/fixtures/${fixture.kind}.pdf`);
  expect(pdf.ok()).toBe(true);
  await page.goto('/');
  await page.getByLabel('Choose a scholarship notice').setInputFiles({ name: `notice_${fixture.kind}.pdf`, mimeType: 'application/pdf', buffer: await pdf.body() });
  if (fixture.kind === 'C') await page.getByLabel(fixture.field, { exact: true }).selectOption(fixture.value);
  else await page.getByLabel(fixture.field, { exact: true }).fill(fixture.value);
  const response = page.waitForResponse(resp => resp.url().endsWith('/api/analyze') && resp.request().method() === 'POST');
  await page.getByRole('button', { name: 'Analyze with Gemma 4' }).click();
  const result = await (await response).json();
  await expect(page.getByRole('heading', { name: fixture.title, exact: true })).toBeVisible();
  await expect(page.locator('.result-summary')).toContainText(result.summary_en);
  await page.getByRole('tab', { name: 'Eligibility', exact: true }).click();
  await expect(page.locator(`.criterion .assessment.${fixture.status}`)).toBeVisible();
  await expect(page.locator(`.eligibility-counts .${fixture.status} strong`)).toHaveText('1');
  await page.locator('.criterion .source-tag').click();
  await expect(page.getByLabel('Page', { exact: true })).toHaveValue(String(fixture.source));
  await expect(page.locator('.evidence-quote')).toContainText(fixture.quote);
  await expect(page.locator('.criterion .verification-badge')).toContainText(fixture.kind === 'E' ? 'Text verification unavailable' : 'Verified quotation');
  await page.getByRole('button', { name: 'ಕನ್ನಡ', exact: true }).click();
  await expect(page.locator(`.criterion .assessment.${fixture.status}`)).toBeVisible();
  await expect(page.locator('.criterion')).toContainText(result.criteria[0].requirement_kn);
  await expect(page.getByLabel('ಪುಟ', { exact: true })).toHaveValue(String(fixture.source));
  await page.getByRole('tab', { name: 'ಸಾರಾಂಶ', exact: true }).click();
  await expect(page.locator('.result-summary')).toContainText(result.summary_kn);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.locator('.result-summary')).toContainText(result.summary_en);
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  await expect(page.locator('.document-item')).toContainText('Examination marksheet');
  expect(analyses).toBe(1);
  await expect(page.getByText(`notice_${fixture.kind}.pdf`, { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});
