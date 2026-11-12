// Signed-in family loop. Writes use the anon key and the owner's RLS.
// The service role is never loaded here.
(function () {
  var Family = window.NearBaseFamily;
  var schools = [];
  var tours = [];
  var savedPrefs = Family.normalizePreferences({});
  var editingId = "";
  var armedPreview = "";

  function sessionUser() {
    var state = window.NearBaseAccount && window.NearBaseAccount.state ? window.NearBaseAccount.state() : null;
    return state && state.session && state.session.user ? state.session.user : null;
  }

  function setStatus(id, message) {
    var el = document.getElementById(id);
    if (el) el.textContent = message || "";
  }

  function client() {
    return window.NearBaseAccount.client();
  }

  function schoolName(id) {
    var found = schools.filter(function (school) { return school.id === id; })[0];
    return found ? found.name : id;
  }

  function bindSearch(inputId, listId, hiddenId, labelId) {
    var input = document.getElementById(inputId);
    var list = document.getElementById(listId);
    input.addEventListener("input", function () {
      var query = input.value.trim().toLowerCase();
      var matches = !query ? schools.slice(0, 6) : schools.filter(function (school) {
        return (school.name + " " + (school.city || "") + " " + school.id).toLowerCase().indexOf(query) !== -1;
      }).slice(0, 8);
      list.innerHTML = matches.map(function (school) {
        return '<button type="button" data-id="' + Family.esc(school.id) + '">' + Family.esc(school.name) +
          "<span>" + Family.esc([school.city, school.state].filter(Boolean).join(", ")) + "</span></button>";
      }).join("");
    });
    list.addEventListener("click", function (event) {
      var button = event.target.closest("button");
      if (!button) return;
      document.getElementById(hiddenId).value = button.getAttribute("data-id");
      document.getElementById(labelId).textContent = button.textContent;
      input.value = "";
      list.innerHTML = "";
    });
  }

  function followUpRow(item) {
    item = item || {};
    var row = document.createElement("div");
    row.className = "follow";
    row.innerHTML =
      '<input class="follow-task" placeholder="Task" value="' + Family.esc(item.task || "") + '">' +
      '<input class="follow-role" placeholder="Contact role" value="' + Family.esc(item.contact_role || "") + '">' +
      '<input class="follow-due" type="date" value="' + Family.esc(item.due || "") + '" aria-label="Due date">' +
      '<select class="follow-status" aria-label="Follow-up status"><option value="open">Open</option><option value="done">Done</option></select>';
    row.querySelector(".follow-status").value = item.status === "done" ? "done" : "open";
    return row;
  }

  function readFollowUps() {
    return [].map.call(document.querySelectorAll("#followUps .follow"), function (row) {
      return {
        task: row.querySelector(".follow-task").value,
        contact_role: row.querySelector(".follow-role").value,
        due: row.querySelector(".follow-due").value,
        status: row.querySelector(".follow-status").value
      };
    });
  }

  function checklistValue() {
    var out = {};
    Family.INFANT_FIELDS.forEach(function (pair) {
      out[pair[0]] = document.getElementById("check-" + pair[0]).value;
    });
    return out;
  }

  function readTourForm() {
    var checklist = checklistValue();
    return {
      school_id: document.getElementById("tourSchoolId").value,
      visited_on: document.getElementById("visitedOn").value,
      rating: document.getElementById("rating").value,
      would_enroll: document.getElementById("wouldEnroll").value,
      likes: document.getElementById("likes").value,
      dislikes: document.getElementById("dislikes").value,
      infant_checklist: checklist,
      meals: checklist.meals,
      quoted_cost: document.getElementById("quotedCost").value,
      quoted_cost_period: document.getElementById("quotedCostPeriod").value,
      cost_notes: document.getElementById("costNotes").value,
      waitlist: document.getElementById("waitlist").value,
      staff_interaction_notes: document.getElementById("staffNotes").value,
      notes: document.getElementById("notes").value,
      suggested_must_haves: document.getElementById("suggestedMustHaves").value,
      photo_permission: document.getElementById("photoPermission").value,
      follow_ups: readFollowUps(),
      share_publicly: document.getElementById("sharePublicly").checked
    };
  }

  function fillTour(tour) {
    editingId = tour && tour.id ? tour.id : "";
    document.getElementById("tourSchoolId").value = tour ? tour.school_id : "";
    document.getElementById("tourSchoolLabel").textContent = tour ? schoolName(tour.school_id) : "";
    document.getElementById("visitedOn").value = tour && tour.visited_on ? String(tour.visited_on).slice(0, 10) : "";
    document.getElementById("rating").value = tour && tour.rating ? String(tour.rating) : "";
    document.getElementById("wouldEnroll").value = tour && tour.would_enroll ? tour.would_enroll : "";
    document.getElementById("likes").value = tour && tour.likes ? tour.likes.join("\n") : "";
    document.getElementById("dislikes").value = tour && tour.dislikes ? tour.dislikes.join("\n") : "";
    var checklist = tour && tour.infant_checklist || {};
    Family.INFANT_FIELDS.forEach(function (pair) {
      document.getElementById("check-" + pair[0]).value = checklist[pair[0]] || "";
    });
    document.getElementById("quotedCost").value = tour && tour.quoted_cost != null ? String(tour.quoted_cost) : "";
    document.getElementById("quotedCostPeriod").value = tour && tour.quoted_cost_period ? tour.quoted_cost_period : "";
    var fees = tour && tour.fees_and_inclusions || {};
    document.getElementById("costNotes").value = fees.notes || "";
    document.getElementById("waitlist").value = tour && tour.waitlist || "";
    document.getElementById("staffNotes").value = tour && tour.staff_interaction_notes || "";
    document.getElementById("notes").value = tour && tour.notes || "";
    var suggestions = tour && tour.search_preference_changes && tour.search_preference_changes.suggested_must_haves;
    document.getElementById("suggestedMustHaves").value = suggestions ? suggestions.join("\n") : "";
    document.getElementById("photoPermission").value = tour && tour.photo_permission ? tour.photo_permission : "not_asked";
    document.getElementById("sharePublicly").checked = !!(tour && tour.share_publicly);
    var box = document.getElementById("followUps");
    box.innerHTML = "";
    var follows = tour && tour.follow_ups && tour.follow_ups.length ? tour.follow_ups : [{}];
    follows.forEach(function (item) { box.appendChild(followUpRow(item)); });
    document.getElementById("saveTour").textContent = editingId ? "Update tour" : "Save tour";
  }

  function renderFollowUps(tour) {
    var follows = tour.follow_ups || [];
    if (!follows.length) return "";
    return "<ul>" + follows.map(function (item) {
      return "<li>" + Family.esc(item.task) + " · " + Family.esc(item.contact_role) + " · due " + Family.esc(item.due) + "</li>";
    }).join("") + "</ul>";
  }

  function renderTourList() {
    var box = document.getElementById("tourList");
    if (!sessionUser()) {
      box.innerHTML = '<p class="muted">Sign in to see your tours.</p>';
      return;
    }
    if (!tours.length) {
      box.innerHTML = '<p class="muted">No tours saved on this account yet.</p>';
      return;
    }
    box.innerHTML = tours.map(function (tour) {
      var checklist = tour.infant_checklist || {};
      var bits = Family.INFANT_FIELDS.map(function (pair) {
        return checklist[pair[0]] ? pair[1] + ": " + checklist[pair[0]] : "";
      }).filter(Boolean);
      var share = tour.share_publicly
        ? '<p class="flag">Opted in for a future anonymized insight. This log is still private.</p>'
        : '<p class="muted">Private.</p>';
      return '<article class="tour"><h3>' + Family.esc(schoolName(tour.school_id)) + "</h3>" +
        "<p>" + Family.esc(String(tour.visited_on || "")) +
        (tour.rating ? " · " + Family.esc(String(tour.rating)) + " / 5" : "") +
        (tour.would_enroll ? " · would enroll " + Family.esc(tour.would_enroll) : "") + "</p>" +
        share +
        (bits.length ? "<p>" + Family.esc(bits.join(" · ")) + "</p>" : "") +
        renderFollowUps(tour) +
        '<div class="actions"><button type="button" class="btn ghost" data-edit="' + Family.esc(tour.id) + '">Edit</button>' +
        '<button type="button" class="btn ghost" data-delete="' + Family.esc(tour.id) + '">Delete</button></div></article>';
    }).join("");
  }

  function loadTours(sb, userId) {
    return sb.from("tour_logs").select("id,school_id,visited_on,rating,would_enroll,likes,dislikes,infant_checklist,follow_ups,photo_permission,quoted_cost,quoted_cost_period,quoted_cost_currency,fees_and_inclusions,staff_interaction_notes,notes,waitlist,share_publicly,search_preference_changes,created_at").eq("user_id", userId).order("visited_on", { ascending: false }).then(function (result) {
      if (result.error) {
        setStatus("tourStatus", result.error.message || "Tours did not load.");
        return;
      }
      tours = result.data || [];
      renderTourList();
      renderSuggestions();
    });
  }

  function loadOpenings(sb) {
    return sb.from("openings_reports_own").select("id,school_id,age_room,status,available_places,opens_on,as_of,expires_at,source,public_note,provider_confirmed,moderation_status").order("as_of", { ascending: false }).then(function (result) {
      var box = document.getElementById("openingList");
      if (result.error) {
        box.innerHTML = '<p class="flag">Your openings reports did not load. ' + Family.esc(result.error.message || "") + "</p>";
        return;
      }
      var rows = result.data || [];
      box.innerHTML = rows.length ? "<h2 style=\"margin-top:1rem\">Your reports</h2>" + Family.openingsHtml(rows, new Date()) : '<p class="muted">No openings reports on this account yet.</p>';
    });
  }

  function fillPreferences(prefs) {
    savedPrefs = Family.normalizePreferences(prefs || {});
    document.getElementById("prefInstallations").value = savedPrefs.preferred_installations.join("\n");
    document.querySelectorAll('#prefForm input[name="jurisdiction"]').forEach(function (box) {
      box.checked = savedPrefs.preferred_jurisdictions.indexOf(box.value) !== -1;
    });
    document.getElementById("prefAges").value = savedPrefs.age_room_interests.join("\n");
    document.getElementById("prefVisual").value = savedPrefs.visual_interests.join("\n");
    document.getElementById("prefMust").value = savedPrefs.must_haves.join("\n");
    document.getElementById("prefDeal").value = savedPrefs.deal_breakers.join("\n");
    document.getElementById("prefBudget").value = savedPrefs.budget_max == null ? "" : String(savedPrefs.budget_max);
    document.getElementById("prefBudgetPeriod").value = savedPrefs.budget_period || "";
    document.getElementById("prefCommute").value = savedPrefs.max_commute_minutes == null ? "" : String(savedPrefs.max_commute_minutes);
    document.getElementById("prefStart").value = savedPrefs.preferred_start_month ? savedPrefs.preferred_start_month.slice(0, 7) : "";
    document.getElementById("prefHours").value = savedPrefs.care_schedule.hours || "";
    document.getElementById("applyTourLearning").checked = savedPrefs.apply_tour_learning;
    armedPreview = "";
    document.getElementById("prefPreview").innerHTML = "";
    renderSuggestions();
  }

  function readPreferences() {
    return {
      preferred_installations: document.getElementById("prefInstallations").value,
      preferred_jurisdictions: [].map.call(document.querySelectorAll('#prefForm input[name="jurisdiction"]:checked'), function (box) { return box.value; }),
      age_room_interests: document.getElementById("prefAges").value,
      visual_interests: document.getElementById("prefVisual").value,
      must_haves: document.getElementById("prefMust").value,
      deal_breakers: document.getElementById("prefDeal").value,
      budget_max: document.getElementById("prefBudget").value,
      budget_period: document.getElementById("prefBudgetPeriod").value,
      max_commute_minutes: document.getElementById("prefCommute").value,
      preferred_start_month: document.getElementById("prefStart").value,
      care_schedule: { hours: document.getElementById("prefHours").value },
      apply_tour_learning: document.getElementById("applyTourLearning").checked
    };
  }

  function renderSuggestions() {
    var box = document.getElementById("suggestions");
    if (!document.getElementById("applyTourLearning").checked) {
      box.innerHTML = "";
      return;
    }
    var items = Family.suggestedFromTours(tours);
    if (!items.length) {
      box.innerHTML = '<p class="muted">No must-have suggestions on your tours yet.</p>';
      return;
    }
    box.innerHTML = '<p class="muted">Suggestions from your private tours. Adding them only fills the box. Save still waits for a preview.</p><ul>' +
      items.map(function (item) { return "<li>" + Family.esc(item) + "</li>"; }).join("") + "</ul>" +
      '<button type="button" class="btn ghost" id="useSuggestions">Add suggestions to must-haves</button>';
    document.getElementById("useSuggestions").onclick = function () {
      var current = document.getElementById("prefMust").value.trim();
      document.getElementById("prefMust").value = (current ? current + "\n" : "") + items.join("\n");
      armedPreview = "";
      setStatus("prefStatus", "Suggestions are in the must-haves box. Preview the change before saving.");
    };
  }

  function requireUser(statusId) {
    var user = sessionUser();
    if (!user) {
      setStatus(statusId, "Sign in to save. This page does not store anything until you do.");
      return null;
    }
    return user;
  }

  function bootForm() {
    var photo = document.getElementById("photoPermission");
    photo.innerHTML = Family.PHOTO_PERMISSIONS.map(function (item) {
      return '<option value="' + Family.esc(item.id) + '">' + Family.esc(item.label) + "</option>";
    }).join("");
    var checklist = document.getElementById("checklist");
    checklist.innerHTML = Family.INFANT_FIELDS.map(function (pair) {
      return '<label>' + Family.esc(pair[1]) + '<input id="check-' + pair[0] + '" type="text"></label>';
    }).join("");
    document.getElementById("followUps").appendChild(followUpRow({}));
    bindSearch("tourSchoolSearch", "tourSchoolList", "tourSchoolId", "tourSchoolLabel");
    bindSearch("openingSchoolSearch", "openingSchoolList", "openingSchoolId", "openingSchoolLabel");
    fillTour(null);
  }

  function saveTour(event) {
    event.preventDefault();
    var prepared = Family.normalizeTour(readTourForm());
    if (!prepared.ok) {
      setStatus("tourStatus", prepared.errors.join(" "));
      return;
    }
    var user = requireUser("tourStatus");
    if (!user) return;
    setStatus("tourStatus", "Saving…");
    client().then(function (sb) {
      var write = editingId
        ? sb.from("tour_logs").update(prepared.row).eq("id", editingId)
        : sb.from("tour_logs").insert(Object.assign({ user_id: user.id }, prepared.row));
      return write.then(function (result) {
        if (result.error) {
          setStatus("tourStatus", result.error.message || "The tour was not saved.");
          return;
        }
        setStatus("tourStatus", "Saved to your account. It is private.");
        fillTour(null);
        return loadTours(sb, user.id);
      });
    }).catch(function () {
      setStatus("tourStatus", "The tour was not saved.");
    });
  }

  function saveOpening(event) {
    event.preventDefault();
    var prepared = Family.openingReport({
      school_id: document.getElementById("openingSchoolId").value,
      age_room: document.getElementById("ageRoom").value,
      status: document.getElementById("openingStatus").value,
      age_min_months: document.getElementById("ageMin").value,
      age_max_months: document.getElementById("ageMax").value,
      available_places: document.getElementById("places").value,
      opens_on: document.getElementById("opensOn").value,
      observed_on: document.getElementById("observedOn").value,
      waitlist_estimate: document.getElementById("waitlistEstimate").value,
      public_note: document.getElementById("publicNote").value,
      adult_attested: document.getElementById("adultAttested").checked
    }, new Date());
    if (!prepared.ok) {
      setStatus("openingStatusLine", prepared.errors.join(" "));
      return;
    }
    if (!requireUser("openingStatusLine")) return;
    setStatus("openingStatusLine", "Saving…");
    client().then(function (sb) {
      return sb.from("openings_reports").insert(prepared.row).then(function (result) {
        if (result.error) {
          setStatus("openingStatusLine", result.error.message || "The report was not saved.");
          return;
        }
        setStatus("openingStatusLine", "Saved for review. It is not public, and it stays an unconfirmed family report unless a provider confirms it.");
        document.getElementById("openingForm").reset();
        document.getElementById("openingStatus").value = "unknown";
        return loadOpenings(sb);
      });
    }).catch(function () {
      setStatus("openingStatusLine", "The report was not saved.");
    });
  }

  function previewPreferences() {
    var prepared = Family.preferencePayload(readPreferences());
    if (!prepared.ok) {
      armedPreview = "";
      document.getElementById("prefPreview").innerHTML = "";
      setStatus("prefStatus", prepared.errors.join(" "));
      return;
    }
    var changes = Family.preferenceDiff(savedPrefs, prepared.row);
    document.getElementById("prefPreview").innerHTML = Family.preferenceDiffHtml(changes);
    armedPreview = JSON.stringify(prepared.row);
    setStatus("prefStatus", changes.length ? "Review the change above. Saving writes only these family preferences." : "Nothing changed. The older match settings were left alone.");
  }

  function savePreferences(event) {
    event.preventDefault();
    var user = requireUser("prefStatus");
    if (!user) return;
    var prepared = Family.preferencePayload(readPreferences(), user.id);
    if (!prepared.ok) {
      setStatus("prefStatus", prepared.errors.join(" "));
      return;
    }
    var comparable = Object.assign({}, prepared.row);
    delete comparable.user_id;
    if (JSON.stringify(comparable) !== armedPreview) {
      setStatus("prefStatus", "Preview the latest change before saving.");
      return;
    }
    setStatus("prefStatus", "Saving…");
    client().then(function (sb) {
      var patch = Object.assign({}, prepared.row);
      delete patch.user_id;
      return sb.from("user_preferences").update(patch).eq("user_id", user.id).select("user_id").then(function (updated) {
        if (updated.error) return updated;
        if (updated.data && updated.data.length) return updated;
        return sb.from("user_preferences").insert(prepared.row);
      }).then(function (result) {
        if (result.error) {
          setStatus("prefStatus", result.error.message || "Preferences were not saved.");
          return;
        }
        fillPreferences(prepared.row);
        setStatus("prefStatus", "Saved. Find can use these must-haves. The older preferences table was not changed.");
      });
    }).catch(function () {
      setStatus("prefStatus", "Preferences were not saved.");
    });
  }

  function loadDirectory(sb) {
    return window.NearBaseDirectory.fetchDirectorySchools(sb).then(function (result) {
      schools = result && result.ok ? result.schools : [];
      if (!schools.length) setStatus("tourStatus", result && result.message ? result.message : "The directory did not load, so a school cannot be chosen yet.");
    });
  }

  bootForm();
  document.getElementById("addFollowUp").addEventListener("click", function () {
    document.getElementById("followUps").appendChild(followUpRow({}));
  });
  document.getElementById("resetTour").addEventListener("click", function () { fillTour(null); setStatus("tourStatus", ""); });
  document.getElementById("tourForm").addEventListener("submit", saveTour);
  document.getElementById("openingForm").addEventListener("submit", saveOpening);
  document.getElementById("previewPrefs").addEventListener("click", previewPreferences);
  document.getElementById("prefForm").addEventListener("submit", savePreferences);
  document.getElementById("applyTourLearning").addEventListener("change", function () {
    armedPreview = "";
    renderSuggestions();
  });
  document.getElementById("tourList").addEventListener("click", function (event) {
    var edit = event.target.closest("[data-edit]");
    var remove = event.target.closest("[data-delete]");
    if (edit) {
      var tour = tours.filter(function (item) { return item.id === edit.getAttribute("data-edit"); })[0];
      if (tour) {
        fillTour(tour);
        document.getElementById("tourForm").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    if (remove && sessionUser() && window.confirm("Delete this private tour log?")) {
      client().then(function (sb) {
        return sb.from("tour_logs").delete().eq("id", remove.getAttribute("data-delete")).then(function () {
          return loadTours(sb, sessionUser().id);
        });
      });
    }
  });
  document.getElementById("magicForm").addEventListener("submit", function (event) {
    event.preventDefault();
    setStatus("magicStatus", "Sending…");
    window.NearBaseAccount.sendMagicLink(document.getElementById("magicEmail").value.trim(), "/my-tours.html").then(function (result) {
      setStatus("magicStatus", result.ok ? "Check your email for the sign-in link." : (result.reason || "Try again in a minute."));
    });
  });

  window.NearBaseAccount.ready().then(function () {
    var user = sessionUser();
    var banner = document.getElementById("authBanner");
    if (!user) {
      banner.innerHTML = "<strong>Sign in to save.</strong> You can read the form first. Nothing is stored until you are signed in.";
      return client().then(function (sb) {
        if (sb) return loadDirectory(sb);
      });
    }
    banner.innerHTML = "<strong>Signed in as " + Family.esc(user.email || "your account") + ".</strong> Tour logs and must-haves stay on this account.";
    document.getElementById("magicForm").hidden = true;
    return client().then(function (sb) {
      if (!sb) return;
      return loadDirectory(sb).then(function () {
        return Promise.all([
          loadTours(sb, user.id),
          loadOpenings(sb),
          sb.from("user_preferences").select("preferred_installations,preferred_jurisdictions,age_room_interests,must_haves,deal_breakers,visual_interests,budget_max,budget_period,max_commute_minutes,preferred_start_month,care_schedule,apply_tour_learning").eq("user_id", user.id).then(function (result) {
            if (result && result.data && result.data[0]) fillPreferences(result.data[0]);
          })
        ]);
      });
    });
  }).catch(function () {});
})();
