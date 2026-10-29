// Prices NearBase sells: Premium and the weekly pass.
// To change one, edit `amount` (cents) here and the label in
// site/billing-config.js, run node scripts/create-stripe-prices.mjs,
// and put the printed price id in the Netlify env var named here.

export const CATALOG = {
  monthly: {
    sku: "monthly",
    env: "STRIPE_PRICE_MONTHLY",
    name: "NearBase Premium",
    description: "Full family access. Cancel anytime.",
    amount: 300,
    currency: "usd",
    mode: "subscription",
    interval: "month",
    draft: false
  },
  weekly: {
    sku: "weekly",
    env: "STRIPE_PRICE_WEEKLY",
    name: "NearBase weekly pass",
    description: "Full family access for a week. Cancel anytime.",
    amount: 100,
    currency: "usd",
    mode: "subscription",
    interval: "week",
    draft: false
  }
};

export function offerBySku(sku) {
  return CATALOG[sku] || null;
}

export function priceIdFor(sku, env) {
  const offer = offerBySku(sku);
  if (!offer) return "";
  return String((env && env[offer.env]) || "").trim();
}
