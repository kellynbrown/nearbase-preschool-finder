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
    var row = {
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
    var pcs = readPcsDate();
    if (pcs) row.pcs_date = pcs;
    return row;
  }

  function readPcsDate() {
    try {
      var value = localStorage.getItem("nb_pcs_date") || "";
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
    } catch (e) {
      return "";
    }
  }

  function readLocalEntries() {
    var Tracker = window.NearBaseTracker;
    var list = readJson("nb_waitlist");
    if (!Tracker || !Array.isArray(list)) return [];
    return list.map(function (item) { return Tracker.normalizeEntry(item); }).filter(function (item) {
      return item.school_name;
    });
  }

  function writeLocalEntries(entries) {
    try { localStorage.setItem("nb_waitlist", JSON.stringify(entries)); } catch (e) {}
  }

  function rememberPcsDate(value) {
    var clean = /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").slice(0, 10)) ? String(value).slice(0, 10) : "";
    try {
      if (clean) localStorage.setItem("nb_pcs_date", clean);
    } catch (e) {}
    return clean;
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

  function savePcsDate(iso) {
    var clean = /^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? iso : "";
    try {
      if (clean) localStorage.setItem("nb_pcs_date", clean);
      else localStorage.removeItem("nb_pcs_date");
    } catch (e) {}
    if (!state.session) return Promise.resolve({ local: true });
    return client().then(function (sb) {
      if (!sb) return { local: true };
      return sb.from("preferences").upsert({
        user_id: state.session.user.id,
        pcs_date: clean || null,
        updated_at: new Date().toISOString()
      }).then(function (result) {
        if (result && result.error) return { local: true };
        return { remote: true };
      });
    }).catch(function () {
      return { local: true };
    });
  }

  function saveTrackerEntry(raw) {
    var Tracker = window.NearBaseTracker;
    if (!Tracker) return Promise.resolve({ error: "Tracker is unavailable." });
    var prepared = Tracker.prepareEntry(raw, Tracker.todayISO());
    if (prepared.error) return Promise.resolve(prepared);
    var entry = prepared.entry;
    var local = readLocalEntries();
    if (!entry.id) entry.id = "local-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    var idx = -1;
    local.forEach(function (item, i) { if (item.id === entry.id) idx = i; });
    if (idx >= 0) local[idx] = entry;
    else local.unshift(entry);
    writeLocalEntries(local);
    if (!state.session) return Promise.resolve({ entry: entry, local: true });
    var row = {
      user_id: state.session.user.id,
      school_slug: entry.school_slug || null,
      school_name: entry.school_name,
      applied_date: entry.applied_date || null,
      fees_paid: entry.fees_paid,
      desired_start_date: entry.desired_start_date || null,
      status: entry.status,
      notes: entry.notes,
      stated_process: entry.stated_process,
      follow_up_date: entry.follow_up_date || null,
      contacts: entry.contacts,
      updated_at: new Date().toISOString()
    };
    if (entry.id.indexOf("local-") !== 0) row.id = entry.id;
    return client().then(function (sb) {
      if (!sb) return { entry: entry, local: true };
      return sb.from("waitlist_entries").upsert(row).select("*").then(function (result) {
        if (!result || result.error || !result.data || !result.data[0]) return { entry: entry, local: true };
        var saved = Tracker.normalizeEntry(result.data[0]);
        var next = readLocalEntries().filter(function (item) {
          return item.id !== entry.id && item.id !== saved.id;
        });
        next.unshift(saved);
        writeLocalEntries(next);
        return { entry: saved, remote: true };
      });
    }).catch(function () {
      return { entry: entry, local: true };
    });
  }

  function deleteTrackerEntry(id) {
    var local = readLocalEntries().filter(function (item) { return item.id !== id; });
    writeLocalEntries(local);
    if (!state.session || String(id).indexOf("local-") === 0) return Promise.resolve({ local: true });
    return client().then(function (sb) {
      if (!sb) return { local: true };
      return sb.from("waitlist_entries").delete().eq("id", id).eq("user_id", state.session.user.id);
    }).catch(function () {
      return { local: true };
    });
  }

  function loadTracker() {
    var Tracker = window.NearBaseTracker;
    var localPcs = readPcsDate();
    var timing = "";
    try {
      var profile = readJson("nb_family") || {};
      timing = profile.timing || "";
    } catch (e) { timing = ""; }
    if (!state.session || !Tracker) {
      return Promise.resolve({ entries: readLocalEntries(), pcsDate: localPcs, timing: timing, local: true });
    }
    return client().then(function (sb) {
      if (!sb) return { entries: readLocalEntries(), pcsDate: localPcs, timing: timing, local: true };
      return Promise.all([
        sb.from("waitlist_entries").select("*").order("updated_at", { ascending: false }),
        sb.from("preferences").select("pcs_date,timing").eq("user_id", state.session.user.id).maybeSingle()
      ]).then(function (results) {
        var prefs = (results[1] && results[1].data) || {};
        var pcs = rememberPcsDate(prefs.pcs_date) || localPcs;
        if (results[0] && results[0].error) {
          return { entries: readLocalEntries(), pcsDate: pcs, timing: prefs.timing || timing, local: true };
        }
        var entries = ((results[0] && results[0].data) || []).map(function (row) {
          return Tracker.normalizeEntry(row);
        });
        writeLocalEntries(entries);
        return { entries: entries, pcsDate: pcs, timing: prefs.timing || timing, remote: true };
      });
    }).catch(function () {
      return { entries: readLocalEntries(), pcsDate: localPcs, timing: timing, local: true };
    });
  }

  function addSchoolToTracker(source) {
    var slug = String((source && source.slug) || "").trim();
    var name = String((source && source.name) || "").trim();
    return loadConfig().then(refreshSession).then(function () {
      if (state.configured && !state.session) {
        try {
          sessionStorage.setItem("nb_track_pending", JSON.stringify({ slug: slug, name: name }));
        } catch (e) {}
        if (!source || !source.stay) window.location.href = "/account.html?next=tracker";
        return { needsSignIn: true };
      }
      var ready = state.session ? loadTracker() : Promise.resolve(null);
      return ready.then(function () {
        if (!name) return { error: "Add a school name." };
        var existing = slug && readLocalEntries().filter(function (item) { return item.school_slug === slug; })[0];
        if (existing) return { entry: existing, already: true };
        return saveTrackerEntry({ school_slug: slug, school_name: name, status: "researching" });
      });
    });
  }

  function consumePendingTrack() {
    if (!state.session) return Promise.resolve(null);
    var raw = null;
    try { raw = JSON.parse(sessionStorage.getItem("nb_track_pending") || "null"); } catch (e) { raw = null; }
    if (!raw || !raw.name) return Promise.resolve(null);
    return addSchoolToTracker({ slug: raw.slug, name: raw.name, stay: true }).then(function (result) {
      if (result && !result.needsSignIn) {
        try { sessionStorage.removeItem("nb_track_pending"); } catch (e) {}
      }
      return result;
    });
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
    if (!document.documentElement.dataset.trackBound) {
      document.documentElement.dataset.trackBound = "1";
      document.addEventListener("click", function (event) {
        var button = event.target.closest ? event.target.closest(".nb-track-school") : null;
        if (!button) return;
        event.stopPropagation();
        event.preventDefault();
        var previous = button.textContent;
        button.textContent = "Adding…";
        addSchoolToTracker({
          slug: button.getAttribute("data-slug") || "",
          name: button.getAttribute("data-name") || ""
        }).then(function (result) {
          if (!result || result.needsSignIn) return;
          if (result.error) {
            button.textContent = previous;
            return;
          }
          button.textContent = "On your tracker";
        }).catch(function () {
          button.textContent = previous;
        });
      });
    }
  }

  function boot() {
    return loadConfig().then(refreshSession).then(consumePendingTrack).then(function () {
      wireCheckout();
      wireSignIn();
      wireSave();
      if (window.NearBaseAccountPage) window.NearBaseAccountPage.render(state);
    });
  }

  window.NearBaseAccount = {
    saveProfile: saveProfile,
    saveSchool: saveSchool,
    savePcsDate: savePcsDate,
    saveTrackerEntry: saveTrackerEntry,
    deleteTrackerEntry: deleteTrackerEntry,
    loadTracker: loadTracker,
    addSchoolToTracker: addSchoolToTracker,
    readLocalEntries: readLocalEntries,
    readPcsDate: readPcsDate,
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
