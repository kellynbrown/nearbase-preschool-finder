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

   The script creates Premium at $3/month, the weekly pass at $1/week, and the draft add-ons (consult $25, waitlist concierge $10/month, shortlist $15, tour kit $5). It prints lines like `STRIPE_PRICE_MONTHLY=price_...`.

4. In Netlify, set these environment variables. Do not paste them into the repo.

   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRICE_MONTHLY`
   - `STRIPE_PRICE_WEEKLY`
   - `STRIPE_PRICE_CONSULT`
   - `STRIPE_PRICE_CONCIERGE`
   - `STRIPE_PRICE_SHORTLIST`
   - `STRIPE_PRICE_TOURKIT`

5. Add a webhook endpoint in Stripe, still in test mode:

   `https://nearbase.net/.netlify/functions/stripe-webhook`

   Send these events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

6. Copy the webhook signing secret (`whsec_...`) into Netlify as `STRIPE_WEBHOOK_SECRET`.

7. In Stripe, open Settings → Billing → Customer portal and turn it on so families can cancel or change a card. Cancel anytime is the promise on the page.

Add-on prices are drafts. To change one, edit the cents in `netlify/functions/lib/catalog.mjs` and the dollar label in `site/billing-config.js`, run the script again, and replace that price’s env var.

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

## 3. Mail when someone buys extra help

Premium and the account page include a Netlify form named `addon-request`. In Netlify Forms, turn on email notification to `kelly@nearbase.net`. A completed checkout also stores the order in Supabase.

The tour kit itself is `https://nearbase.net/tour-kit.html`. Checkout sends the buyer there.

## 4. Redeploy

Redeploy the site after the env vars are saved. Then, in test mode:

1. Open Premium and subscribe with Stripe’s test card `4242 4242 4242 4242`.
2. Open the account page from the email link and confirm the plan shows.
3. Use Manage billing to open the customer portal.
4. Buy the tour kit and confirm the printable page opens.

## 5. Go live

When the test purchase looks right, switch Stripe to live mode, run:

```bash
STRIPE_SECRET_KEY=sk_live_... node scripts/create-stripe-prices.mjs --live
```

Replace the Netlify price ids and `STRIPE_SECRET_KEY` with the live values. Create the webhook again in live mode and replace `STRIPE_WEBHOOK_SECRET`. Supabase does not have a separate test project unless you made one. Use the same project, or a second project if you want test sign-ins kept apart.

Pay-it-forward check-ins stay anonymous. They are not linked to these accounts.
