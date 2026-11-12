#!/usr/bin/env node
// Family loop: private tour fields, openings labels, preference preview,
// compare rows, and the photo/tour allowlist. No network and no seed.
var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var family = require(path.join(root, "site/family-loop.js"));

var failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log("  ok  " + name);
  } catch (error) {
    failures += 1;
    console.error("  FAIL  " + name);
    console.error(error && error.stack || error);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

check("tour log keeps would-enroll, checklist, follow-up, and photo permission private", function () {
  var legacy = { base_id: "pentagon", quiz_votes: { cost_free: 1 } };
  var before = JSON.stringify(legacy);
  var result = family.normalizeTour({
    school_id: "example-school",
    visited_on: "2026-11-11",
    rating: "4",
    would_enroll: "YES",
    likes: "Happy infants\nOutdoor time",
    dislikes: "Little spoken language",
    infant_checklist: {
      ratio: "1:5",
      age_range: "3-18 months",
      outdoor_plan: "Dedicated infant yard",
      language_exposure: "A concern",
      dropoff_flexibility: "Flexible",
      meals: "Optional",
      child_name: "must not be stored"
    },
    quoted_cost: "1800",
    quoted_cost_period: "month",
    follow_ups: [{ task: "Ask about openings", contact_role: "business manager", due: "2026-11-14", status: "open" }],
    photo_permission: "not_possible_during_tour_rooms_in_use",
    staff_interaction_notes: "Warm room. No names.",
    public_summary_draft: "do not keep this",
    share_publicly: false
  });
  assert.strictEqual(result.ok, true, result.errors.join(" "));
  assert.strictEqual(result.row.would_enroll, "yes");
  assert.strictEqual(result.row.infant_checklist.ratio, "1:5");
  assert.strictEqual(result.row.infant_checklist.child_name, undefined);
  assert.strictEqual(result.row.follow_ups[0].contact_role, "business manager");
  assert.strictEqual(result.row.photo_permission, "not_possible_during_tour_rooms_in_use");
  assert.strictEqual(result.row.share_publicly, false);
  assert.strictEqual(result.row.public_summary_draft, null);
  assert.strictEqual(result.row.quoted_cost, 1800);
  assert.strictEqual(result.row.user_id, undefined);
  assert.strictEqual(JSON.stringify(legacy), before);
});

check("an empty follow-up row is optional and a partial one is rejected", function () {
  var blank = family.normalizeFollowUps([{ task: "", contact_role: "", due: "", status: "open" }]);
  assert.strictEqual(blank.ok, true);
  assert.deepStrictEqual(blank.value, []);
  var partial = family.normalizeFollowUps([{ task: "Call back", contact_role: "", due: "2026-11-14", status: "open" }]);
  assert.strictEqual(partial.ok, false);
  assert.ok(partial.errors.join(" ").indexOf("contact role") !== -1);
});

check("bad would-enroll and photo values are rejected", function () {
  var result = family.normalizeTour({
    school_id: "example-school",
    visited_on: "2026-11-11",
    would_enroll: "absolutely",
    photo_permission: "scrape the website"
  });
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some(function (error) { return error.indexOf("Would enroll") === 0; }));
  assert.ok(result.errors.some(function (error) { return error.indexOf("photo") !== -1; }));
});

check("opt-in does not create a public summary", function () {
  var result = family.normalizeTour({
    school_id: "example-school",
    visited_on: "2026-11-11",
    share_publicly: true,
    public_summary_draft: "publish my notes"
  });
  assert.strictEqual(result.ok, true, result.errors.join(" "));
  assert.strictEqual(result.row.share_publicly, true);
  assert.strictEqual(result.row.public_summary_draft, null);
});

check("family openings report is dated, expiring, and unconfirmed", function () {
  var result = family.openingReport({
    school_id: "example-school",
    age_room: "Infant",
    status: "unknown",
    observed_on: "2026-11-11",
    opens_on: "2027-05-15",
    adult_attested: true,
    source: "provider",
    provider_confirmed: true,
    public_note: "Circle back. No phone."
  }, new Date("2026-11-12T15:00:00.000Z"));
  assert.strictEqual(result.ok, true, result.errors.join(" "));
  assert.strictEqual(result.row.source, "family_tour");
  assert.strictEqual(result.row.provider_confirmed, undefined);
  assert.strictEqual(result.row.as_of, "2026-11-11T12:00:00.000Z");
  assert.strictEqual(result.row.expires_at, "2026-11-18T12:00:00.000Z");
  var fresh = family.openingFreshness(Object.assign({ provider_confirmed: false }, result.row), new Date("2026-11-12T15:00:00.000Z"));
  assert.strictEqual(fresh.confirmation, "Unconfirmed family report");
  assert.strictEqual(fresh.when, "Reported 1 day ago");
  assert.strictEqual(fresh.stale, false);
  var stale = family.openingFreshness(result.row, new Date("2026-11-20T15:00:00.000Z"));
  assert.strictEqual(stale.expired, true);
  assert.ok(stale.label.indexOf("Expired") === 0);
  assert.ok(stale.label.indexOf("Unconfirmed family report") !== -1);
  var confirmed = family.openingFreshness({
    source: "family_tour",
    provider_confirmed: true,
    as_of: "2026-11-01T12:00:00.000Z",
    expires_at: "2026-11-20T12:00:00.000Z"
  }, new Date("2026-11-12T12:00:00.000Z"));
  assert.strictEqual(confirmed.confirmation, "Provider confirmed");
  assert.strictEqual(confirmed.stale, true);
  assert.strictEqual(confirmed.when, "Reported 11 days ago");
});

check("openings report rejects a future observation and a phone number", function () {
  var future = family.openingReport({
    school_id: "example-school",
    age_room: "Infant",
    observed_on: "2099-01-01",
    adult_attested: true
  }, new Date("2026-11-12T00:00:00.000Z"));
  assert.strictEqual(future.ok, false);
  var phone = family.openingReport({
    school_id: "example-school",
    age_room: "Infant",
    observed_on: "2026-11-11",
    adult_attested: true,
    public_note: "Call 703-555-0100"
  }, new Date("2026-11-12T00:00:00.000Z"));
  assert.strictEqual(phone.ok, false);
});

check("embeds allow only https Kuula and Matterport", function () {
  var kuula = family.tourEmbed("https://kuula.co/share/collection/Ab12?logo=1");
  assert.strictEqual(kuula.allowed, true);
  assert.strictEqual(kuula.provider, "kuula");
  assert.strictEqual(kuula.embedUrl, "https://kuula.co/share/collection/Ab12");
  var matterport = family.tourEmbed("https://my.matterport.com/show/?m=Abcd1234&play=1&evil=javascript:alert(1)");
  assert.strictEqual(matterport.allowed, true);
  assert.strictEqual(matterport.embedUrl, "https://my.matterport.com/show/?m=Abcd1234&play=1");
  [
    "http://kuula.co/share/collection/Ab12",
    "https://user:pass@kuula.co/share/collection/Ab12",
    "https://kuula.co.evil.com/share/collection/Ab12",
    "https://www.youtube.com/embed/abcdef",
    "https://cmsreston.com/tour",
    "javascript:alert(1)",
    "https://my.matterport.com/show/",
    "https://kuula.co/admin/secret"
  ].forEach(function (url) {
    assert.strictEqual(family.tourEmbed(url).allowed, false, url);
  });
  assert.strictEqual(family.startTour({}), false);
});

check("empty gallery is a placeholder and never an invented photo", function () {
  var empty = family.galleryFromPublic([]);
  assert.strictEqual(empty.empty, true);
  var html = family.galleryHtml([], "example-school");
  assert.ok(html.indexOf("No approved photos yet") !== -1);
  assert.ok(html.indexOf("Request photos / be a founding school") !== -1);
  assert.ok(html.indexOf("<img") === -1);
  assert.ok(html.indexOf("<iframe") === -1);
  assert.ok(html.indexOf("claim.html?intent=photos&amp;school=example-school") !== -1);
  var dropped = family.galleryFromPublic([
    { media_type: "photo", url: "http://cdn.example/room.jpg" },
    { media_type: "photo", url: "javascript:alert(1)" },
    { media_type: "3d_tour", url: "https://www.youtube.com/embed/abcdef", embed_allowed: true }
  ]);
  assert.strictEqual(dropped.photos.length, 0);
  assert.strictEqual(dropped.tours[0].allowed, false);
  var kept = family.galleryFromPublic([
    { media_type: "photo", url: "https://cdn.example/empty-room.jpg", alt_text: "Empty room", is_hero: true }
  ]);
  assert.strictEqual(kept.photos.length, 1);
  var photoHtml = family.galleryHtml(kept, "example-school");
  assert.ok(photoHtml.indexOf("https://cdn.example/empty-room.jpg") !== -1);
  assert.ok(photoHtml.indexOf("<iframe") === -1);
  var tourHtml = family.galleryHtml([{
    media_type: "3d_tour",
    url: "https://my.matterport.com/show/?m=Abcd1234",
    embed_allowed: true
  }], "example-school");
  assert.ok(tourHtml.indexOf("js-start-tour") !== -1);
  assert.ok(tourHtml.indexOf("<iframe") === -1);
  assert.ok(tourHtml.indexOf("Matterport") !== -1);
});

check("preference preview does not write the legacy preferences table", function () {
  var legacy = { base_id: "pentagon", quiz_votes: { a: 1 }, mccyn: true };
  var snapshot = JSON.stringify(legacy);
  var payload = family.preferencePayload({
    must_haves: "infant outdoor time\nlanguage-rich room",
    deal_breakers: "no outdoor plan",
    preferred_jurisdictions: ["VA", "Texas"],
    budget_max: "1800",
    budget_period: "month",
    max_commute_minutes: "25",
    preferred_start_month: "2027-05"
  }, "user-1");
  assert.strictEqual(payload.ok, true, payload.errors.join(" "));
  assert.strictEqual(payload.row.user_id, "user-1");
  assert.deepStrictEqual(payload.row.must_haves, ["infant outdoor time", "language-rich room"]);
  assert.deepStrictEqual(payload.row.preferred_jurisdictions, ["VA"]);
  assert.strictEqual(payload.row.preferred_start_month, "2027-05-01");
  assert.strictEqual(payload.row.quiz_votes, undefined);
  assert.strictEqual(payload.row.base_id, undefined);
  assert.strictEqual(payload.row.mccyn, undefined);
  assert.strictEqual(JSON.stringify(legacy), snapshot);
  var diff = family.preferenceDiff({ must_haves: ["infant outdoor time"] }, payload.row);
  assert.ok(diff.some(function (change) { return change.field === "must_haves" && change.after.indexOf("language-rich") !== -1; }));
  var escaped = family.preferenceDiffHtml([{ field: "must_haves", label: "Must-haves", before: "<script>", after: "ok" }]);
  assert.ok(escaped.indexOf("<script>") === -1);
  assert.ok(escaped.indexOf("&lt;script&gt;") !== -1);
});

check("must-haves reorder find results without hiding silent records or rewriting distance", function () {
  var schools = [
    { id: "a", name: "Plain Center", agesServed: "3 years - 5 years", state: "VA" },
    { id: "b", name: "Language Nest", agesServed: "6 weeks - 5 years", state: "MD", hours: "language-rich infant day" }
  ];
  var original = schools.map(function (school) { return school.id; });
  var idle = family.preferenceRank(schools, {});
  assert.deepStrictEqual(idle.schools.map(function (school) { return school.id; }), ["a", "b"]);
  assert.strictEqual(idle.applied, false);
  var ranked = family.preferenceRank(schools, { must_haves: ["language-rich"], age_room_interests: ["infant"], preferred_jurisdictions: ["MD"] });
  assert.deepStrictEqual(ranked.schools.map(function (school) { return school.id; }), ["b", "a"]);
  assert.strictEqual(ranked.applied, true);
  assert.ok(ranked.note.indexOf("not rewritten") !== -1);
  var sunk = family.preferenceRank(schools, { deal_breakers: ["language-rich"] });
  assert.strictEqual(sunk.schools[0].id, "a");
  assert.deepStrictEqual(schools.map(function (school) { return school.id; }), original);
  var commute = family.preferenceRank(schools, { max_commute_minutes: 20 });
  assert.strictEqual(commute.applied, false);
  assert.ok(commute.note.indexOf("drive time") !== -1);
  assert.deepStrictEqual(commute.schools.map(function (school) { return school.id; }), original);
});

check("compare shows distance, eligibility, ratio, cost, openings, and the family rating", function () {
  var column = family.compareColumn({ id: "example", name: "Example School" }, {
    signedIn: true,
    distanceLabel: "4.2 straight-line mi from the Pentagon",
    eligibility: { label: "Quality pathway documented", code: "VA_VQB5_MCCYN_PLUS" },
    tour: { rating: 4, would_enroll: "yes", quoted_cost: 1800, quoted_cost_period: "month", infant_checklist: { ratio: "1:5" } },
    openings: [{ age_room: "Infant", status: "unknown", source: "family_tour", provider_confirmed: false, as_of: "2026-11-11T12:00:00.000Z", expires_at: "2026-11-18T12:00:00.000Z" }],
    now: new Date("2026-11-12T12:00:00.000Z")
  });
  assert.strictEqual(column.distance, "4.2 straight-line mi from the Pentagon");
  assert.strictEqual(column.ratio, "1:5");
  assert.strictEqual(column.cost, "$1,800 / month");
  assert.strictEqual(column.rating, "4 / 5 · would enroll: yes");
  assert.ok(column.openings[0].indexOf("Unconfirmed family report") !== -1);
  var html = family.compareTableHtml([column]);
  ["Distance to the selected base", "Eligibility path", "Ratio, when known", "Cost", "Openings", "Your rating", "VA_VQB5_MCCYN_PLUS"].forEach(function (label) {
    assert.ok(html.indexOf(label) !== -1, label);
  });
  var signedOut = family.compareColumn({ name: "Example School" }, { signedIn: false });
  assert.strictEqual(signedOut.rating, "Sign in to see your rating");
  assert.strictEqual(signedOut.ratio, "Not on record");
  assert.strictEqual(signedOut.cost, "Not on record");
});

check("migration grants the new columns to authenticated and keeps anon off them", function () {
  var sql = read("supabase/migrations/20261112010000_tour_log_family_fields.sql");
  ["would_enroll", "infant_checklist", "follow_ups", "photo_permission"].forEach(function (column) {
    assert.ok(sql.indexOf(column) !== -1, column);
  });
  assert.ok(/grant select \([\s\S]*would_enroll[\s\S]*\) on table public\.tour_logs to authenticated/i.test(sql));
  assert.ok(/grant insert \([\s\S]*photo_permission[\s\S]*\) on table public\.tour_logs to authenticated/i.test(sql));
  assert.ok(/grant update \([\s\S]*follow_ups[\s\S]*\) on table public\.tour_logs to authenticated/i.test(sql));
  assert.ok(/revoke select \([\s\S]*would_enroll[\s\S]*\) on table public\.tour_logs from anon, public/i.test(sql));
  assert.ok(/revoke all privileges on table public\.tour_logs from anon/i.test(sql));
  assert.ok(/revoke all privileges on table public\.openings_reports_own from public, anon, authenticated/i.test(sql));
  var followUp = read("supabase/migrations/20261112010100_openings_reports_own_select_only.sql");
  assert.ok(/revoke all privileges on table public\.openings_reports_own from public, anon, authenticated/i.test(followUp));
  assert.ok(/grant select on table public\.openings_reports_own to authenticated/i.test(followUp));
  assert.ok(sql.indexOf("security_invoker = true") !== -1);
  assert.ok(sql.indexOf("openings_reports_own") !== -1);
  assert.ok(!/insert\s+into\s+public\.tour_logs/i.test(sql));
  assert.ok(sql.indexOf("service_role") === -1);
  assert.ok(!/create\s+(or replace\s+)?view\s+public\.tour_logs/i.test(sql));
  assert.ok(sql.indexOf("submitted_by") !== -1);
  assert.ok(sql.indexOf("permission_evidence") === -1);
  assert.ok(sql.indexOf("internal_notes") === -1);
});

check("Kelly's tour seed is a placeholder and is not executed", function () {
  var seed = read("supabase/seeds/seed-kelly-tour-log-001.sql");
  assert.ok(seed.indexOf("DO NOT RUN") !== -1);
  assert.ok(seed.indexOf(":school_id") !== -1);
  assert.ok(seed.indexOf(":user_id") !== -1);
  assert.ok(seed.indexOf("share_publicly") !== -1);
  assert.ok(/false/.test(seed));
  assert.ok(seed.indexOf("ncr-va-vdoe-5115") !== -1);
  var runners = ["package.json", "netlify.toml", "scripts/test-family-loop.js", "scripts/test-ncr-live.js"];
  runners.forEach(function (rel) {
    if (rel === "scripts/test-family-loop.js") return;
    if (!fs.existsSync(path.join(root, rel))) return;
    assert.ok(read(rel).indexOf("seed-kelly-tour-log-001") === -1, rel);
  });
});

check("pages read the public media view and keep writes on the family tables", function () {
  var profile = read("site/profile.html");
  var tours = read("site/my-tours.js");
  var compare = read("site/compare.js");
  var find = read("site/find.html");
  assert.ok(profile.indexOf("school_media_public") !== -1);
  assert.ok(profile.indexOf("openings_reports_public") !== -1);
  assert.ok(!/from\(["']school_media["']\)/.test(profile));
  assert.ok(profile.indexOf("galleryHtml") !== -1);
  assert.ok(profile.indexOf("startTour") !== -1);
  assert.ok(tours.indexOf("service_role") === -1);
  assert.ok(tours.indexOf('from("tour_logs")') !== -1);
  assert.ok(tours.indexOf('from("openings_reports")') !== -1);
  assert.ok(tours.indexOf('from("openings_reports_own")') !== -1);
  assert.ok(tours.indexOf('from("user_preferences")') !== -1);
  assert.ok(!/from\(["']preferences["']\)/.test(tours));
  assert.ok(tours.indexOf("share_publicly") !== -1);
  assert.ok(compare.indexOf("favorites") !== -1);
  assert.ok(compare.indexOf("compareColumn") !== -1);
  assert.ok(find.indexOf("preferenceRank") !== -1);
  assert.ok(find.indexOf("my-tours.html") !== -1);
  assert.ok(read("site/my-tours.html").indexOf("Request photos") === -1);
  assert.ok(read("site/my-tours.html").indexOf("future anonymized insight") !== -1);
});

if (failures) {
  console.error("\n" + failures + " family-loop check" + (failures === 1 ? "" : "s") + " failed.");
  process.exit(1);
}
console.log("\nFamily loop checks passed.");
