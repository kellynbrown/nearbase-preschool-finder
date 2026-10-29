#!/usr/bin/env node
// Creates NearBase products and prices in Stripe.
// Test mode by default. Refuses a live secret key unless you pass --live.
//
//   STRIPE_SECRET_KEY=sk_test_... node scripts/create-stripe-prices.mjs
//
// Prints env lines to paste into Netlify. Does not write secrets to disk.

import { CATALOG } from "../netlify/functions/lib/catalog.mjs";

const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
const live = process.argv.includes("--live");

if (!key) {
  console.error("Set STRIPE_SECRET_KEY in the environment. Use a test key (sk_test_...) until you are ready for live charges.");
  process.exit(1);
}
if (key.startsWith("sk_live_") && !live) {
  console.error("That key is live. Re-run with --live only when you mean to create live prices.");
  process.exit(1);
}
if (!key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
  console.error("STRIPE_SECRET_KEY should start with sk_test_ or sk_live_.");
  process.exit(1);
}

async function stripe(path, body) {
  const response = await fetch("https://api.stripe.com" + path, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: "Basic " + Buffer.from(key + ":").toString("base64"),
      "content-type": "application/x-www-form-urlencoded"
    },
    body: body ? body.toString() : undefined
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error((data.error && data.error.message) || ("Stripe HTTP " + response.status));
  }
  return data;
}

function form(fields) {
  const body = new URLSearchParams();
  Object.keys(fields).forEach(function (name) {
    if (fields[name] != null && fields[name] !== "") body.set(name, String(fields[name]));
  });
  return body;
}

const products = await stripe("/v1/products?limit=100&active=true");
const bySku = {};
(products.data || []).forEach(function (product) {
  const sku = product.metadata && product.metadata.nb_sku;
  if (sku) bySku[sku] = product;
});

console.log(live ? "Creating LIVE prices." : "Creating TEST prices.");
console.log("Paste these into Netlify environment variables:\n");

for (const sku of Object.keys(CATALOG)) {
  const offer = CATALOG[sku];
  let product = bySku[sku];
  if (!product) {
    product = await stripe("/v1/products", form({
      name: offer.name,
      description: offer.description,
      "metadata[nb_sku]": sku
    }));
  }
  const priceFields = {
    product: product.id,
    unit_amount: offer.amount,
    currency: offer.currency,
    "metadata[nb_sku]": sku
  };
  if (offer.interval) priceFields["recurring[interval]"] = offer.interval;
  const price = await stripe("/v1/prices", form(priceFields));
  const draft = offer.draft ? "  # DRAFT add-on price" : "";
  console.log(offer.env + "=" + price.id + draft);
}

console.log("\nAlso set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET. Do not commit them.");
