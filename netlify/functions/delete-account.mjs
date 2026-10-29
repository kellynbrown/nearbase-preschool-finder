import { json } from "./lib/stripe.mjs";
import { supabaseReady, supabaseStore } from "./lib/supabase-admin.mjs";

export function createDeleteAccountHandler(env, fetchImpl) {
  return async function handler(request) {
    if (request.method !== "POST") return json(405, { ok: false, error: "method" });
    if (!supabaseReady(env)) return json(503, { ok: false, fallback: true, reason: "supabase_not_configured" });
    const header = request.headers.get("authorization") || "";
    const token = header.replace(/^Bearer\s+/i, "").trim();
    if (!token || token === header) return json(401, { ok: false, error: "sign_in_required" });
    const store = supabaseStore(env, fetchImpl);
    const user = await store.userFromToken(token, env.SUPABASE_ANON_KEY);
    if (!user || !user.id) return json(401, { ok: false, error: "sign_in_required" });
    await store.deleteUser(user.id);
    return json(200, { ok: true, deleted: true });
  };
}

export default createDeleteAccountHandler(process.env, fetch);
