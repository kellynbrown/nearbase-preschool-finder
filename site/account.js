// Family sign-in, saved profile, and checkout.
// If Stripe or Supabase is not configured, every button falls back
// to the waitlist or the on-device save. Nothing here should throw
// into the console for that expected case.
(function () {
  var state = {
    configured: false,
    payments: false,
    config: { supabaseUrl: "", supabaseAnonKey: "" },
    client: null,
    session: null
  };

  function localConfig() {
    return window.NB_CONFIG || { supabaseUrl: "", supabaseAnonKey: "" };
  }

  function loadConfig() {
    var local = localConfig();
    return fetch("/.netlify/functions/public-config", { headers: { accept: "application/json" } })
      .then(function (response) { return response.ok ? response.json() : {}; })
      .catch(function () { return {}; })
      .then(function (remote) {
        var url = String(local.supabaseUrl || remote.supabaseUrl || "").trim();
        var key = String(local.supabaseAnonKey || remote.supabaseAnonKey || "").trim();
        state.configured = !!(url && key);
        state.payments = !!remote.payments;
        state.config = { supabaseUrl: url, supabaseAnonKey: key };
        window.__nbAuthConfigured = state.configured;
        window.__nbPayments = state.payments;
        return state;
      });
  }

  function loadSdk() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/dist/umd/supabase.js";
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error("sdk")); };
      document.head.appendChild(script);
    });
  }

  function client() {
    if (!state.configured) return Promise.resolve(null);
    if (state.client) return Promise.resolve(state.client);
    return loadSdk().then(function () {
      state.client = window.supabase.createClient(state.config.supabaseUrl, state.config.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      return state.client;
    }).catch(function () {
      state.configured = false;
      window.__nbAuthConfigured = false;
      return null;
    });
  }

  function refreshSession() {
    return client().then(function (sb) {
      if (!sb) { state.session = null; return null; }
      return sb.auth.getSession().then(function (result) {
        state.session = result && result.data ? result.data.session : null;
        return state.session;
      });
    });
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; }
  }

  function currentProfile() {
    if (window.NearBaseMatch && document.getElementById("matchBase")) {
      return window.NearBaseMatch.normalizeProfile({
        baseId: document.getElementById("matchBase").value,
        ages: [].map.call(document.querySelectorAll('#matchPanel input[name="age"]:checked'), function (el) { return el.value; }),
        philosophies: [].map.call(document.querySelectorAll('#matchPanel input[name="philo"]:checked'), function (el) { return el.value; }),
        hours: document.getElementById("matchHours").value,
        timing: document.getElementById("matchTiming").value,
        mccyn: document.getElementById("matchMccyn").checked,
        subsidy: document.getElementById("matchSubsidy").checked,
        efmp: document.getElementById("matchEfmp").checked,
        quiz: (readJson("nb_family") || {}).quiz || null
      });
    }
    if (window.NearBaseMatch) return window.NearBaseMatch.normalizeProfile(readJson("nb_family") || {});
    return readJson("nb_family") || {};
  }

  function quizVotes() {
    if (window.quizState && window.quizState.votes) return window.quizState.votes;
    var saved = readJson("nb_quiz_votes");
    if (saved && saved.family && saved.family.votes) return saved.family.votes;
    return saved || {};
  }

  function preferenceRow(userId, profile, votes) {
    var alerts = readJson("nb_spot_alerts") || { enabled: false, slugs: [] };
    return {
      user_id: userId,
      base_id: profile.baseId || null,
      hours: profile.hours || null,
      cost_ceiling: profile.costCeiling || "any",
      ages: profile.ages || [],
      philosophies: profile.philosophies || [],
      mccyn: !!profile.mccyn,
      subsidy: !!profile.subsidy,
      efmp: !!profile.efmp,
      timing: profile.timing || null,
      quiz_votes: votes || {},
      spot_alerts: alerts,
      updated_at: new Date().toISOString()
    };
  }

  function setStatus(id, message) {
    var el = document.getElementById(id);
    if (el) el.textContent = message;
  }

  function saveProfile(statusId) {
    var profile = currentProfile();
    var votes = quizVotes();
    try {
      if (window.NearBaseMatch) window.NearBaseMatch.saveProfile(profile);
      else localStorage.setItem("nb_family", JSON.stringify(profile));
      if (window.quizState && window.quizState.who && window.NearBaseMatch) {
        window.NearBaseMatch.saveQuiz(window.quizState.who, votes);
      }
    } catch (e) { /* private mode */ }
    if (!state.session) {
      setStatus(statusId || "saveProfileStatus", "Saved on this device. Sign in to keep it with your account.");
      return Promise.resolve({ local: true });
    }
    var row = preferenceRow(state.session.user.id, profile, votes);
    return client().then(function (sb) {
      return sb.from("preferences").upsert(row);
    }).then(function (result) {
      if (result && result.error) {
        setStatus(statusId || "saveProfileStatus", "Saved on this device. The account copy did not update.");
        return { local: true };
      }
      setStatus(statusId || "saveProfileStatus", "Saved to your profile.");
      return { remote: true };
    }).catch(function () {
      setStatus(statusId || "saveProfileStatus", "Saved on this device. The account copy did not update.");
      return { local: true };
    });
  }

  function saveSchool(button) {
    var slug = button.getAttribute("data-slug");
    var name = button.getAttribute("data-name") || slug;
    var list = readJson("nb_favorites") || [];
    if (!list.some(function (item) { return item.slug === slug; })) {
      list.push({ slug: slug, name: name });
      try { localStorage.setItem("nb_favorites", JSON.stringify(list)); } catch (e) {}
    }
    button.textContent = "Saved";
    if (!state.session) return;
    client().then(function (sb) {
      return sb.from("favorites").upsert({
        user_id: state.session.user.id,
        school_slug: slug,
        school_name: name
      }, { onConflict: "user_id,school_slug" });
    }).catch(function () {});
  }

  function checkout(sku) {
    if (!state.payments) {
      window.location.href = "/premium.html#waitlist";
      return Promise.resolve();
    }
    var email = state.session && state.session.user ? state.session.user.email : "";
    return fetch("/.netlify/functions/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sku: sku, email: email })
    }).then(function (response) { return response.json().catch(function () { return {}; }); })
      .then(function (data) {
        if (data && data.url) window.location.href = data.url;
        else window.location.href = "/premium.html#waitlist";
      }).catch(function () {
        window.location.href = "/premium.html#waitlist";
      });
  }

  function openPortal() {
    if (!state.session) {
      window.location.href = "/account.html";
      return;
    }
    fetch("/.netlify/functions/create-portal-session", {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: "Bearer " + state.session.access_token
      }
    }).then(function (response) { return response.json().catch(function () { return {}; }); })
      .then(function (data) {
        if (data && data.url) window.location.href = data.url;
        else setStatus("accountNotice", "Billing changes open after a subscription is on the account. Until then, email kelly@nearbase.net.");
      }).catch(function () {
        setStatus("accountNotice", "Billing changes open after a subscription is on the account. Until then, email kelly@nearbase.net.");
      });
  }

  function sendMagicLink(email) {
    return client().then(function (sb) {
      if (!sb) return { ok: false, reason: "Sign-in is not turned on yet." };
      return sb.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: window.location.origin + "/account.html" }
      }).then(function (result) {
        if (result.error) return { ok: false, reason: result.error.message };
        return { ok: true };
      });
    });
  }

  function signOut() {
    return client().then(function (sb) {
      if (!sb) return;
      return sb.auth.signOut();
    }).then(function () {
      state.session = null;
      window.location.href = "/account.html";
    });
  }

  function deleteAccount() {
    if (!state.session) return Promise.resolve();
    return fetch("/.netlify/functions/delete-account", {
      method: "POST",
      headers: { authorization: "Bearer " + state.session.access_token, accept: "application/json" }
    }).then(function (response) { return response.json().catch(function () { return {}; }); })
      .then(function (data) {
        if (data && data.deleted) return signOut();
        setStatus("accountNotice", "Email kelly@nearbase.net and ask to delete the account for " + state.session.user.email + ".");
      }).catch(function () {
        setStatus("accountNotice", "Email kelly@nearbase.net and ask to delete this account.");
      });
  }

  function wireCheckout() {
    document.querySelectorAll("[data-nb-checkout]").forEach(function (el) {
      el.addEventListener("click", function (event) {
        if (!state.payments) return;
        event.preventDefault();
        checkout(el.getAttribute("data-nb-checkout"));
      });
    });
  }

  function wireSignIn() {
    var button = document.getElementById("signInBtn");
    if (!button) return;
    if (state.session && state.session.user) {
      button.textContent = "Account";
      button.onclick = function () { window.location.href = "/account.html"; };
      return;
    }
    if (state.configured) {
      button.textContent = "Sign in";
      button.onclick = function () { window.location.href = "/account.html"; };
    }
  }

  function wireSave() {
    var profileBtn = document.getElementById("saveProfileBtn");
    if (profileBtn) profileBtn.addEventListener("click", function () { saveProfile("saveProfileStatus"); });
    var quizBtn = document.getElementById("saveQuizBtn");
    if (quizBtn) quizBtn.addEventListener("click", function () { saveProfile("saveQuizStatus"); });
    var list = document.getElementById("schoolList");
    if (list && !list.dataset.saveBound) {
      list.dataset.saveBound = "1";
      list.addEventListener("click", function (event) {
        var button = event.target.closest ? event.target.closest(".nb-save-school") : null;
        if (!button) return;
        event.stopPropagation();
        event.preventDefault();
        saveSchool(button);
      });
    }
  }

  function notifyOrder() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;
    var sku = params.get("sku") || "";
    var sessionId = params.get("session_id") || "";
    var key = "nb_notified_" + sessionId + sku;
    if (!sku || sessionStorage.getItem(key)) return;
    var email = state.session && state.session.user ? state.session.user.email : "";
    var body = new URLSearchParams();
    body.set("form-name", "addon-request");
    body.set("email", email);
    body.set("service", sku);
    body.set("stripe_session", sessionId);
    body.set("notes", "Checkout completed on nearbase.net");
    fetch("/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString()
    }).catch(function () {});
    try { sessionStorage.setItem(key, "1"); } catch (e) {}
  }

  function boot() {
    return loadConfig().then(refreshSession).then(function () {
      wireCheckout();
      wireSignIn();
      wireSave();
      notifyOrder();
      if (window.NearBaseAccountPage) window.NearBaseAccountPage.render(state);
    });
  }

  window.NearBaseAccount = {
    saveProfile: saveProfile,
    saveSchool: saveSchool,
    checkout: checkout,
    openPortal: openPortal,
    sendMagicLink: sendMagicLink,
    signOut: signOut,
    deleteAccount: deleteAccount,
    state: function () { return state; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { boot(); });
  else boot();
})();
