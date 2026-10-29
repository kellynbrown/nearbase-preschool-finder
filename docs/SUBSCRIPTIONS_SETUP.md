# Turn on NearBase subscriptions

The site already has the pages and the Netlify functions. Until you add keys, every subscribe button falls back to the waitlist and search still works. Nothing secret belongs in git.

Do these in order. Use Stripe **test mode** until a test card finishes a checkout.

## 1. Stripe

1. Create a Stripe account and stay in test mode.
2. Copy the test secret key. It starts with `sk_test_`.
3. On your computer, from this repo:

   ```bash
   STRIPE_SECRET_KEY=sk_test_... node scripts/create-stripe-prices.mjs
   ```

   The script creates Premium at $3/month and the weekly pass at $1/week. It prints lines like `STRIPE_PRICE_MONTHLY=price_...`.

4. In Netlify, set these environment variables. Do not paste them into the repo.

   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRICE_MONTHLY`
   - `STRIPE_PRICE_WEEKLY`

5. Add a webhook endpoint in Stripe, still in test mode:

   `https://nearbase.net/.netlify/functions/stripe-webhook`

   Send these events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

6. Copy the webhook signing secret (`whsec_...`) into Netlify as `STRIPE_WEBHOOK_SECRET`.

7. In Stripe, open Settings → Billing → Customer portal and turn it on so families can cancel or change a card. Cancel anytime is the promise on the page.

To change a price later, edit the cents in `netlify/functions/lib/catalog.mjs` and the dollar label in `site/billing-config.js`, run the script again, and replace that price’s env var.

## 2. Supabase

1. Create a free Supabase project.
2. Open the SQL editor and run `supabase/schema.sql`.
3. Under Authentication → Providers, keep email on. Turn off passwords if the form offers them. NearBase uses a magic link only.
4. Under Authentication → URL configuration, set the site URL to `https://nearbase.net` and add this redirect:

   `https://nearbase.net/account.html`

5. Copy the project URL and the **anon** public key. In Netlify set:

   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

   You can instead paste those two into `site/billing-config.js`. The anon key is public by design.

6. Copy the **service role** key into Netlify as `SUPABASE_SERVICE_ROLE_KEY`. That key bypasses row security. It stays in Netlify only. The webhook uses it to record a subscription. Families never receive it.

Row security lets a signed-in family read and update only their own rows.

The same script creates `public.waitlist_entries`. That table is the free waitlist tracker. Any signed-in family can use it. Premium is not required. Each row stores the school, dates, fees the family paid, status, notes, the process they copied from the school, a follow-up date, and contacts. Policies allow `select`, `insert`, `update`, and `delete` only where `user_id = auth.uid()`. There is no policy for a school, and no shared or summary view. `preferences.pcs_date` is the family’s PCS move date, used only to flag a desired start that falls after the move.

If this project already ran an older `schema.sql`, run the file again. `create table if not exists` and `add column if not exists` keep the existing rows and add the tracker table and `pcs_date`.

## 3. Redeploy

Redeploy the site after the env vars are saved. Then, in test mode:

1. Open the account page, ask for a magic link, and sign in without paying. The waitlist tracker is there on the free account.
2. Open Premium and subscribe with Stripe’s test card `4242 4242 4242 4242`.
3. Open the account page from the email link and confirm the plan shows. The tracker stays available.
4. Use Manage billing to open the customer portal.

## 4. Go live

When the test purchase looks right, switch Stripe to live mode, run:

```bash
STRIPE_SECRET_KEY=sk_live_... node scripts/create-stripe-prices.mjs --live
```

Replace the Netlify price ids and `STRIPE_SECRET_KEY` with the live values. Create the webhook again in live mode and replace `STRIPE_WEBHOOK_SECRET`. Supabase does not have a separate test project unless you made one. Use the same project, or a second project if you want test sign-ins kept apart.

Pay-it-forward check-ins stay anonymous. They are not linked to these accounts.
