# Extra help add-ons (shelved)

Kelly asked to set these aside. They are not on the site. Restore them by putting the pieces below back, then run `node scripts/create-stripe-prices.mjs` and set the new price env vars.

## What it was

Four optional purchases on the Premium page, under an “Extra help” section. Draft prices:

| SKU | Name | Price | Stripe mode |
| --- | --- | --- | --- |
| `consult` | PCS move consult call | $25 once | `payment` (30 minutes, booking note after checkout) |
| `concierge` | Waitlist concierge | $10/mo | `subscription` (up to 5 schools) |
| `shortlist` | Personalized school shortlist | $15 once | `payment` (email within 3 business days) |
| `tourkit` | School tour question kit | $5 once | `payment` (instant printable page) |

Checkout used the same `create-checkout-session` function as Premium. One-time buys were stored in `public.orders`. A hidden Netlify form named `addon-request` notified kelly@nearbase.net. The printable kit was `site/tour-kit.html`.

## Catalog entries

Add these keys back to `CATALOG` in `netlify/functions/lib/catalog.mjs` and to `window.NB_OFFERS` in `site/billing-config.js` (`amount` is cents; `amountCents` matches it).

```javascript
consult: { sku: "consult", env: "STRIPE_PRICE_CONSULT", name: "PCS move consult call", amount: 2500, mode: "payment", interval: null, draft: true },
concierge: { sku: "concierge", env: "STRIPE_PRICE_CONCIERGE", name: "Waitlist concierge", amount: 1000, mode: "subscription", interval: "month", draft: true },
shortlist: { sku: "shortlist", env: "STRIPE_PRICE_SHORTLIST", name: "Personalized school shortlist", amount: 1500, mode: "payment", interval: null, draft: true },
tourkit: { sku: "tourkit", env: "STRIPE_PRICE_TOURKIT", name: "School tour question kit", amount: 500, mode: "payment", interval: null, draft: true }
```

`scripts/create-stripe-prices.mjs` already loops `CATALOG`, so these prices are created again once the keys are restored. Env vars: `STRIPE_PRICE_CONSULT`, `STRIPE_PRICE_CONCIERGE`, `STRIPE_PRICE_SHORTLIST`, `STRIPE_PRICE_TOURKIT`.

## Checkout and webhook

`applyStripeEvent` in `netlify/functions/lib/stripe.mjs` should, on `checkout.session.completed`, keep writing subscriptions for `mode: "subscription"`, and for any other known SKU call `store.insertOrder`. That helper lived on `supabaseStore` in `netlify/functions/lib/supabase-admin.mjs` and POSTed to `orders?on_conflict=stripe_session_id`.

`orderRowFromCheckout(session)` returned `{ email, sku, stripe_customer_id, stripe_session_id, status: "paid" }`.

Buttons on `premium.html` used `data-nb-checkout="consult"` (and the other SKUs) with `href="#waitlist"`, so they fell back to the waitlist when Stripe was off. `site/account.js` `checkout(sku)` already posts whatever SKU it is given.

## Account page and the form

After checkout, `account.html` showed a follow-up for `consult` (times that work), `shortlist` (bases, hours, budget), and `tourkit` (link to `/tour-kit.html`). A “Purchased services” card listed `orders`. The signed-in loader also queried `sb.from("orders")`.

Notify Kelly with a Netlify form in both `premium.html` and `account.html`:

```html
<form name="addon-request" method="POST" action="/thanks.html" data-netlify="true" hidden>
  <input type="hidden" name="form-name" value="addon-request">
  <input name="email">
  <input name="service">
  <input name="stripe_session">
  <textarea name="notes"></textarea>
</form>
```

`notifyOrder()` in `site/account.js` posted that form once when `?checkout=success` was in the URL.

## Orders table

```sql
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  email text not null default '',
  sku text not null,
  status text not null default 'paid',
  stripe_customer_id text,
  stripe_session_id text unique,
  created_at timestamptz not null default now()
);
alter table public.orders enable row level security;
create policy "read own orders" on public.orders
  for select using (
    user_id = auth.uid()
    or email = (select email from public.profiles where id = auth.uid())
  );
```

The service role writes rows. Families only read their own.

## Tour kit

`site/tour-kit.html` was a print stylesheet page, linked from the sitemap. Sections:

1. The room (materials children can reach, work cycle, mixed ages, what a teacher does when a child is concentrating, rest, the room at 7:30am and 5:30pm).
2. The day (drop-off through pickup, outdoors and bad weather, a new or shy child, practical life, disagreements, the posted rhythm).
3. Hours (earliest drop-off, latest pickup, half day vs school day vs full day, late duty, closed days, adding early care later).
4. Cost, fee assistance, and MCCYN (tuition and extras, who files MCCYN, discount vs MCCYN, orders or deployment mid-year, free or sliding scale, a written fee page).
5. PCS and the waitlist (mid-year start, whether waitlist time transfers, siblings, what to bring from orders, records for the next school, EFMP).
6. Before you say yes (children actually working, hours in writing, the fee named out loud, off-cycle enrollment).

Privacy mentioned “extra services you bought.” Add that phrase back to the family-accounts paragraph if the orders table returns.

## Anonymous wait-time survey (not built)

Reserved for Extra help. This survey is not built, and it is not part of the free waitlist tracker.

The tracker stays private. A later Extra help feature could ask families to opt in to an anonymous wait-time survey. A family would choose to contribute a school and a wait range after the fact. The contribution would not include the family account, name, email, child, or any protected-class detail. Results would be published only as aggregate ranges, and only after a minimum number of contributions for that school so a single family cannot be picked out. Schools would not receive the raw answers, and the survey would not filter or rank families.

Until that exists, NearBase does not collect crowd-sourced wait times and does not show aggregate wait stats.
