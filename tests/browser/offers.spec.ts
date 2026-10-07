import { test, expect, type Page } from '@playwright/test';
import { findPart, marketOfCountry, matchOffers, offers, parseOfferParts, type AffiliateAccounts, type AwinLive, type Offer } from '@canfactory/contracts';

/**
 * Affiliate offers (docs/affiliate-offers.md). The first test answers /api/v1/market with every network off; the others
 * answer /api/v1/market and /api/v1/offers with the real matcher and test accounts, plus one Awin offer with a fresh feed price.
 */
const accounts: AffiliateAccounts = { amazon: { DE: 'canfactory-21', US: 'canfactory-20' }, awin: { publisherId: 12345 } };
const shopOffer: Offer = {
  id: 'awin-de-test', market: 'DE', network: 'awin', advertiserId: 777, shop: 'Werkstattladen', merchantProductId: 'SKU-1', productUrl: 'https://shop.example/m3',
  title: 'Werkstattladen M3 inserts, pack of 25', covers: [{ partId: 'ruthex-rx-m3x5-7', quantity: 25 }], rank: 2, checkedOn: '2026-10-06', note: null, sameAsProduct: false,
};
const live = (): AwinLive => ({ advertiserId: 777, merchantProductId: 'SKU-1', market: 'DE', deepLink: 'https://www.awin1.com/pclick.php?p=1&a=12345&m=777',
  name: 'M3 inserts', price: 4.99, currency: 'EUR', deliveryCost: 3.95, inStock: true, lastImported: Date.now() - 3_600_000 });

async function mockShops(page: Page, country = 'DE') {
  const networks = { amazon: true, awin: true };
  await page.route(url => url.pathname === '/api/v1/market', route => route.fulfill({ json: { market: marketOfCountry(country), country, source: 'geo', networks: { DE: networks, US: networks } } }));
  await page.route(url => url.pathname === '/api/v1/offers', route => {
    const url = new URL(route.request().url());
    const market = url.searchParams.get('market') === 'US' ? 'US' : 'DE';
    return route.fulfill({ json: matchOffers(parseOfferParts(url.searchParams.get('parts') ?? ''), market, { accounts, findPart, catalogue: [shopOffer, ...offers], live: [live()] }) });
  });
}

test('shows no affiliate link while no account is set, but always the disclosure and privacy pages', async ({ page }) => {
  const off = { amazon: false, awin: false };
  await page.route(url => url.pathname === '/api/v1/market', route => route.fulfill({ json: { market: 'DE', country: 'DE', source: 'geo', networks: { DE: off, US: off } } }));
  await page.goto('/#/parts/threaded-insert/ruthex-rx-m3x5-7');
  await expect(page.getByRole('heading', { name: 'Heat-set insert M3 × 5.7 (ruthex)' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Product page/ })).toHaveAttribute('href', /ruthex\.de/);
  await expect(page.getByRole('region', { name: 'Where to buy' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Buy list/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Disclosure' }).click();
  await expect(page).toHaveURL(/#\/disclosure$/);
  await expect(page.getByText('Als Amazon-Partner verdiene ich an qualifizierten Verkäufen.')).toBeVisible();
  await expect(page.getByText('As an Amazon Associate I earn from qualifying purchases.')).toBeVisible();
  await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy' }).click();
  await expect(page.getByRole('heading', { name: 'Privacy', exact: true })).toBeVisible();
});

test('links a part to its shops, replaces its product page with the affiliate listing, and gathers a buy list by shop', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await mockShops(page);
  await page.goto('/#/parts/threaded-insert/ruthex-rx-m3x5-7');
  const where = page.getByRole('region', { name: 'Where to buy' });
  await expect(where.getByRole('link', { name: 'View at amazon.de' }).first()).toHaveAttribute('href', 'https://www.amazon.de/dp/B08BCRZZS3?tag=canfactory-21');
  await expect(where.getByRole('link', { name: 'View at amazon.de' }).first()).toHaveAttribute('rel', 'sponsored noopener');
  // The Awin offer shows its feed price with VAT, shipping and the time of the feed.
  await expect(where.getByText(/4,99\s€/)).toBeVisible();
  await expect(where.getByText(/incl\. VAT, plus 3,95\s€ shipping/)).toBeVisible();
  await expect(where.getByText(/price as of/)).toBeVisible();
  await expect(where.getByText(/Affiliate links: CanFactory may earn a commission/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Product page at amazon\.de/ })).toHaveAttribute('href', 'https://www.amazon.de/dp/B08BCRZZS3?tag=canfactory-21');
  await page.screenshot({ path: testInfo.outputPath('where-to-buy.png'), fullPage: true });

  await where.getByLabel('Quantity').fill('150');
  await where.getByRole('button', { name: 'Add to buy list' }).click();
  await expect(page.getByRole('button', { name: /Buy list 01/ })).toBeVisible();
  await page.goto('/#/parts/threaded-insert/ruthex-rx-m2x4');
  await page.getByRole('region', { name: 'Where to buy' }).getByRole('button', { name: 'Add to buy list' }).click();
  await page.getByRole('button', { name: /Buy list 02/ }).click();
  await expect(page).toHaveURL(/#\/buy-list$/);
  await expect(page.getByRole('heading', { name: 'amazon.de' })).toBeVisible();
  await expect(page.getByText('2 × ruthex RX-M3x5.7, pack of 100')).toBeVisible();
  await expect(page.getByText('1 × ruthex RX-M2x4, pack of 70')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('buy-list.png'), fullPage: true });

  // Changing a quantity re-plans the packs; the market selector moves the list to amazon.com.
  await page.getByLabel('Quantity of Heat-set insert M3 × 5.7 (ruthex)').fill('20');
  await expect(page.getByText('1 × ruthex RX-M3x5.7, pack of 100')).toBeVisible();
  await page.getByLabel('Shop in').selectOption('US');
  await expect(page.getByRole('heading', { name: 'amazon.com' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View at amazon.com' }).first()).toHaveAttribute('href', /^https:\/\/www\.amazon\.com\/dp\/.+\?tag=canfactory-20$/);
  await page.getByRole('button', { name: 'Remove Heat-set insert M2 × 4 (ruthex)' }).click();
  await expect(page.getByText('1 × ruthex RX-M2x4, pack of 70')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear the list' }).click();
  await expect(page.getByText('Nothing here yet.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('lists the hardware of a model for its settings and of a catio page, and adds it to the buy list', async ({ page }, testInfo) => {
  await mockShops(page, 'AT');
  await page.goto('/#/models/cigarette-case');
  const hardware = page.getByRole('region', { name: 'Hardware for this build' });
  await expect(hardware.getByRole('link', { name: 'BIC Mini lighter (J25)' })).toBeVisible();
  await expect(hardware.getByRole('link', { name: 'Search amazon.de' }).first()).toHaveAttribute('href', /^https:\/\/www\.amazon\.de\/s\?k=BIC%20J25.*&tag=canfactory-21$/);
  await hardware.screenshot({ path: testInfo.outputPath('model-hardware.png') });
  await hardware.getByRole('button', { name: 'Add all to buy list' }).click();
  await expect(page.getByRole('button', { name: /Buy list 0[1-9]/ })).toBeVisible();

  await page.goto('/#/concepts/catio/window-insert');
  const parts = page.getByRole('region', { name: 'Parts list' });
  await expect(parts.getByRole('columnheader', { name: 'Buy' }).first()).toBeVisible();
  await expect(parts.getByRole('link', { name: /Search amazon\.de|amazon\.de/ }).first()).toHaveAttribute('rel', 'sponsored noopener');
  await parts.screenshot({ path: testInfo.outputPath('catio-parts.png') });
  await parts.getByRole('button', { name: 'Add all hardware to buy list' }).click();
  await page.goto('/#/buy-list');
  await expect(page.getByRole('link', { name: 'Cigarette case (Onz)' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Catio: / }).first()).toBeVisible();
});
