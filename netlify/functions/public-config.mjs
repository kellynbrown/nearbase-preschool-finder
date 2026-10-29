import { json, paymentsReady } from "./lib/stripe.mjs";

export function publicConfig(env) {
  const supabaseUrl = String((env && env.SUPABASE_URL) || "").trim();
  const supabaseAnonKey = String((env && env.SUPABASE_ANON_KEY) || "").trim();
  return {
    configured: !!(supabaseUrl && supabaseAnonKey),
    payments: paymentsReady(env),
    supabaseUrl: supabaseUrl,
    supabaseAnonKey: supabaseAnonKey
  };
}

export function createPublicConfigHandler(env) {
  return async function handler() {
    return json(200, publicConfig(env));
  };
}

export default createPublicConfigHandler(process.env);
