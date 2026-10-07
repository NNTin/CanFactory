import { test, expect } from '@playwright/test';
import { springBallDetent, SPRING_BALL_DETENT_DEFAULT } from '@canfactory/contracts';

test('the card shows the detent in section, and on hover pushes the ball in by its travel and lets it go', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models');
  const card = page.locator('.model-card', { hasText: springBallDetent.title });
  const art = card.locator('svg.spring-ball-detent-illustration');
  await expect(art).toBeVisible();
  const ball = art.locator('.sbd-ball');
  const push = () => ball.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).e);
  expect(await push()).toBe(0);
  await card.hover();
  // pushed in by the travel (1 mm, drawn at 7 px/mm), then let go again, looping while hovered
  const travel = SPRING_BALL_DETENT_DEFAULT.travel * 7;
  await expect.poll(push, { timeout: 2_000, intervals: [50] }).toBeLessThan(-travel + 1);
  await expect.poll(push, { timeout: 3_000, intervals: [50] }).toBeGreaterThan(-1);
  await page.mouse.move(0, 0);
  await expect.poll(push).toBe(0);
  expect(errors).toEqual([]);
});

test('the editor sizes the body round the chosen ball and spring, lists them as hardware, and refuses what does not fit', async ({ page }) => {
  await page.goto('/#/models/spring-ball-detent');
  await expect(page.getByText(/The spring pushes 11.8 N with the ball out, 16.4 N pushed in/)).toBeVisible();
  const hardware = page.getByRole('region', { name: 'Hardware for this build' });
  await expect(hardware.getByRole('link', { name: 'Steel ball 4.5 mm G100' })).toBeVisible();
  await expect(hardware.getByRole('link', { name: 'Compression spring 0.63 × 4.63 × 9.6' })).toBeVisible();
  // a 4.5 mm ball leaves no wall in an M6 body
  await page.getByRole('combobox', { name: 'Thread' }).selectOption('M6');
  await expect(page.getByRole('alert')).toContainText('Choose a smaller ball or a larger thread');
  await page.getByRole('combobox', { name: 'Thread' }).selectOption('M10');
  // the set screw is offered only for that retention, and is then on the hardware list
  await expect(page.getByRole('combobox', { name: 'Set screw' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Retention' }).selectOption('set-screw');
  await expect(page.getByRole('combobox', { name: 'Set screw' })).toBeVisible();
  await expect(hardware.getByRole('link', { name: 'Set screw M6 × 6' })).toBeVisible();
  // more travel than the spring has before it goes solid
  await page.getByRole('spinbutton', { name: 'Travel' }).fill('4');
  await expect(page.getByRole('alert')).toContainText('before it goes solid');
});

test('a plain body with a side opening: the spring holds itself and the ball, if it is long enough to span the opening', async ({ page }) => {
  await page.goto('/#/models/spring-ball-detent');
  await page.getByRole('combobox', { name: 'Body', exact: true }).selectOption('plain');
  // a plain body has a diameter, not a thread
  await expect(page.getByRole('combobox', { name: 'Thread' })).toHaveCount(0);
  await expect(page.getByRole('spinbutton', { name: 'Body diameter' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Retention' }).selectOption('side-opening');
  await page.getByRole('combobox', { name: 'Tool feature' }).selectOption('none');
  // the default D-107 is too short to reach past both ends of the opening
  await expect(page.getByRole('alert')).toContainText('Choose a longer spring');
  await page.getByRole('combobox', { name: 'Spring' }).selectOption('gutekunst-d-078');
  await expect(page.getByText(/squeeze the spring to [\d.]+ mm or less, put it in and let it go/)).toBeVisible();
  // the preview puts the ball in through the opening, then the spring, and works the detent
  const slider = page.getByRole('slider', { name: 'Assembly' });
  await slider.press('Home');
  for (const caption of ['Lift and lay out the parts', 'Step 1 of 4 · Put the ball in through the side opening', 'Step 2 of 4 · Push it up the bore onto the lip',
    'Step 3 of 4 · Compress the spring into the opening', 'Step 4 of 4 · Let it go: it holds itself and the ball', 'Movement 1 of 1 · Push the ball in flush, and let it go']) {
    await slider.press('ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuetext', caption);
  }
});
