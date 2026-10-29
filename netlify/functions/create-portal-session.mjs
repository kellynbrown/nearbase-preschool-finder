import { json, paymentsReady, siteOrigin, stripeForm } from "./lib/stripe.mjs";
import { supabaseReady, supabaseStore } from "./lib/supabase-admin.mjs";

export function createPortalHandler(env, fetchImpl) {
  return async function handler(request) {
    if (request.method !== "POST") return json(405, { ok: false, error: "method" });
    if (!paymentsReady(env) || !supabaseReady(env)) {
      return json(503, { ok: false, fallback: true, reason: "billing_not_configured" });
    }
    const header = request.headers.get("authorization") || "";
    const token = header.replace(/^Bearer\s+/i, "").trim();
    if (!token || token === header) return json(401, { ok: false, error: "sign_in_required" });
    const store = supabaseStore(env, fetchImpl);
    const user = await store.userFromToken(token, env.SUPABASE_ANON_KEY);
    if (!user || !user.email) return json(401, { ok: false, error: "sign_in_required" });
    const customer = await store.customerIdForEmail(user.email);
    if (!customer) return json(404, { ok: false, fallback: true, reason: "no_subscription" });
    const body = new URLSearchParams();
    body.set("customer", customer);
    body.set("return_url", siteOrigin(request) + "/account.html");
    const result = await stripeForm(env, "/v1/billing_portal/sessions", body.toString(), fetchImpl);
    if (!result.ok || !result.data || !result.data.url) {
      return json(502, { ok: false, fallback: true, reason: "stripe_error" });
    }
    return json(200, { ok: true, url: result.data.url });
  };
}

export default createPortalHandler(process.env, fetch);
