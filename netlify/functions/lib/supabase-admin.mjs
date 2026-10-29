export function supabaseReady(env) {
  return !!(env && String(env.SUPABASE_URL || "").trim() && String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim());
}

export function supabaseStore(env, fetchImpl) {
  const base = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const doFetch = fetchImpl || fetch;

  async function rest(path, options) {
    const headers = {
      apikey: key,
      authorization: "Bearer " + key,
      "content-type": "application/json",
      prefer: (options && options.prefer) || "return=minimal"
    };
    const response = await doFetch(base + "/rest/v1/" + path, {
      method: (options && options.method) || "GET",
      headers: headers,
      body: options && options.body != null ? JSON.stringify(options.body) : undefined
    });
    if (!response.ok) {
      const detail = await response.text();
      const error = new Error("supabase " + response.status);
      error.detail = detail.slice(0, 240);
      throw error;
    }
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text);
  }

  return {
    async upsertSubscription(row) {
      const clean = {
        email: row.email || "",
        plan: row.plan || "",
        status: row.status || "",
        stripe_customer_id: row.stripe_customer_id || null,
        stripe_subscription_id: row.stripe_subscription_id,
        current_period_end: row.current_period_end || null,
        updated_at: new Date().toISOString()
      };
      if (clean.email) {
        const profiles = await rest("profiles?select=id,email&email=eq." + encodeURIComponent(clean.email));
        if (profiles && profiles[0]) clean.user_id = profiles[0].id;
      }
      await rest("subscriptions?on_conflict=stripe_subscription_id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: clean
      });
    },
    async insertOrder(row) {
      const clean = {
        email: row.email || "",
        sku: row.sku,
        status: row.status || "paid",
        stripe_customer_id: row.stripe_customer_id || null,
        stripe_session_id: row.stripe_session_id,
        created_at: new Date().toISOString()
      };
      if (clean.email) {
        const profiles = await rest("profiles?select=id,email&email=eq." + encodeURIComponent(clean.email));
        if (profiles && profiles[0]) clean.user_id = profiles[0].id;
      }
      await rest("orders?on_conflict=stripe_session_id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: clean
      });
    },
    async customerIdForEmail(email) {
      const rows = await rest("subscriptions?select=stripe_customer_id,email&email=eq." + encodeURIComponent(email) + "&stripe_customer_id=not.is.null&limit=1");
      return rows && rows[0] && rows[0].stripe_customer_id;
    },
    async userFromToken(token, anonKey) {
      const response = await doFetch(base + "/auth/v1/user", {
        headers: {
          apikey: anonKey || key,
          authorization: "Bearer " + token
        }
      });
      if (!response.ok) return null;
      return response.json();
    },
    async deleteUser(userId) {
      const response = await doFetch(base + "/auth/v1/admin/users/" + userId, {
        method: "DELETE",
        headers: {
          apikey: key,
          authorization: "Bearer " + key
        }
      });
      if (!response.ok && response.status !== 404) {
        const detail = await response.text();
        const error = new Error("delete user " + response.status);
        error.detail = detail.slice(0, 240);
        throw error;
      }
    }
  };
}
