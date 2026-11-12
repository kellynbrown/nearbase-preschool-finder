// Private family loop: tour logs, openings labels, preference preview,
// shortlist compare, and the profile gallery. No network. No photos are
// invented here. Embeds are rebuilt and limited to Kuula and Matterport.
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NearBaseFamily = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var WOULD_ENROLL = ["yes", "maybe", "no"];
  var PHOTO_PERMISSIONS = [
    { id: "not_asked", label: "Not asked" },
    { id: "not_possible_during_tour_rooms_in_use", label: "Not possible during the tour (rooms in use)" },
    { id: "requested_after_hours", label: "After-hours request only — nothing is published from it" },
    { id: "school_declined", label: "School declined photos" },
    { id: "written_permission_for_empty_rooms", label: "Written permission for empty rooms, no identifiable children" }
  ];
  var INFANT_FIELDS = [
    ["ratio", "Ratio"],
    ["age_range", "Age range"],
    ["outdoor_plan", "Outdoor plan"],
    ["language_exposure", "Language exposure"],
    ["dropoff_flexibility", "Drop-off flexibility"],
    ["meals", "Meals"]
  ];
  var COST_PERIODS = ["hour", "day", "week", "month", "year", "other"];
  var OPENING_STATUSES = ["openings", "waitlist", "no_openings", "unknown"];
  var OPENING_LABELS = {
    openings: "Openings",
    waitlist: "Waitlist",
    no_openings: "No openings",
    unknown: "Not asked / unknown"
  };
  var EMBED_HOSTS = {
    "kuula.co": "kuula",
    "www.kuula.co": "kuula",
    "my.matterport.com": "matterport"
  };
  var PREF_FIELDS = [
    ["preferred_installations", "Installations"],
    ["preferred_jurisdictions", "Jurisdictions"],
    ["age_room_interests", "Age rooms"],
    ["must_haves", "Must-haves"],
    ["deal_breakers", "Deal-breakers"],
    ["visual_interests", "Visual interests"],
    ["budget_max", "Budget"],
    ["budget_period", "Budget period"],
    ["max_commute_minutes", "Commute cap (minutes)"],
    ["preferred_start_month", "Target start"],
    ["care_schedule", "Care schedule"],
    ["apply_tour_learning", "Show suggestions from private tours"]
  ];
  var COMPARE_ROWS = [
    ["distance", "Distance to the selected base"],
    ["eligibility", "Eligibility path"],
    ["ratio", "Ratio, when known"],
    ["cost", "Cost"],
    ["openings", "Openings"],
    ["rating", "Your rating"]
  ];
  var PLACEHOLDER = {
    title: "No approved photos yet",
    body: "NearBase shows a photo only after the school permits it and a privacy review clears it. Rooms in use stay off the page. Empty rooms, no identifiable children.",
    cta: "Request photos / be a founding school",
    fine: "This button does not email the school. A director claims the profile and sends photos they have rights to."
  };
  var PLACEHOLDER_SVG = '<svg viewBox="0 0 360 200" aria-hidden="true"><rect width="360" height="200" fill="#E1F5EE"/><path d="M70 156 V92 L180 42 L290 92 V156 Z" fill="none" stroke="#085041" stroke-width="3"/><rect x="158" y="112" width="44" height="44" fill="none" stroke="#1D9E75" stroke-width="3"/><circle cx="180" cy="78" r="5" fill="#1D9E75"/></svg>';

  function text(value) {
    return value == null ? "" : String(value).trim();
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function unique(list) {
    var out = [];
    var seen = {};
    list.forEach(function (item) {
      var key = item.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push(item);
    });
    return out;
  }

  function parseLines(value) {
    var source = [];
    if (Array.isArray(value)) source = value;
    else if (typeof value === "string") source = value.split(/\r?\n/);
    var out = [];
    source.forEach(function (item) {
      var clean = text(item).replace(/\s+/g, " ");
      if (clean) out.push(clean);
    });
    return unique(out);
  }

  function isoDate(value) {
    var raw = text(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
    var parts = raw.split("-");
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    var date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
    return raw;
  }

  function tooLong(lines, max) {
    return lines.some(function (line) { return line.length > max; });
  }

  function normalizeChecklist(input) {
    var src = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    var out = {};
    INFANT_FIELDS.forEach(function (pair) {
      var value = text(src[pair[0]]);
      if (value) out[pair[0]] = value.slice(0, 500);
    });
    return out;
  }

  function normalizeFollowUps(value) {
    var items = Array.isArray(value) ? value : [];
    var errors = [];
    var out = [];
    if (items.length > 20) errors.push("Keep follow-ups to 20.");
    items.forEach(function (item, index) {
      var task = text(item && item.task);
      var role = text(item && (item.contact_role || item.contactRole));
      var dueRaw = text(item && (item.due || item.due_date || item.dueDate));
      var due = dueRaw ? isoDate(dueRaw) : "";
      var statusRaw = text(item && item.status).toLowerCase();
      var status = statusRaw || "open";
      if (!task && !role && !dueRaw && (!statusRaw || statusRaw === "open")) return;
      var where = "Follow-up " + (index + 1);
      if (!task) errors.push(where + " needs a task.");
      if (task.length > 300) errors.push(where + " task is too long.");
      if (!role) errors.push(where + " needs a contact role, not a person's name.");
      if (role.length > 80) errors.push(where + " role is too long.");
      if (!due) errors.push(where + " needs a due date.");
      if (status !== "open" && status !== "done") errors.push(where + " status is open or done.");
      if (task && role && due && (status === "open" || status === "done")) {
        out.push({ task: task, contact_role: role, due: due, status: status });
      }
    });
    return { ok: errors.length === 0, errors: errors, value: out };
  }

  function normalizeCost(src) {
    var errors = [];
    var raw = src.quoted_cost != null ? src.quoted_cost : src.quotedCost;
    var quoted = null;
    if (raw != null && text(raw) !== "") {
      var amount = text(raw).replace(/[$,]/g, "");
      if (!/^\d+(\.\d{1,2})?$/.test(amount)) errors.push("Cost is a dollar amount, or leave it blank.");
      else quoted = Number(amount);
    }
    var period = text(src.quoted_cost_period || src.quotedCostPeriod);
    if (period && COST_PERIODS.indexOf(period) === -1) errors.push("Cost period is hour, day, week, month, year, or other.");
    if (period && COST_PERIODS.indexOf(period) === -1) period = "";
    if (quoted != null && !period) errors.push("Add the cost period (month, week, or another choice).");
    var currency = text(src.quoted_cost_currency || src.quotedCostCurrency || "USD").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      errors.push("Currency is a 3-letter code.");
      currency = "USD";
    }
    var feesSrc = src.fees_and_inclusions && typeof src.fees_and_inclusions === "object" ? src.fees_and_inclusions : {};
    var fees = { cost_status: text(src.cost_status || src.costStatus || feesSrc.cost_status || (quoted == null ? "pending" : "quoted")).slice(0, 40) };
    var meals = text(src.meals || feesSrc.meals);
    var notes = text(src.cost_notes || src.costNotes || feesSrc.notes);
    if (meals) fees.meals = meals.slice(0, 200);
    if (notes) fees.notes = notes.slice(0, 500);
    if (!fees.cost_status) fees.cost_status = quoted == null ? "pending" : "quoted";
    return {
      ok: errors.length === 0,
      errors: errors,
      quoted_cost: quoted,
      quoted_cost_period: period || null,
      quoted_cost_currency: currency,
      fees_and_inclusions: fees
    };
  }

  function normalizeTour(input) {
    var src = input || {};
    var errors = [];
    var schoolId = text(src.school_id || src.schoolId);
    if (!schoolId || schoolId.length > 200) errors.push("Choose a school from the directory.");
    var visited = isoDate(src.visited_on || src.visitedOn);
    if (!visited) errors.push("Add the date of the visit.");
    var rating = src.rating === "" || src.rating == null ? null : Number(src.rating);
    if (rating != null && (!isFinite(rating) || Math.floor(rating) !== rating || rating < 1 || rating > 5)) {
      errors.push("Rating is 1 to 5, or leave it blank.");
      rating = null;
    }
    var enrollRaw = text(src.would_enroll || src.wouldEnroll).toLowerCase();
    var would = null;
    if (enrollRaw) {
      if (WOULD_ENROLL.indexOf(enrollRaw) === -1) errors.push("Would enroll is yes, maybe, or no.");
      else would = enrollRaw;
    }
    var likes = parseLines(src.likes);
    var dislikes = parseLines(src.dislikes);
    if (likes.length > 50) errors.push("Keep loves to 50 lines.");
    if (dislikes.length > 50) errors.push("Keep concerns to 50 lines.");
    if (tooLong(likes, 500)) errors.push("One of the loves is too long.");
    if (tooLong(dislikes, 500)) errors.push("One of the concerns is too long.");
    var checklist = normalizeChecklist(src.infant_checklist || src.infantChecklist);
    INFANT_FIELDS.forEach(function (pair) {
      var raw = text((src.infant_checklist || src.infantChecklist || {})[pair[0]]);
      if (raw.length > 500) errors.push(pair[1] + " is too long.");
    });
    var follow = normalizeFollowUps(src.follow_ups || src.followUps);
    if (!follow.ok) errors = errors.concat(follow.errors);
    var photo = text(src.photo_permission || src.photoPermission);
    if (photo && !PHOTO_PERMISSIONS.some(function (item) { return item.id === photo; })) {
      errors.push("Choose a photo permission option.");
      photo = "";
    }
    var cost = normalizeCost(src);
    if (!cost.ok) errors = errors.concat(cost.errors);
    var staff = text(src.staff_interaction_notes || src.staffInteractionNotes);
    if (staff.length > 8000) errors.push("Staff notes are too long.");
    var notes = text(src.notes);
    if (notes.length > 8000) errors.push("Notes are too long.");
    var waitlist = text(src.waitlist);
    if (waitlist.length > 4000) errors.push("Waitlist notes are too long.");
    var bag = src.search_preference_changes && typeof src.search_preference_changes === "object" ? src.search_preference_changes : {};
    var suggestions = parseLines(src.suggested_must_haves || src.suggestedMustHaves || bag.suggested_must_haves);
    if (suggestions.length > 30) errors.push("Keep suggested must-haves to 30 lines.");
    if (tooLong(suggestions, 120)) errors.push("One suggested must-have is too long.");
    var share = src.share_publicly === true || src.share_publicly === "true" || src.sharePublicly === true;
    return {
      ok: errors.length === 0,
      errors: errors,
      row: {
        school_id: schoolId,
        visited_on: visited || null,
        rating: errors.some(function (item) { return item.indexOf("Rating") === 0; }) ? null : rating,
        would_enroll: would,
        likes: likes.slice(0, 50),
        dislikes: dislikes.slice(0, 50),
        infant_checklist: checklist,
        follow_ups: follow.value,
        photo_permission: photo || null,
        quoted_cost: cost.quoted_cost,
        quoted_cost_period: cost.quoted_cost_period,
        quoted_cost_currency: cost.quoted_cost_currency,
        fees_and_inclusions: cost.fees_and_inclusions,
        staff_interaction_notes: staff || null,
        notes: notes || null,
        waitlist: waitlist || null,
        openings_by_age_room: [],
        search_preference_changes: suggestions.length ? { suggested_must_haves: suggestions.slice(0, 30) } : {},
        share_publicly: share,
        public_summary_draft: null
      }
    };
  }

  function optionalMonth(value, errors, label) {
    if (value == null || text(value) === "") return null;
    if (!/^\d+$/.test(text(value))) {
      errors.push(label + " is months as a whole number, or blank.");
      return null;
    }
    var months = Number(text(value));
    if (months < 0 || months > 216) errors.push(label + " is between 0 and 216 months.");
    return months;
  }

  function openingReport(input, now) {
    var src = input || {};
    var errors = [];
    var schoolId = text(src.school_id || src.schoolId);
    if (!schoolId || schoolId.length > 200) errors.push("Choose a school from the directory.");
    var ageRoom = text(src.age_room || src.ageRoom);
    if (!ageRoom || ageRoom.length > 200) errors.push("Name the age room.");
    var status = text(src.status) || "unknown";
    if (OPENING_STATUSES.indexOf(status) === -1) errors.push("Choose a waitlist status.");
    var placesRaw = src.available_places != null ? src.available_places : src.availablePlaces;
    var places = null;
    if (placesRaw != null && text(placesRaw) !== "") {
      if (!/^\d+$/.test(text(placesRaw))) errors.push("Places is a whole number, or leave it blank.");
      else places = Number(text(placesRaw));
    }
    if (status === "openings" && places === 0) errors.push("Openings need a blank or a number above zero. Use no openings if the room is full.");
    if (status === "no_openings" && places != null && places !== 0) errors.push("No openings cannot include a place count above zero.");
    var minMonths = optionalMonth(src.age_min_months != null ? src.age_min_months : src.ageMinMonths, errors, "Youngest age");
    var maxMonths = optionalMonth(src.age_max_months != null ? src.age_max_months : src.ageMaxMonths, errors, "Oldest age");
    if (minMonths != null && maxMonths != null && maxMonths < minMonths) errors.push("Oldest age is younger than the youngest age.");
    var opensRaw = text(src.opens_on || src.opensOn);
    var opens = opensRaw ? isoDate(opensRaw) : "";
    if (opensRaw && !opens) errors.push("Earliest start is not a real date.");
    var observed = isoDate(src.observed_on || src.observedOn || src.as_of);
    if (!observed) errors.push("Add the date you observed this.");
    var clock = now instanceof Date ? now : new Date();
    var today = clock.toISOString().slice(0, 10);
    if (observed && observed > today) errors.push("The observed date cannot be in the future.");
    var attested = src.adult_attested === true || src.adultAttested === true || src.adult_attested === "true";
    if (!attested) errors.push("Confirm you are recording your own observation.");
    var note = text(src.public_note || src.publicNote);
    if (note.length > 500) errors.push("The public note is too long.");
    if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(note)) errors.push("Leave phone numbers out of the public note.");
    var estimate = text(src.waitlist_estimate || src.waitlistEstimate);
    if (estimate.length > 500) errors.push("The waitlist note is too long.");
    var expires = null;
    if (observed) {
      var parts = observed.split("-");
      expires = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) + 7, 12, 0, 0)).toISOString();
    }
    return {
      ok: errors.length === 0,
      errors: errors,
      row: {
        school_id: schoolId,
        age_room: ageRoom,
        age_min_months: minMonths,
        age_max_months: maxMonths,
        status: OPENING_STATUSES.indexOf(status) === -1 ? "unknown" : status,
        available_places: places,
        opens_on: opens || null,
        waitlist_estimate: estimate || null,
        as_of: observed ? observed + "T12:00:00.000Z" : null,
        expires_at: expires,
        source: "family_tour",
        public_note: note || null,
        adult_attested: true
      }
    };
  }

  function daySpan(from, to) {
    var start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
    var end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
    return Math.round((end - start) / 86400000);
  }

  function openingFreshness(report, now) {
    var clock = now instanceof Date ? now : new Date();
    var asOf = report && report.as_of ? new Date(report.as_of) : null;
    var expires = report && report.expires_at ? new Date(report.expires_at) : null;
    var daysAgo = asOf && !isNaN(asOf.getTime()) ? daySpan(asOf, clock) : null;
    if (daysAgo != null && daysAgo < 0) daysAgo = 0;
    var expired = !!(expires && !isNaN(expires.getTime()) && expires.getTime() <= clock.getTime());
    var stale = !expired && daysAgo != null && daysAgo >= 7;
    var confirmed = !!(report && report.provider_confirmed);
    var confirmation = confirmed ? "Provider confirmed" : (report && report.source === "family_tour" ? "Unconfirmed family report" : "Unconfirmed");
    var when = "Date not recorded";
    if (expired) when = "Expired";
    else if (daysAgo === 0) when = "Reported today";
    else if (daysAgo === 1) when = "Reported 1 day ago";
    else if (daysAgo != null) when = "Reported " + daysAgo + " days ago";
    var flags = [];
    if (stale) flags.push("Stale — re-check before you rely on it");
    if (expired) flags.push("Expired — not shown as a current opening");
    return {
      daysAgo: daysAgo,
      stale: stale,
      expired: expired,
      when: when,
      confirmation: confirmation,
      flags: flags,
      label: [when, confirmation].concat(flags).join(" · ")
    };
  }

  function rejectEmbed(reason) {
    return { allowed: false, provider: "", embedUrl: "", directUrl: "", label: "", notice: "", reason: reason };
  }

  function allowEmbed(provider, href, label) {
    return {
      allowed: true,
      provider: provider,
      embedUrl: href,
      directUrl: href,
      label: label,
      notice: "This 360° tour is hosted by " + label + ". Starting it loads their site in this page. NearBase does not control that player.",
      reason: ""
    };
  }

  function tourEmbed(raw) {
    var rawText = text(raw);
    if (!rawText) return rejectEmbed("No tour link.");
    var url;
    try { url = new URL(rawText); } catch (error) { return rejectEmbed("That is not a web address."); }
    if (url.protocol !== "https:") return rejectEmbed("Only https links can be embedded.");
    if (url.username || url.password) return rejectEmbed("Links with a username or password are blocked.");
    if (url.port && url.port !== "443") return rejectEmbed("That port is not allowed.");
    var host = url.hostname.toLowerCase();
    var provider = EMBED_HOSTS[host] || "";
    if (!provider) return rejectEmbed("Only Kuula and Matterport can play inside the page.");
    if (provider === "kuula") {
      if (!/^\/(share|embed)\/[A-Za-z0-9/_-]{1,200}$/.test(url.pathname)) return rejectEmbed("That Kuula link is not a share or embed URL.");
      return allowEmbed(provider, "https://" + host + url.pathname, "Kuula");
    }
    if (url.pathname !== "/show" && url.pathname !== "/show/") return rejectEmbed("That Matterport link is not a show URL.");
    var model = url.searchParams.get("m") || "";
    if (!/^[A-Za-z0-9]{4,64}$/.test(model)) return rejectEmbed("That Matterport link is missing a model id.");
    var clean = new URL("https://my.matterport.com/show/");
    clean.searchParams.set("m", model);
    var play = url.searchParams.get("play");
    if (play === "0" || play === "1") clean.searchParams.set("play", play);
    return allowEmbed(provider, clean.href, "Matterport");
  }

  function httpsUrl(raw) {
    var rawText = text(raw);
    if (!rawText) return "";
    var url;
    try { url = new URL(rawText); } catch (error) { return ""; }
    if (url.protocol !== "https:") return "";
    if (url.username || url.password) return "";
    if (url.port && url.port !== "443") return "";
    return url.href;
  }

  function galleryFromPublic(rows) {
    var photos = [];
    var tours = [];
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (!row) return;
      var kind = text(row.media_type);
      if (kind === "photo") {
        var href = httpsUrl(row.url);
        if (!href) return;
        photos.push({
          id: text(row.id),
          href: href,
          alt: text(row.alt_text) || text(row.caption) || "School photo",
          caption: text(row.caption),
          credit: text(row.credit),
          hero: !!row.is_hero,
          sort: Number(row.sort_order) || 0
        });
      } else if (kind === "3d_tour") {
        if (!row.embed_allowed) {
          var direct = httpsUrl(row.url);
          tours.push({
            allowed: false,
            provider: "",
            embedUrl: "",
            directUrl: direct,
            label: "",
            notice: direct ? "This tour is a link only. It is not played inside the page." : "No playable tour link is on this row.",
            reason: "Embed is not permitted for this tour."
          });
          return;
        }
        var slot = tourEmbed(row.url);
        if (slot.allowed) tours.push(slot);
        else {
          tours.push({
            allowed: false,
            provider: "",
            embedUrl: "",
            directUrl: "",
            label: "",
            notice: "",
            reason: slot.reason || "Only Kuula and Matterport can play inside the page."
          });
        }
      }
    });
    photos.sort(function (a, b) {
      if (a.hero !== b.hero) return a.hero ? -1 : 1;
      return a.sort - b.sort;
    });
    return { photos: photos, tours: tours, empty: photos.length === 0 && tours.length === 0 };
  }

  function placeholderHref(schoolId) {
    var id = text(schoolId);
    return "claim.html?intent=photos" + (id ? "&school=" + encodeURIComponent(id) : "");
  }

  function embedSlotHtml(slot) {
    var checked = slot && slot.allowed ? tourEmbed(slot.embedUrl) : (slot || rejectEmbed(""));
    if (slot && slot.allowed && !checked.allowed) checked = rejectEmbed(checked.reason);
    if (slot && !slot.allowed) checked = slot;
    var html = '<div class="tour-slot"' + (checked.allowed ? ' data-embed="' + esc(checked.embedUrl) + '" data-provider="' + esc(checked.provider) + '"' : "") + ">";
    html += "<h3>360° tour</h3>";
    if (checked.notice) html += "<p>" + esc(checked.notice) + "</p>";
    else if (checked.reason) html += "<p>" + esc(checked.reason) + "</p>";
    if (checked.allowed) html += '<button type="button" class="btn js-start-tour">Start 360° tour</button>';
    if (checked.directUrl) html += '<a class="text-link" href="' + esc(checked.directUrl) + '" target="_blank" rel="noopener noreferrer">Open the tour in a new tab</a>';
    html += "</div>";
    return html;
  }

  function galleryHtml(rows, schoolId) {
    var model = rows && rows.photos ? rows : galleryFromPublic(rows);
    var parts = [];
    if (!model.photos.length) {
      parts.push(
        '<div class="gallery-empty"><div class="frame">' + PLACEHOLDER_SVG + "</div>" +
        '<div class="empty-copy"><h2>' + esc(PLACEHOLDER.title) + "</h2><p>" + esc(PLACEHOLDER.body) + "</p>" +
        '<a class="btn" href="' + esc(placeholderHref(schoolId)) + '">' + esc(PLACEHOLDER.cta) + "</a>" +
        '<p class="fine">' + esc(PLACEHOLDER.fine) + "</p></div></div>"
      );
    } else {
      parts.push('<div class="gallery-hero">');
      model.photos.forEach(function (photo, index) {
        var caption = [photo.caption, photo.credit].filter(Boolean).join(" · ");
        parts.push(
          '<figure class="shot' + (index === 0 ? " is-hero" : "") + '"><img src="' + esc(photo.href) + '" alt="' + esc(photo.alt) + '" referrerpolicy="no-referrer">' +
          (caption ? "<figcaption>" + esc(caption) + "</figcaption>" : "") + "</figure>"
        );
      });
      parts.push("</div>");
    }
    if (!model.tours.length) {
      parts.push('<div class="tour-slot tour-empty"><h3>360° tour</h3><p>No approved 360° tour. When a school shares a Kuula or Matterport link and it passes review, it can be started here. Other websites stay links.</p></div>');
    } else {
      model.tours.forEach(function (slot) { parts.push(embedSlotHtml(slot)); });
    }
    return parts.join("");
  }

  function startTour(button) {
    if (!button || typeof document === "undefined" || !button.closest) return false;
    var slot = button.closest(".tour-slot");
    if (!slot || slot.querySelector("iframe")) return false;
    var checked = tourEmbed(slot.getAttribute("data-embed") || "");
    if (!checked.allowed) return false;
    var frame = document.createElement("iframe");
    frame.className = "tour-frame";
    frame.src = checked.embedUrl;
    frame.title = (checked.label || "360") + " tour";
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-fullscreen allow-popups");
    frame.setAttribute("allow", "fullscreen; xr-spatial-tracking");
    frame.referrerPolicy = "no-referrer";
    frame.loading = "lazy";
    slot.appendChild(frame);
    button.disabled = true;
    return true;
  }

  function openingsHtml(reports, now) {
    var list = Array.isArray(reports) ? reports : [];
    if (!list.length) {
      return "<p>No current public openings report. Availability changes quickly. A blank here is not a finding that the school is full or has space.</p>";
    }
    return '<ul class="openings">' + list.map(function (report) {
      var fresh = openingFreshness(report, now);
      var room = text(report.age_room) || "Age room";
      var status = OPENING_LABELS[report.status] || text(report.status) || "Status not recorded";
      var places = report.available_places == null || report.available_places === "" ? "" : " · " + report.available_places + " places";
      var start = report.opens_on ? " · earliest start " + text(report.opens_on).slice(0, 10) : "";
      var review = report.moderation_status && report.moderation_status !== "approved" ? " · " + report.moderation_status + " review" : "";
      var klass = fresh.expired ? "expired" : (fresh.stale ? "stale" : "");
      return "<li><strong>" + esc(room) + "</strong> · " + esc(status) + esc(places) + esc(start) + esc(review) +
        '<span class="fresh ' + klass + '">' + esc(fresh.label) + "</span></li>";
    }).join("") + "</ul>";
  }

  function money(amount) {
    var number = Number(amount);
    if (!isFinite(number)) return "";
    var fixed = (Math.round(number * 100) / 100).toFixed(2);
    var parts = fixed.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts[1] === "00" ? "$" + parts[0] : "$" + parts.join(".");
  }

  function formatCost(tour) {
    if (!tour || tour.quoted_cost == null || tour.quoted_cost === "") return "";
    var amount = money(tour.quoted_cost);
    if (!amount) return "";
    return amount + (tour.quoted_cost_period ? " / " + tour.quoted_cost_period : "");
  }

  function compareColumn(school, extras) {
    extras = extras || {};
    var tour = extras.tour || null;
    var checklist = tour && tour.infant_checklist && typeof tour.infant_checklist === "object" ? tour.infant_checklist : {};
    var ratio = text(checklist.ratio);
    var cost = formatCost(tour);
    var rating;
    if (!extras.signedIn) rating = "Sign in to see your rating";
    else if (tour && tour.rating) rating = String(tour.rating) + " / 5" + (tour.would_enroll ? " · would enroll: " + tour.would_enroll : "");
    else rating = "No tour rating yet";
    var badge = extras.eligibility || {};
    var openings = (extras.openings || []).map(function (report) {
      return (text(report.age_room) || "Age room") + " — " + openingFreshness(report, extras.now || new Date()).label;
    });
    return {
      id: school && school.id || "",
      name: school && school.name || "School",
      distance: extras.distanceLabel || "Distance not on record",
      eligibility: badge.label || "Verification evidence pending",
      eligibilityCode: badge.code || "",
      ratio: ratio || "Not on record",
      cost: cost || "Not on record",
      openings: openings.length ? openings : ["No current public report"],
      rating: rating
    };
  }

  function compareTableHtml(columns) {
    var cols = columns || [];
    if (!cols.length) {
      return '<p class="empty-compare">Save schools with the heart on Find, then compare them here. Distance, eligibility, ratio, cost, openings, and your own rating sit side by side.</p>';
    }
    var head = "<tr><th>Field</th>" + cols.map(function (col) {
      return '<th scope="col">' + esc(col.name) + "</th>";
    }).join("") + "</tr>";
    var body = COMPARE_ROWS.map(function (pair) {
      return '<tr><th scope="row">' + esc(pair[1]) + "</th>" + cols.map(function (col) {
        var value = col[pair[0]];
        if (Array.isArray(value)) value = value.join("; ");
        if (pair[0] === "eligibility" && col.eligibilityCode) value = value + " (" + col.eligibilityCode + ")";
        return "<td>" + esc(value) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return '<div class="compare-scroll"><table class="compare"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div>";
  }

  function stringList(value, maxLen) {
    return parseLines(value).map(function (item) { return item.slice(0, maxLen); }).filter(Boolean);
  }

  function normalizePreferences(input) {
    var src = input || {};
    var schedule = src.care_schedule && typeof src.care_schedule === "object" && !Array.isArray(src.care_schedule) ? src.care_schedule : {};
    var month = text(src.preferred_start_month || src.preferredStartMonth);
    if (/^\d{4}-\d{2}$/.test(month)) month = month + "-01";
    else if (/^\d{4}-\d{2}-\d{2}$/.test(month)) month = isoDate(month.slice(0, 7) + "-01");
    else month = "";
    var budgetRaw = src.budget_max != null ? src.budget_max : src.budgetMax;
    var budgetNum = null;
    if (budgetRaw != null && text(budgetRaw) !== "") {
      var budgetText = text(budgetRaw).replace(/[$,]/g, "");
      if (/^\d+(\.\d{1,2})?$/.test(budgetText)) budgetNum = Number(budgetText);
    }
    var commuteRaw = src.max_commute_minutes != null ? src.max_commute_minutes : src.maxCommuteMinutes;
    var commuteNum = null;
    if (commuteRaw != null && text(commuteRaw) !== "") {
      var commute = Number(text(commuteRaw));
      if (isFinite(commute) && Math.floor(commute) === commute && commute >= 0 && commute <= 360) commuteNum = commute;
    }
    var period = text(src.budget_period || src.budgetPeriod);
    if (COST_PERIODS.indexOf(period) === -1) period = "";
    var jurisdictions = stringList(src.preferred_jurisdictions || src.preferredJurisdictions, 40).map(function (item) {
      return item.toUpperCase();
    }).filter(function (item) { return item === "VA" || item === "DC" || item === "MD"; });
    var care = {};
    if (text(schedule.hours)) care.hours = text(schedule.hours).slice(0, 200);
    if (text(schedule.notes)) care.notes = text(schedule.notes).slice(0, 500);
    return {
      preferred_installations: stringList(src.preferred_installations || src.preferredInstallations, 80).slice(0, 12),
      preferred_jurisdictions: unique(jurisdictions).slice(0, 3),
      age_room_interests: stringList(src.age_room_interests || src.ageRoomInterests, 80).slice(0, 12),
      must_haves: stringList(src.must_haves || src.mustHaves, 120).slice(0, 30),
      deal_breakers: stringList(src.deal_breakers || src.dealBreakers, 120).slice(0, 30),
      visual_interests: stringList(src.visual_interests || src.visualInterests, 80).slice(0, 12),
      budget_max: budgetNum,
      budget_period: period || null,
      max_commute_minutes: commuteNum,
      preferred_start_month: month || null,
      care_schedule: care,
      preference_weights: {},
      apply_tour_learning: src.apply_tour_learning === true || src.applyTourLearning === true
    };
  }

  function validatePreferences(input) {
    var prefs = normalizePreferences(input);
    var src = input || {};
    var errors = [];
    if (text(src.budget_max != null ? src.budget_max : src.budgetMax) && prefs.budget_max == null) errors.push("Budget is a dollar amount, or leave it blank.");
    if (prefs.budget_max != null && !prefs.budget_period) errors.push("Add a budget period.");
    if (text(src.max_commute_minutes != null ? src.max_commute_minutes : src.maxCommuteMinutes) && prefs.max_commute_minutes == null) errors.push("Commute cap is minutes from 0 to 360, or leave it blank.");
    if (text(src.preferred_start_month || src.preferredStartMonth) && !prefs.preferred_start_month) errors.push("Target start should be a month.");
    return { ok: errors.length === 0, errors: errors, preferences: prefs };
  }

  function preferencePayload(input, userId) {
    var checked = validatePreferences(input);
    var row = checked.preferences;
    if (userId) row.user_id = userId;
    return { ok: checked.ok, errors: checked.errors, row: row };
  }

  function displayValue(value) {
    if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
    if (value && typeof value === "object") {
      var bits = [];
      Object.keys(value).forEach(function (key) {
        if (text(value[key])) bits.push(key + ": " + value[key]);
      });
      return bits.length ? bits.join("; ") : "None";
    }
    if (value === true) return "Yes";
    if (value === false) return "No";
    if (value == null || value === "") return "None";
    return String(value);
  }

  function preferenceDiff(before, after) {
    var left = normalizePreferences(before);
    var right = normalizePreferences(after);
    var changes = [];
    PREF_FIELDS.forEach(function (pair) {
      var previous = displayValue(left[pair[0]]);
      var next = displayValue(right[pair[0]]);
      if (previous !== next) changes.push({ field: pair[0], label: pair[1], before: previous, after: next });
    });
    return changes;
  }

  function preferenceDiffHtml(changes) {
    if (!changes || !changes.length) return "<p>No preference changes to apply.</p>";
    return "<ul class=\"pref-diff\">" + changes.map(function (change) {
      return "<li><strong>" + esc(change.label) + "</strong> " + esc(change.before) + " → " + esc(change.after) + "</li>";
    }).join("") + "</ul>";
  }

  function haystack(school) {
    school = school || {};
    return [
      school.name, school.agesServed, school.ages_served, school.hours,
      school.accreditation, school.eligibilityPath, school.eligibility_path,
      school.licenseType, school.license_type, school.city, school.locality,
      school.qualityRating, school.quality_rating
    ].map(text).join(" ").toLowerCase();
  }

  function ageHit(school, interest) {
    var blob = haystack(school);
    var key = text(interest).toLowerCase();
    if (!key) return false;
    if (key === "infant" || key === "infants") return /infant|0\s*month|1\s*month|6\s*week|under\s*18/.test(blob);
    if (key === "toddler" || key === "toddlers") return /toddler|18\s*month|2\s*year/.test(blob);
    if (key === "preschool" || key === "pk" || key === "pre-k" || key === "prek") return /preschool|pre-k|prek|pk3|pk4|3\s*year|4\s*year/.test(blob);
    return key.length >= 3 && blob.indexOf(key) !== -1;
  }

  function preferenceRank(schools, prefs) {
    var list = (schools || []).slice();
    var normalized = normalizePreferences(prefs || {});
    var active = normalized.must_haves.length || normalized.deal_breakers.length || normalized.age_room_interests.length || normalized.preferred_jurisdictions.length;
    var extra = [];
    if (normalized.preferred_installations.length) extra.push("Your saved installations stay on My tours. This list still uses the base selected above, so the older match settings stay put.");
    if (normalized.max_commute_minutes != null) extra.push("A commute cap is saved and is not applied as a drive time.");
    if (!active) {
      return { schools: list, applied: false, note: extra.join(" ") };
    }
    var scored = list.map(function (school, index) {
      var hay = haystack(school);
      var score = 0;
      normalized.must_haves.forEach(function (item) {
        if (item.length >= 3 && hay.indexOf(item.toLowerCase()) !== -1) score += 2;
      });
      normalized.deal_breakers.forEach(function (item) {
        if (item.length >= 3 && hay.indexOf(item.toLowerCase()) !== -1) score -= 5;
      });
      normalized.age_room_interests.forEach(function (item) {
        if (ageHit(school, item)) score += 1;
      });
      if (normalized.preferred_jurisdictions.length) {
        var code = text(school.jurisdictionCode || school.state).toUpperCase();
        if (normalized.preferred_jurisdictions.indexOf(code) !== -1) score += 1;
      }
      return { school: school, index: index, score: score };
    });
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });
    return {
      schools: scored.map(function (item) { return item.school; }),
      applied: true,
      note: ["Sorted with your saved must-haves and deal-breakers. A school stays on the list when the public record is silent. Straight-line miles are unchanged, and the older match settings were not rewritten."].concat(extra).join(" ")
    };
  }

  function suggestedFromTours(tours) {
    var out = [];
    (tours || []).forEach(function (tour) {
      var bag = tour && tour.search_preference_changes;
      parseLines(bag && bag.suggested_must_haves).forEach(function (item) {
        if (item.length <= 120 && out.indexOf(item) === -1) out.push(item);
      });
    });
    return out.slice(0, 30);
  }

  return {
    WOULD_ENROLL: WOULD_ENROLL,
    PHOTO_PERMISSIONS: PHOTO_PERMISSIONS,
    INFANT_FIELDS: INFANT_FIELDS,
    COST_PERIODS: COST_PERIODS,
    OPENING_STATUSES: OPENING_STATUSES,
    OPENING_LABELS: OPENING_LABELS,
    PLACEHOLDER: PLACEHOLDER,
    esc: esc,
    normalizeTour: normalizeTour,
    normalizeFollowUps: normalizeFollowUps,
    openingReport: openingReport,
    openingFreshness: openingFreshness,
    openingsHtml: openingsHtml,
    tourEmbed: tourEmbed,
    httpsUrl: httpsUrl,
    galleryFromPublic: galleryFromPublic,
    galleryHtml: galleryHtml,
    placeholderHref: placeholderHref,
    startTour: startTour,
    compareColumn: compareColumn,
    compareTableHtml: compareTableHtml,
    normalizePreferences: normalizePreferences,
    validatePreferences: validatePreferences,
    preferencePayload: preferencePayload,
    preferenceDiff: preferenceDiff,
    preferenceDiffHtml: preferenceDiffHtml,
    preferenceRank: preferenceRank,
    suggestedFromTours: suggestedFromTours
  };
});
