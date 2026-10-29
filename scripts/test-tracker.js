#!/usr/bin/env node
var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var Tracker = require(path.join(root, "site/tracker.js"));
var Match = require(path.join(root, "site/match.js"));

var failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log("ok  " + name);
  } catch (err) {
    failures++;
    console.error("FAIL " + name);
    console.error("     " + (err && err.message));
  }
}

var BANNED = /guaranteed|reserved|priority|secured|\bodds\b|likelihood|chance of|held spot/i;

check("status change to applied fills the applied date and a 60-day follow-up", function () {
  var result = Tracker.changeStatus({ school_name: "Example", status: "researching" }, "applied", "2026-10-29");
  assert.strictEqual(result.error, undefined);
  assert.strictEqual(result.entry.status, "applied");
  assert.strictEqual(result.entry.applied_date, "2026-10-29");
  assert.strictEqual(result.entry.follow_up_date, "2026-12-28");
});

check("follow-up math is 60 days and stays on the calendar", function () {
  assert.strictEqual(Tracker.FOLLOW_UP_DAYS, 60);
  assert.strictEqual(Tracker.addDays("2026-10-29", 60), "2026-12-28");
  assert.strictEqual(Tracker.addDays("2024-02-01", 60), "2024-04-01");
  assert.strictEqual(Tracker.addDays("2025-12-31", 1), "2026-01-01");
  assert.strictEqual(Tracker.defaultFollowUp("2026-01-01"), Tracker.addDays("2026-01-01", 60));
});

check("a custom follow-up is kept when the status changes", function () {
  var result = Tracker.changeStatus({
    school_name: "Example",
    status: "applied",
    applied_date: "2026-01-01",
    follow_up_date: "2026-02-01"
  }, "waitlisted", "2026-10-29");
  assert.strictEqual(result.entry.status, "waitlisted");
  assert.strictEqual(result.entry.applied_date, "2026-01-01");
  assert.strictEqual(result.entry.follow_up_date, "2026-02-01");
});

check("closed statuses do not invent a follow-up", function () {
  ["accepted", "declined", "withdrawn"].forEach(function (status) {
    var result = Tracker.prepareEntry({
      school_name: "Example",
      status: status,
      applied_date: "2026-01-01",
      follow_up_date: ""
    }, "2026-10-29");
    assert.strictEqual(result.entry.status, status);
    assert.strictEqual(result.entry.follow_up_date, "");
  });
});

check("unknown status is rejected", function () {
  var result = Tracker.changeStatus({ school_name: "Example" }, "priority", "2026-10-29");
  assert.ok(result.error);
});

check("blank school name is rejected and fees cannot be negative", function () {
  assert.ok(Tracker.prepareEntry({ school_name: "  " }, "2026-10-29").error);
  var result = Tracker.prepareEntry({ school_name: "Example", fees_paid: -20, status: "researching" }, "2026-10-29");
  assert.strictEqual(result.entry.fees_paid, 0);
});

check("move-date flag is only when the desired start is after the move", function () {
  assert.strictEqual(Tracker.startsAfterMove("2027-09-01", "2027-06-15"), true);
  assert.strictEqual(Tracker.startsAfterMove("2027-06-15", "2027-06-15"), false);
  assert.strictEqual(Tracker.startsAfterMove("2027-03-02", "2027-06-15"), false);
  assert.strictEqual(Tracker.startsAfterMove("", "2027-06-15"), false);
  assert.strictEqual(Tracker.startsAfterMove("2027-09-01", ""), false);
});

check("follow-up list is overdue, then upcoming within 14 days", function () {
  var today = "2026-10-29";
  function row(name, follow) {
    return { school_name: name, follow_up_date: follow, status: "applied", applied_date: "2026-01-01" };
  }
  assert.strictEqual(Tracker.followUpState(today, today), "upcoming");
  assert.strictEqual(Tracker.followUpState(Tracker.addDays(today, 14), today), "upcoming");
  assert.strictEqual(Tracker.followUpState(Tracker.addDays(today, 15), today), "later");
  assert.strictEqual(Tracker.followUpState(Tracker.addDays(today, -1), today), "overdue");
  var list = Tracker.followUpList([
    row("Later", Tracker.addDays(today, 40)),
    row("Soon", Tracker.addDays(today, 3)),
    row("Late", Tracker.addDays(today, -4))
  ], today);
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].entry.school_name, "Late");
  assert.strictEqual(list[0].state, "overdue");
  assert.strictEqual(list[1].entry.school_name, "Soon");
  assert.strictEqual(list[1].state, "upcoming");
});

check("sample timeline flags starts after the move and lists two follow-ups", function () {
  var model = Tracker.sampleModel("2026-10-29");
  var follow = Tracker.followUpList(model.entries, model.today);
  assert.strictEqual(follow.length, 2);
  assert.strictEqual(follow[0].state, "overdue");
  assert.strictEqual(follow[1].state, "upcoming");
  var events = Tracker.timeline(model.entries, model.moveDate);
  assert.ok(events.some(function (event) { return event.kind === "move" && event.date === "2027-06-15"; }));
  assert.strictEqual(events.filter(function (event) { return event.afterMove; }).length, 2);
  assert.strictEqual(events[0].date <= events[1].date && events[1].date <= events[2].date, true);
});

check("worth a waitlist is distance, cost, hours, and match score only", function () {
  var school = {
    slug: "example",
    name: "Example School",
    loc: "Arlington, VA",
    lat: 38.88,
    lng: -77.1,
    score: "80",
    tier: "hi",
    badges: [{ t: "6:30am-6pm" }, { t: "MCCYN" }, { t: "12-18 month wait" }],
    quote: "Full day care with a 12-18 month wait.",
    tags: ["toddler"]
  };
  var profile = Match.defaultProfile();
  profile.hours = "early";
  profile.costCeiling = "assist";
  var factors = Tracker.fitFactors(Match.scoreSchool(school, profile));
  assert.deepStrictEqual(factors.map(function (factor) { return factor.id; }), ["distance", "cost", "hours", "match"]);
  var text = factors.map(function (factor) { return factor.label + " " + factor.detail; }).join(" ");
  assert.ok(/MCCYN/.test(text));
  assert.ok(/Family match \d+ out of 100/.test(text));
  assert.ok(!/month wait/i.test(text));
  assert.ok(!BANNED.test(text));
  var openProfile = Match.defaultProfile();
  var openFactors = Tracker.fitFactors(Match.scoreSchool(school, openProfile));
  var hours = openFactors.filter(function (factor) { return factor.id === "hours"; })[0];
  assert.ok(/6:30am-6pm|Listing hours/.test(hours.detail));
});

check("csv export quotes commas and does not leave a formula cell", function () {
  var csv = Tracker.toCsv([{
    school_name: 'Say "hi", please',
    school_slug: "example",
    status: "applied",
    applied_date: "2026-01-01",
    fees_paid: 10,
    desired_start_date: "2026-08-01",
    follow_up_date: "2026-03-02",
    contacts: "Pat",
    stated_process: "line1\nline2",
    notes: "=cmd"
  }], "2026-06-01");
  assert.ok(csv.indexOf('"Say ""hi"", please"') !== -1);
  assert.ok(csv.indexOf("\"line1\nline2\"") !== -1);
  assert.ok(csv.indexOf("'=cmd") !== -1);
  assert.ok(/,yes\r\n$/.test(csv));
  var sameDay = Tracker.toCsv([{
    school_name: "Same day",
    desired_start_date: "2026-06-01",
    status: "researching"
  }], "2026-06-01");
  assert.ok(/,no\r\n$/.test(sameDay));
});

check("rendered tracker shows the disclaimer and no odds language", function () {
  var html = Tracker.renderTracker(Tracker.sampleModel("2026-10-29"));
  assert.ok(html.indexOf(Tracker.DISCLAIMER) !== -1);
  assert.ok(html.indexOf("Follow up") !== -1);
  assert.ok(html.indexOf("Worth a waitlist?") !== -1);
  var without = html.split(Tracker.DISCLAIMER).join("");
  assert.ok(!BANNED.test(without));
  assert.ok(!/hold spots/i.test(without));
  var empty = Tracker.renderTracker({ entries: [], today: "2026-10-29" });
  assert.ok(empty.indexOf("No schools yet") !== -1);
  assert.ok(empty.indexOf(Tracker.DISCLAIMER) !== -1);
});

check("schema keeps waitlist rows private to the signed-in family", function () {
  var sql = fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8");
  assert.ok(/create table if not exists public\.waitlist_entries/.test(sql));
  assert.ok(/alter table public\.waitlist_entries enable row level security/.test(sql));
  ["read own waitlist", "insert own waitlist", "update own waitlist", "delete own waitlist"].forEach(function (name) {
    assert.ok(sql.indexOf('"' + name + '"') !== -1, name);
  });
  var policies = sql.split("waitlist_entries enable row level security")[1] || "";
  assert.ok(/user_id = auth\.uid\(\)/.test(policies));
  assert.ok(!/for select using \(true\)/.test(policies));
  assert.ok(/pcs_date date/.test(sql));
  assert.ok(/waitlist_status_check/.test(sql));
});

check("privacy page and setup notes mention the private tracker", function () {
  var privacy = fs.readFileSync(path.join(root, "site/privacy.html"), "utf8");
  assert.ok(/Waitlist tracker/.test(privacy));
  assert.ok(/not shared with schools/i.test(privacy));
  var setup = fs.readFileSync(path.join(root, "docs/SUBSCRIPTIONS_SETUP.md"), "utf8");
  assert.ok(/waitlist_entries/.test(setup));
  var future = fs.readFileSync(path.join(root, "docs/future/extra-help-addons.md"), "utf8");
  assert.ok(/anonymous wait-time survey/i.test(future));
  assert.ok(/not built/i.test(future));
});

if (failures) {
  console.error(failures + " failed");
  process.exit(1);
}
console.log("tracker tests passed");
