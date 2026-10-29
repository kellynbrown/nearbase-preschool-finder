// Public billing settings. Leave the Supabase fields blank until Kelly
// adds a project. The anon key is safe to put here; it is not a secret.
// Netlify can also supply the same two values through the public-config
// function (SUPABASE_URL and SUPABASE_ANON_KEY). Either path works.
//
// Plan labels. Amounts in cents match netlify/functions/lib/catalog.mjs.
window.NB_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: ""
};

window.NB_OFFERS = {
  monthly: { sku: "monthly", label: "Premium", priceLabel: "$3/mo", amountCents: 300, draft: false },
  weekly: { sku: "weekly", label: "Weekly pass", priceLabel: "$1/week", amountCents: 100, draft: false }
};
