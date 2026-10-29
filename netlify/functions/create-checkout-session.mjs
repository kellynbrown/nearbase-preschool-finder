import { checkoutForm, json, paymentsReady, siteOrigin, stripeForm } from "./lib/stripe.mjs";

export function createCheckoutHandler(env, fetchImpl) {
  return async function handler(request) {
    if (request.method !== "POST") return json(405, { ok: false, error: "method" });
    if (!paymentsReady(env)) return json(503, { ok: false, fallback: true, reason: "payments_not_configured" });
    let payload = {};
    try { payload = await request.json(); } catch (e) { payload = {}; }
    const sku = String(payload.sku || "").trim();
    const email = String(payload.email || "").trim();
    const built = checkoutForm(sku, env, siteOrigin(request), email);
    if (built.error === "unknown_sku") return json(400, { ok: false, error: "unknown_sku" });
    if (built.error) return json(503, { ok: false, fallback: true, reason: built.error });
    const result = await stripeForm(env, "/v1/checkout/sessions", built.body, fetchImpl);
    if (!result.ok || !result.data || !result.data.url) {
      return json(502, { ok: false, fallback: true, reason: "stripe_error" });
    }
    return json(200, { ok: true, url: result.data.url, id: result.data.id || "" });
  };
}

export default createCheckoutHandler(process.env, fetch);
