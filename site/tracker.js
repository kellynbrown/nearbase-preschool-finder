// Personal waitlist tracker. Dates and status rules only.
// Nothing here estimates whether a school will offer a seat.
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NearBaseTracker = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var STATUSES = ["researching", "applied", "waitlisted", "offered", "accepted", "declined", "withdrawn"];
  var STATUS_LABEL = {
    researching: "Researching",
    applied: "Applied",
    waitlisted: "Waitlisted",
    offered: "Offered",
    accepted: "Accepted",
    declined: "Declined",
    withdrawn: "Withdrawn"
  };
  var FOLLOW_UP_DAYS = 60;
  var UPCOMING_DAYS = 14;
  var DISCLAIMER = "NearBase helps you keep track. Each school runs its own waitlist and makes all enrollment decisions. NearBase does not submit applications, hold spots, or contact schools for you.";
  var HELPER = "Fit only: distance, cost, hours, and your match score. This does not estimate whether a school will offer a seat.";
  var ACTIVE = { applied: true, waitlisted: true, offered: true };

  function two(n) { return (n < 10 ? "0" : "") + n; }

  function dateOrEmpty(value) {
    var text = String(value == null ? "" : value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
  }

  function parseISODate(value) {
    var text = dateOrEmpty(value);
    if (!text) return null;
    var parts = text.split("-");
    return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  }

  function formatISODate(date) {
    return date.getUTCFullYear() + "-" + two(date.getUTCMonth() + 1) + "-" + two(date.getUTCDate());
  }

  function todayISO(now) {
    var clock = now instanceof Date ? now : new Date();
    return clock.getFullYear() + "-" + two(clock.getMonth() + 1) + "-" + two(clock.getDate());
  }

  function addDays(iso, days) {
    var date = parseISODate(iso);
    if (!date || !isFinite(days)) return "";
    date.setUTCDate(date.getUTCDate() + Number(days));
    return formatISODate(date);
  }

  function defaultFollowUp(appliedDate) {
    return addDays(appliedDate, FOLLOW_UP_DAYS);
  }

  function startsAfterMove(desiredStart, moveDate) {
    var start = dateOrEmpty(desiredStart);
    var move = dateOrEmpty(moveDate);
    if (!start || !move) return false;
    return start > move;
  }

  function followUpState(followUp, today) {
    var when = dateOrEmpty(followUp);
    var now = dateOrEmpty(today);
    if (!when || !now) return "none";
    if (when < now) return "overdue";
    if (when <= addDays(now, UPCOMING_DAYS)) return "upcoming";
    return "later";
  }

  function money(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return 0;
    return Math.round(n * 100) / 100;
  }

  function normalizeEntry(input) {
    var src = input || {};
    var status = STATUSES.indexOf(src.status) !== -1 ? src.status : "researching";
    return {
      id: String(src.id || ""),
      school_slug: String(src.school_slug || src.schoolSlug || "").trim(),
      school_name: String(src.school_name || src.schoolName || "").trim(),
      applied_date: dateOrEmpty(src.applied_date || src.appliedDate),
      fees_paid: money(src.fees_paid != null ? src.fees_paid : src.feesPaid),
      desired_start_date: dateOrEmpty(src.desired_start_date || src.desiredStartDate),
      status: status,
      notes: String(src.notes || ""),
      stated_process: String(src.stated_process || src.statedProcess || ""),
      follow_up_date: dateOrEmpty(src.follow_up_date || src.followUpDate),
      contacts: String(src.contacts || "")
    };
  }

  function prepareEntry(raw, today) {
    var entry = normalizeEntry(raw);
    var day = dateOrEmpty(today) || todayISO();
    if (!entry.school_name) return { error: "Add a school name." };
    if (ACTIVE[entry.status] && !entry.applied_date) entry.applied_date = day;
    var closed = entry.status === "accepted" || entry.status === "declined" || entry.status === "withdrawn";
    if (!closed && entry.applied_date && !entry.follow_up_date) {
      entry.follow_up_date = defaultFollowUp(entry.applied_date);
    }
    return { entry: entry };
  }

  function changeStatus(entry, status, today) {
    if (STATUSES.indexOf(status) === -1) return { error: "Unknown status." };
    var next = normalizeEntry(entry);
    next.status = status;
    return prepareEntry(next, today);
  }

  function followUpList(entries, today) {
    return (entries || []).map(function (entry) {
      var item = normalizeEntry(entry);
      return { entry: item, state: followUpState(item.follow_up_date, today) };
    }).filter(function (item) {
      return item.state === "overdue" || item.state === "upcoming";
    }).sort(function (a, b) {
      if (a.state !== b.state) return a.state === "overdue" ? -1 : 1;
      if (a.entry.follow_up_date < b.entry.follow_up_date) return -1;
      if (a.entry.follow_up_date > b.entry.follow_up_date) return 1;
      return a.entry.school_name.localeCompare(b.entry.school_name);
    });
  }

  function timeline(entries, moveDate) {
    var events = [];
    var move = dateOrEmpty(moveDate);
    if (move) events.push({ kind: "move", date: move, label: "PCS move date", afterMove: false });
    (entries || []).forEach(function (entry) {
      var item = normalizeEntry(entry);
      if (!item.desired_start_date) return;
      var after = startsAfterMove(item.desired_start_date, move);
      events.push({
        kind: "start",
        date: item.desired_start_date,
        label: item.school_name,
        afterMove: after,
        id: item.id
      });
    });
    events.sort(function (a, b) {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      if (a.kind !== b.kind) return a.kind === "move" ? -1 : 1;
      return String(a.label).localeCompare(String(b.label));
    });
    return events;
  }

  function evidence(text) {
    var clean = String(text || "").trim();
    return clean ? " (" + clean + ")" : "";
  }

  function costLine(signals, costCeiling) {
    var src = signals || {};
    var bits = [];
    if (src.subsidy) bits.push("The listing shows a free or subsidized option" + evidence(src.subsidyEvidence) + ".");
    if (src.mccyn) bits.push("The listing notes MCCYN" + evidence(src.mccynEvidence) + ".");
    if (src.discount) bits.push("The listing notes military pricing" + evidence(src.discountEvidence) + ".");
    if (src.onPost && !src.mccyn && !src.subsidy) bits.push("The listing marks the program on-post.");
    if (!bits.length) bits.push("Tuition is not written in this listing. A missing price is not treated as a dollar amount.");
    if (costCeiling === "free" && !src.subsidy) {
      bits.push("Your profile is set to free seats, and this listing does not show one.");
    } else if ((costCeiling === "assist") && !src.subsidy && !src.mccyn && !src.onPost) {
      bits.push("Your profile looks for a free seat, subsidy, or MCCYN, and this listing does not show one.");
    }
    return bits.join(" ");
  }

  function fitFactors(match) {
    var src = match || {};
    var factors = src.factors || [];
    function byId(id) {
      for (var i = 0; i < factors.length; i++) if (factors[i].id === id) return factors[i];
      return null;
    }
    var distance = byId("distance");
    var hours = byId("hours");
    var distanceDetail = distance && distance.detail
      ? distance.detail
      : (typeof src.distanceMiles === "number"
        ? "About " + src.distanceMiles.toFixed(1) + " straight-line miles. Drive time is not estimated."
        : "Distance is not in this listing.");
    var listedHours = src.signals && src.signals.hours;
    var hoursDetail = hours && hours.detail
      ? hours.detail
      : (listedHours && listedHours.known
        ? "Listing hours: " + (listedHours.evidence || "included") + ". Your profile does not set an hours preference, so this is not filtering the match."
        : "Open and close times are not in this listing.");
    var scoreDetail = src.score == null
      ? "Not enough listing data for a match score."
      : "Family match " + src.score + " out of 100. The score compares this listing with the profile you saved. It is not an estimate of getting a seat.";
    var ceiling = src.profile && src.profile.costCeiling;
    return [
      { id: "distance", label: "Distance", detail: distanceDetail },
      { id: "cost", label: "Cost", detail: costLine(src.signals, ceiling) },
      { id: "hours", label: "Hours", detail: hoursDetail },
      { id: "match", label: "Match score", detail: scoreDetail }
    ];
  }

  function csvCell(value) {
    var text = String(value == null ? "" : value);
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    if (/[",\n\r]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function toCsv(entries, moveDate) {
    var headers = [
      "school_name", "school_slug", "status", "applied_date", "fees_paid",
      "desired_start_date", "follow_up_date", "contacts", "stated_process",
      "notes", "starts_after_move"
    ];
    var lines = [headers.join(",")];
    (entries || []).forEach(function (raw) {
      var entry = normalizeEntry(raw);
      lines.push([
        entry.school_name,
        entry.school_slug,
        entry.status,
        entry.applied_date,
        entry.fees_paid.toFixed(2),
        entry.desired_start_date,
        entry.follow_up_date,
        entry.contacts,
        entry.stated_process,
        entry.notes,
        startsAfterMove(entry.desired_start_date, moveDate) ? "yes" : "no"
      ].map(csvCell).join(","));
    });
    return lines.join("\r\n") + "\r\n";
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function timingLabel(id) {
    return {
      now: "in the next few months",
      summer: "this coming cycle",
      planning: "further out",
      unsure: "not set"
    }[id] || "";
  }

  function renderWorth(factors, options) {
    var opts = options || {};
    var rows = (factors || []).map(function (factor) {
      return "<li><strong>" + esc(factor.label) + ".</strong> " + esc(factor.detail) + "</li>";
    }).join("");
    var body = opts.unlinked
      ? '<p class="nb-meta">This name is not linked to a NearBase listing, so there is no distance, cost, hours, or match score to show.</p>'
      : '<ul class="nb-why">' + rows + "</ul>";
    var note = opts.disclaimer ? '<p class="nb-meta">' + esc(DISCLAIMER) + "</p>" : "";
    return '<div class="worth"><h3>Worth a waitlist?</h3><p class="nb-meta">' + esc(HELPER) + "</p>" + body + note + "</div>";
  }

  function statusOptions(selected) {
    return STATUSES.map(function (status) {
      var on = status === selected ? " selected" : "";
      return '<option value="' + status + '"' + on + ">" + esc(STATUS_LABEL[status]) + "</option>";
    }).join("");
  }

  function renderTracker(model) {
    var src = model || {};
    var today = dateOrEmpty(src.today) || todayISO();
    var moveDate = dateOrEmpty(src.moveDate);
    var entries = (src.entries || []).map(normalizeEntry);
    var fits = src.fits || {};
    var follow = followUpList(entries, today);
    var events = timeline(entries, moveDate);
    var timing = timingLabel(src.timing);

    var followHtml = follow.length
      ? '<ul class="clean follow">' + follow.map(function (item) {
        var word = item.state === "overdue" ? "Overdue" : "Coming up";
        var href = item.entry.id ? "#entry-" + esc(item.entry.id) : "#tracker";
        return '<li class="row"><a href="' + href + '">' + esc(item.entry.school_name) + "</a><span class=\"pill\">" + word + " · " + esc(item.entry.follow_up_date) + "</span></li>";
      }).join("") + "</ul>"
      : '<p class="muted">Nothing to follow up on right now.</p>';

    var timeHtml = events.length
      ? '<ol class="timeline">' + events.map(function (event) {
        if (event.kind === "move") {
          return '<li class="move"><time datetime="' + esc(event.date) + '">' + esc(event.date) + "</time> PCS move date</li>";
        }
        var flag = event.afterMove ? " Desired start is after your PCS move date." : "";
        var klass = event.afterMove ? ' class="after"' : "";
        return "<li" + klass + '><time datetime="' + esc(event.date) + '">' + esc(event.date) + "</time> " + esc(event.label) + " · desired start." + esc(flag) + "</li>";
      }).join("") + "</ol>"
      : '<p class="muted">Add a desired start, or a PCS move date, to see the timeline.</p>';

    var timingNote = timing
      ? "Profile timing: " + timing + ". That is a window, not the move date."
      : "Profile timing is not set.";
    if (!moveDate) timingNote += " Add a PCS move date to flag a desired start that falls after the move.";

    var entryHtml = entries.length ? entries.map(function (entry) {
      var after = startsAfterMove(entry.desired_start_date, moveDate);
      var flag = after
        ? '<p class="flag">Desired start is after your PCS move date. This is a calendar check. The school decides enrollment.</p>'
        : "";
      var fit = fits[entry.id];
      var worth = renderWorth(fit || [], { unlinked: !entry.school_slug });
      var link = entry.school_slug
        ? ' <a href="/school/' + esc(entry.school_slug) + '.html">Listing</a>'
        : "";
      return '<form class="entry" id="entry-' + esc(entry.id) + '" data-id="' + esc(entry.id) + '" data-slug="' + esc(entry.school_slug) + '">' +
        '<div class="row"><label class="name-field">School <input name="school_name" value="' + esc(entry.school_name) + '" required></label>' +
        '<label>Status <select name="status">' + statusOptions(entry.status) + "</select></label></div>" +
        '<p class="muted">Directory link:' + (link || " none. This name stays as you typed it.") + "</p>" +
        '<div class="track-grid">' +
        '<label>Date applied <input type="date" name="applied_date" value="' + esc(entry.applied_date) + '"></label>' +
        '<label>Fees paid <input type="number" name="fees_paid" min="0" step="0.01" value="' + esc(entry.fees_paid.toFixed(2)) + '"></label>' +
        '<label>Desired start <input type="date" name="desired_start_date" value="' + esc(entry.desired_start_date) + '"></label>' +
        '<label>Next follow-up <input type="date" name="follow_up_date" value="' + esc(entry.follow_up_date) + '"></label>' +
        '<label class="span-2">Contacts <input name="contacts" value="' + esc(entry.contacts) + '" placeholder="Who you talked to, and how to reach them"></label>' +
        '<label class="span-2">School\'s stated process <textarea name="stated_process">' + esc(entry.stated_process) + "</textarea></label>" +
        '<label class="span-2">Your notes <textarea name="notes">' + esc(entry.notes) + "</textarea></label>" +
        "</div>" + flag + worth +
        '<div class="actions"><button class="btn" type="submit">Save entry</button><button class="btn danger" type="button" data-track-delete>Delete</button></div>' +
        "</form>";
    }).join("") : '<p class="muted">No schools yet. Add one below, or use Add to tracker on a listing.</p>';

    return '<div id="trackerRoot">' +
      '<div class="row"><h2>Waitlist tracker</h2><span class="pill">Free</span></div>' +
      '<p class="muted">Only you can see this. It is not shared with schools or other families.</p>' +
      '<p class="disclaimer" role="note">' + esc(DISCLAIMER) + "</p>" +
      '<form id="pcsForm" class="stack"><label>PCS move date <input type="date" id="pcsDateInput" value="' + esc(moveDate) + '"></label><button class="btn ghost" type="submit">Save move date</button></form>' +
      '<p class="muted" id="pcsNote">' + esc(timingNote) + "</p>" +
      "<h3 class=\"sub\">Follow up</h3>" +
      '<p class="muted">Overdue dates, and dates in the next ' + UPCOMING_DAYS + " days. The first follow-up is " + FOLLOW_UP_DAYS + " days after the date applied, and you can change it. Reminders stay on this page.</p>" +
      followHtml +
      "<h3 class=\"sub\">Timeline</h3>" +
      timeHtml +
      entryHtml +
      '<form id="trackerAddForm" class="entry">' +
      "<h3 class=\"sub\">Add a school</h3>" +
      '<div class="track-grid"><label class="span-2">School name <input name="school_name" placeholder="A NearBase school, or any name you type" required></label></div>' +
      '<div class="actions"><button class="btn" type="submit">Add to tracker</button><button class="btn ghost" type="button" id="trackerExport">Export CSV</button></div>' +
      "</form></div>";
  }

  function sampleModel(today) {
    var day = dateOrEmpty(today) || "2026-10-29";
    return {
      today: day,
      moveDate: "2027-06-15",
      timing: "planning",
      entries: [
        normalizeEntry({
          id: "sample-gardner",
          school_slug: "the-gardner-school-arlington",
          school_name: "The Gardner School Arlington",
          applied_date: addDays(day, -70),
          fees_paid: 150,
          desired_start_date: "2027-09-01",
          status: "waitlisted",
          notes: "Asked about a September start. They said they will call if a seat opens.",
          stated_process: "Tour, then an application fee, then their own list.",
          follow_up_date: addDays(day, -10),
          contacts: "Admissions desk"
        }),
        normalizeEntry({
          id: "sample-folks",
          school_slug: "little-folks-school",
          school_name: "Little Folks School",
          applied_date: addDays(day, -20),
          fees_paid: 50,
          desired_start_date: "2027-03-02",
          status: "applied",
          notes: "Director said the next step is a classroom visit.",
          stated_process: "Application, then a visit, then their decision.",
          follow_up_date: addDays(day, 7),
          contacts: "Front desk"
        }),
        normalizeEntry({
          id: "sample-coop",
          school_slug: "",
          school_name: "Neighborhood co-op",
          applied_date: "",
          fees_paid: 0,
          desired_start_date: "2027-08-15",
          status: "researching",
          notes: "Heard about this from another family. Not in the NearBase directory.",
          stated_process: "",
          follow_up_date: addDays(day, 40),
          contacts: ""
        })
      ]
    };
  }

  return {
    STATUSES: STATUSES,
    STATUS_LABEL: STATUS_LABEL,
    FOLLOW_UP_DAYS: FOLLOW_UP_DAYS,
    UPCOMING_DAYS: UPCOMING_DAYS,
    DISCLAIMER: DISCLAIMER,
    HELPER: HELPER,
    dateOrEmpty: dateOrEmpty,
    todayISO: todayISO,
    addDays: addDays,
    defaultFollowUp: defaultFollowUp,
    startsAfterMove: startsAfterMove,
    followUpState: followUpState,
    normalizeEntry: normalizeEntry,
    prepareEntry: prepareEntry,
    changeStatus: changeStatus,
    followUpList: followUpList,
    timeline: timeline,
    fitFactors: fitFactors,
    toCsv: toCsv,
    timingLabel: timingLabel,
    renderWorth: renderWorth,
    renderTracker: renderTracker,
    sampleModel: sampleModel,
    esc: esc
  };
});
