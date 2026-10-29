// Prices NearBase sells.
// Premium and the weekly pass are set. Add-on amounts are DRAFTS.
// Kelly has not locked the add-on prices. To change one:
//   1. Edit `amount` (cents) on that row.
//   2. Edit the matching dollar label in site/billing-config.js.
//   3. Run: node scripts/create-stripe-prices.mjs
//   4. Put the printed price id in the Netlify env var named here.

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
  },
  consult: {
    sku: "consult",
    env: "STRIPE_PRICE_CONSULT",
    name: "PCS move consult call",
    description: "DRAFT price. A 30-minute call. Booking form after purchase.",
    amount: 2500,
    currency: "usd",
    mode: "payment",
    interval: null,
    draft: true
  },
  concierge: {
    sku: "concierge",
    env: "STRIPE_PRICE_CONCIERGE",
    name: "Waitlist concierge",
    description: "DRAFT price. We track and nudge waitlists for up to 5 schools.",
    amount: 1000,
    currency: "usd",
    mode: "subscription",
    interval: "month",
    draft: true
  },
  shortlist: {
    sku: "shortlist",
    env: "STRIPE_PRICE_SHORTLIST",
    name: "Personalized school shortlist",
    description: "DRAFT price. A written shortlist by email within 3 business days.",
    amount: 1500,
    currency: "usd",
    mode: "payment",
    interval: null,
    draft: true
  },
  tourkit: {
    sku: "tourkit",
    env: "STRIPE_PRICE_TOURKIT",
    name: "School tour question kit",
    description: "DRAFT price. Printable questions for a preschool tour.",
    amount: 500,
    currency: "usd",
    mode: "payment",
    interval: null,
    draft: true
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
