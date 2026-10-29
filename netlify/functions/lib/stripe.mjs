import { createHmac, timingSafeEqual } from "node:crypto";
import { offerBySku, priceIdFor } from "./catalog.mjs";

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

export function paymentsReady(env) {
  return !!(env && String(env.STRIPE_SECRET_KEY || "").trim());
}

export function siteOrigin(request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "nearbase.net";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return proto + "://" + host;
}

export function verifyStripeSignature(payload, header, secret, toleranceSec, nowSec) {
  const tolerance = toleranceSec == null ? 300 : toleranceSec;
  const now = nowSec == null ? Math.floor(Date.now() / 1000) : nowSec;
  if (!payload || !header || !secret) return { ok: false, reason: "missing" };
  const parts = {};
  String(header).split(",").forEach(function (piece) {
    const idx = piece.indexOf("=");
    if (idx < 1) return;
    const key = piece.slice(0, idx).trim();
    const value = piece.slice(idx + 1).trim();
    if (!parts[key]) parts[key] = [];
    parts[key].push(value);
  });
  const timestamp = parts.t && parts.t[0];
  const signatures = parts.v1 || [];
  if (!timestamp || !signatures.length) return { ok: false, reason: "malformed" };
  const stamp = Number(timestamp);
  if (!Number.isFinite(stamp) || Math.abs(now - stamp) > tolerance) return { ok: false, reason: "stale" };
  const expected = createHmac("sha256", secret).update(timestamp + "." + payload).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const match = signatures.some(function (sig) {
    const got = Buffer.from(sig, "utf8");
    if (got.length !== expectedBuf.length) return false;
    return timingSafeEqual(got, expectedBuf);
  });
  return match ? { ok: true } : { ok: false, reason: "mismatch" };
}

export function checkoutForm(sku, env, origin, email) {
  const offer = offerBySku(sku);
  if (!offer) return { error: "unknown_sku" };
  const price = priceIdFor(sku, env);
  if (!price) return { error: "price_not_configured" };
  const success = origin + "/account.html?checkout=success&sku=" + encodeURIComponent(sku) + "&session_id={CHECKOUT_SESSION_ID}";
  const cancel = origin + "/premium.html?checkout=cancel";
  const body = new URLSearchParams();
  body.set("mode", offer.mode);
  body.set("success_url", success);
  body.set("cancel_url", cancel);
  body.set("line_items[0][price]", price);
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[sku]", sku);
  body.set("allow_promotion_codes", "true");
  if (email) {
    body.set("customer_email", email);
    body.set("client_reference_id", email);
  }
  if (offer.mode === "subscription") {
    body.set("subscription_data[metadata][sku]", sku);
    if (email) body.set("subscription_data[metadata][email]", email);
  }
  return { body: body.toString(), offer: offer };
}

export async function stripeForm(env, path, formBody, fetchImpl) {
  const key = String(env.STRIPE_SECRET_KEY || "").trim();
  const doFetch = fetchImpl || fetch;
  const response = await doFetch("https://api.stripe.com" + path, {
    method: "POST",
    headers: {
      authorization: "Basic " + Buffer.from(key + ":").toString("base64"),
      "content-type": "application/x-www-form-urlencoded"
    },
    body: formBody
  });
  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch (e) { data = { raw: text.slice(0, 300) }; }
  return { ok: response.ok, status: response.status, data: data };
}

export function subscriptionRowFromCheckout(session) {
  const sku = (session.metadata && session.metadata.sku) || "";
  const email = session.customer_email || (session.customer_details && session.customer_details.email) || "";
  return {
    email: email,
    plan: sku,
    stripe_customer_id: session.customer || "",
    stripe_subscription_id: session.subscription || "",
    status: session.mode === "subscription" ? "active" : "paid"
  };
}

export function subscriptionRowFromSubscription(sub) {
  const meta = sub.metadata || {};
  const end = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
  return {
    email: meta.email || "",
    plan: meta.sku || "",
    stripe_customer_id: sub.customer || "",
    stripe_subscription_id: sub.id || "",
    status: sub.status || "canceled",
    current_period_end: end
  };
}

export async function applyStripeEvent(event, store) {
  const type = event && event.type;
  const object = event && event.data && event.data.object;
  if (!type || !object || !store) return { handled: false };
  if (type === "checkout.session.completed") {
    const sku = (object.metadata && object.metadata.sku) || "";
    const offer = offerBySku(sku);
    if (offer && offer.mode === "subscription" && object.subscription) {
      await store.upsertSubscription(subscriptionRowFromCheckout(object));
      return { handled: true, kind: "subscription", sku: sku };
    }
    return { handled: false };
  }
  if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
    const row = subscriptionRowFromSubscription(object);
    if (type === "customer.subscription.deleted") row.status = "canceled";
    if (row.stripe_subscription_id) await store.upsertSubscription(row);
    return { handled: true, kind: "subscription", sku: row.plan };
  }
  return { handled: false };
}
