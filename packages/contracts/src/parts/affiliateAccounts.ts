import type { Market } from './offers.ts';

/**
 * The affiliate accounts Canfactory's links carry: the Amazon tracking id (store id) per market and the Awin publisher id. They are
 * public (every link shows them), so they live here rather than in a secret. A `null` account turns that network off: its offers
 * are not shown, and with every account `null` no affiliate link appears anywhere.
 */
export interface AffiliateAccounts {
  amazon: Record<Market, string | null>;
  awin: { publisherId: number | null };
}
export const AFFILIATE_ACCOUNTS: AffiliateAccounts = { amazon: { DE: null, US: null }, awin: { publisherId: null } };
