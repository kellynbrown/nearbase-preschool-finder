// Public billing settings. Leave the Supabase fields blank until Kelly
// adds a project. The anon key is safe to put here; it is not a secret.
// Netlify can also supply the same two values through the public-config
// function (SUPABASE_URL and SUPABASE_ANON_KEY). Either path works.
//
// DRAFT add-on prices live in NB_OFFERS. Kelly has not locked them.
// If you change a dollar amount, change the matching cents in
// netlify/functions/lib/catalog.mjs and recreate the Stripe price.
window.NB_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: ""
};

window.NB_OFFERS = {
  monthly: { sku: "monthly", label: "Premium", priceLabel: "$3/mo", amountCents: 300, draft: false },
  weekly: { sku: "weekly", label: "Weekly pass", priceLabel: "$1/week", amountCents: 100, draft: false },
  consult: { sku: "consult", label: "PCS move consult call", priceLabel: "$25", amountCents: 2500, draft: true },
  concierge: { sku: "concierge", label: "Waitlist concierge", priceLabel: "$10/mo", amountCents: 1000, draft: true },
  shortlist: { sku: "shortlist", label: "Personalized school shortlist", priceLabel: "$15", amountCents: 1500, draft: true },
  tourkit: { sku: "tourkit", label: "School tour question kit", priceLabel: "$5", amountCents: 500, draft: true }
};
