#!/usr/bin/env node
var assert = require("assert");
var crypto = require("crypto");
var path = require("path");
var fs = require("fs");

var root = path.join(__dirname, "..");

async function load() {
  var catalog = await import(pathToFile(path.join(root, "netlify/functions/lib/catalog.mjs")));
  var stripe = await import(pathToFile(path.join(root, "netlify/functions/lib/stripe.mjs")));
  var checkout = await import(pathToFile(path.join(root, "netlify/functions/create-checkout-session.mjs")));
  var webhook = await import(pathToFile(path.join(root, "netlify/functions/stripe-webhook.mjs")));
  var portal = await import(pathToFile(path.join(root, "netlify/functions/create-portal-session.mjs")));
  var config = await import(pathToFile(path.join(root, "netlify/functions/public-config.mjs")));
  var remove = await import(pathToFile(path.join(root, "netlify/functions/delete-account.mjs")));
  return { catalog: catalog, stripe: stripe, checkout: checkout, webhook: webhook, portal: portal, config: config, remove: remove };
}

function pathToFile(file) {
  return "file://" + file;
}

function request(url, options) {
  return new Request(url, options || {});
}

var failures = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () {
    console.log("ok  " + name);
  }).catch(function (err) {
    failures++;
    console.error("FAIL " + name);
    console.error("     " + err.message);
  });
}

load().then(function (api) {
  var jobs = [];

  jobs.push(check("catalog prices match the public offer labels", function () {
    assert.strictEqual(api.catalog.CATALOG.monthly.amount, 300);
    assert.strictEqual(api.catalog.CATALOG.weekly.amount, 100);
    assert.strictEqual(api.catalog.CATALOG.consult.amount, 2500);
    assert.strictEqual(api.catalog.CATALOG.consult.draft, true);
    assert.strictEqual(api.catalog.CATALOG.concierge.draft, true);
    assert.strictEqual(api.catalog.CATALOG.monthly.draft, false);
    var config = fs.readFileSync(path.join(root, "site/billing-config.js"), "utf8");
    Object.keys(api.catalog.CATALOG).forEach(function (sku) {
      assert.ok(config.indexOf("amountCents: " + api.catalog.CATALOG[sku].amount) !== -1, sku);
    });
    assert.ok(config.indexOf('supabaseUrl: ""') !== -1);
    assert.ok(!/sk_live_|sk_test_|service_role/i.test(config));
  }));

  jobs.push(check("checkout falls back when Stripe is not configured", function () {
    var handler = api.checkout.createCheckoutHandler({}, fetch);
    return handler(request("https://nearbase.net/.netlify/functions/create-checkout-session", {
      method: "POST",
      body: JSON.stringify({ sku: "monthly" })
    })).then(function (response) {
      assert.strictEqual(response.status, 503);
      return response.json();
    }).then(function (body) {
      assert.strictEqual(body.fallback, true);
    });
  }));

  jobs.push(check("checkout asks Stripe for the monthly test price", function () {
    var seen = {};
    function fakeFetch(url, options) {
      seen.url = url;
      seen.body = options.body;
      return Promise.resolve(new Response(JSON.stringify({ id: "cs_test", url: "https://checkout.stripe.com/c/pay/cs_test" }), { status: 200 }));
    }
    var handler = api.checkout.createCheckoutHandler({
      STRIPE_SECRET_KEY: "sk_test_example",
      STRIPE_PRICE_MONTHLY: "price_monthly"
    }, fakeFetch);
    return handler(request("https://nearbase.net/.netlify/functions/create-checkout-session", {
      method: "POST",
      headers: { host: "nearbase.net", "x-forwarded-proto": "https" },
      body: JSON.stringify({ sku: "monthly", email: "family@example.com" })
    })).then(function (response) {
      assert.strictEqual(response.status, 200);
      assert.ok(seen.url.indexOf("/v1/checkout/sessions") !== -1);
      assert.ok(seen.body.indexOf("price_monthly") !== -1);
      assert.ok(seen.body.indexOf("mode=subscription") !== -1);
      assert.ok(seen.body.indexOf("family%40example.com") !== -1);
      assert.ok(seen.body.indexOf("sk_test") === -1);
    });
  }));

  jobs.push(check("unknown add-on sku is rejected", function () {
    var handler = api.checkout.createCheckoutHandler({ STRIPE_SECRET_KEY: "sk_test_example" }, fetch);
    return handler(request("https://nearbase.net/", {
      method: "POST",
      body: JSON.stringify({ sku: "presence" })
    })).then(function (response) {
      assert.strictEqual(response.status, 400);
    });
  }));

  jobs.push(check("webhook rejects a bad signature and accepts a good one", function () {
    var secret = "whsec_test_secret";
    var payload = JSON.stringify({
      type: "checkout.session.completed",
      data: { object: {
        id: "cs_1",
        mode: "payment",
        customer: "cus_1",
        customer_email: "family@example.com",
        metadata: { sku: "tourkit" }
      } }
    });
    var stamp = String(Math.floor(Date.now() / 1000));
    var good = crypto.createHmac("sha256", secret).update(stamp + "." + payload).digest("hex");
    var bad = api.stripe.verifyStripeSignature(payload, "t=" + stamp + ",v1=deadbeef", secret, 999999999, 1700000000);
    assert.strictEqual(bad.ok, false);
    var ok = api.stripe.verifyStripeSignature(payload, "t=" + stamp + ",v1=" + good, secret, 999999999, 1700000000);
    assert.strictEqual(ok.ok, true);

    var saved = [];
    function fakeFetch() {
      return Promise.resolve(new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
    }
    var storeEnv = {
      STRIPE_WEBHOOK_SECRET: secret,
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test"
    };
    var original = api.webhook.createWebhookHandler;
    var handler = original(storeEnv, function (url, options) {
      saved.push({ url: url, options: options });
      if (String(url).indexOf("/auth/") !== -1) return Promise.resolve(new Response("{}", { status: 200 }));
      if (String(url).indexOf("profiles") !== -1) return Promise.resolve(new Response("[]", { status: 200 }));
      return Promise.resolve(new Response("", { status: 201 }));
    });
    return handler(request("https://nearbase.net/.netlify/functions/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=" + stamp + ",v1=nope" },
      body: payload
    })).then(function (response) {
      assert.strictEqual(response.status, 400);
      return handler(request("https://nearbase.net/.netlify/functions/stripe-webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=" + stamp + ",v1=" + good },
        body: payload
      }));
    }).then(function (response) {
      assert.strictEqual(response.status, 200);
      var orderCall = saved.filter(function (call) { return String(call.url).indexOf("/orders") !== -1; })[0];
      assert.ok(orderCall, "order was recorded");
      assert.ok(orderCall.options.body.indexOf("tourkit") !== -1);
      assert.ok(orderCall.options.headers.authorization.indexOf("service-role-test") !== -1);
    });
  }));

  jobs.push(check("subscription updates are stored by subscription id", async function () {
    var calls = [];
    var store = {
      upsertSubscription: function (row) { calls.push(row); return Promise.resolve(); },
      insertOrder: function () { throw new Error("not an order"); }
    };
    var result = await api.stripe.applyStripeEvent({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1", customer: "cus_1", status: "active", metadata: { sku: "monthly", email: "family@example.com" } } }
    }, store);
    assert.strictEqual(result.handled, true);
    assert.strictEqual(calls[0].status, "canceled");
    assert.strictEqual(calls[0].stripe_subscription_id, "sub_1");
  }));

  jobs.push(check("public config hides secrets and reports an unconfigured site", function () {
    var body = api.config.publicConfig({
      STRIPE_SECRET_KEY: "sk_test_hidden",
      STRIPE_WEBHOOK_SECRET: "whsec_hidden",
      SUPABASE_SERVICE_ROLE_KEY: "service-hidden"
    });
    assert.strictEqual(body.configured, false);
    assert.strictEqual(body.payments, true);
    assert.strictEqual(body.supabaseUrl, "");
    var text = JSON.stringify(body);
    assert.ok(text.indexOf("sk_test_hidden") === -1);
    assert.ok(text.indexOf("service-hidden") === -1);
    assert.ok(text.indexOf("whsec_hidden") === -1);
    var ready = api.config.publicConfig({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-public"
    });
    assert.strictEqual(ready.configured, true);
    assert.strictEqual(ready.payments, false);
    assert.strictEqual(ready.supabaseAnonKey, "anon-public");
  }));

  jobs.push(check("portal and delete-account refuse to run without keys", function () {
    var portal = api.portal.createPortalHandler({}, fetch);
    var remove = api.remove.createDeleteAccountHandler({}, fetch);
    return portal(request("https://nearbase.net/", { method: "POST" })).then(function (response) {
      assert.strictEqual(response.status, 503);
      return remove(request("https://nearbase.net/", { method: "POST", headers: { authorization: "Bearer token" } }));
    }).then(function (response) {
      assert.strictEqual(response.status, 503);
      return response.json();
    }).then(function (body) {
      assert.strictEqual(body.fallback, true);
    });
  }));

  jobs.push(check("one-time consult uses payment mode and the draft amount", function () {
    var built = api.stripe.checkoutForm("consult", { STRIPE_PRICE_CONSULT: "price_consult" }, "https://nearbase.net", "");
    assert.ok(built.body.indexOf("mode=payment") !== -1);
    assert.ok(built.body.indexOf("price_consult") !== -1);
    assert.strictEqual(api.catalog.CATALOG.consult.amount, 2500);
    assert.strictEqual(built.offer.draft, true);
  }));

  return Promise.all(jobs);
}).then(function () {
  if (failures) {
    console.error("\n" + failures + " failed");
    process.exit(1);
  }
  console.log("\nAll billing checks passed.");
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
