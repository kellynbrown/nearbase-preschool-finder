import { applyStripeEvent, json, verifyStripeSignature } from "./lib/stripe.mjs";
import { supabaseReady, supabaseStore } from "./lib/supabase-admin.mjs";

export function createWebhookHandler(env, fetchImpl) {
  return async function handler(request) {
    if (request.method !== "POST") return json(405, { ok: false, error: "method" });
    const secret = String((env && env.STRIPE_WEBHOOK_SECRET) || "").trim();
    if (!secret) return json(503, { ok: false, fallback: true, reason: "webhook_not_configured" });
    const raw = await request.text();
    const header = request.headers.get("stripe-signature") || "";
    const check = verifyStripeSignature(raw, header, secret);
    if (!check.ok) return json(400, { ok: false, error: "bad_signature", reason: check.reason });
    let event;
    try { event = JSON.parse(raw); } catch (e) { return json(400, { ok: false, error: "bad_json" }); }
    if (!supabaseReady(env)) return json(503, { ok: false, fallback: true, reason: "supabase_not_configured" });
    const store = supabaseStore(env, fetchImpl);
    const result = await applyStripeEvent(event, store);
    return json(200, { ok: true, received: true, handled: !!result.handled, kind: result.kind || "" });
  };
}

export default createWebhookHandler(process.env, fetch);
