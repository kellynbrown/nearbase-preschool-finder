#!/usr/bin/env node
// Verifies NearBase family matching and that insights stay inside the listing.
var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var root = path.join(__dirname, "..");
var match = require(path.join(root, "site/match.js"));
var insights = require(path.join(root, "site/insights.js"));

var context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "site/schools.js"), "utf8"), context);
var SCHOOLS = context.window.SCHOOLS;
assert.ok(SCHOOLS.length >= 140, "expected the NCR directory");

function bySlug(slug) {
  var found = SCHOOLS.find(function (s) { return s.slug === slug; });
  assert.ok(found, "missing " + slug);
  return found;
}

function profile(overrides) {
  return match.normalizeProfile(Object.assign({
    baseId: "pentagon",
    ages: ["infant", "toddler"],
    philosophies: ["montessori"],
    hours: "early",
    timing: "now",
    mccyn: true,
    subsidy: false,
    efmp: false
  }, overrides || {}));
}

var failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log("ok  " + name);
  } catch (err) {
    failures++;
    console.error("FAIL " + name);
    console.error("     " + err.message);
  }
}

check("distance is a straight-line mile estimate", function () {
  var miles = match.haversineMiles(38.872, -77.056, 38.71, -77.15);
  assert.ok(miles > 10 && miles < 18, "Pentagon to Belvoir ~12-15 mi, got " + miles);
});

check("timing buckets follow months until the report date", function () {
  var now = new Date(2026, 9, 29);
  assert.strictEqual(match.timingFromMonth("2026-12", now), "now");
  assert.strictEqual(match.timingFromMonth("2027-04", now), "summer");
  assert.strictEqual(match.timingFromMonth("2027-08", now), "planning");
  assert.strictEqual(match.timingFromMonth("", now), "unsure");
});

check("a nearby MCCYN school outranks a far listing with no military notes", function () {
  var p = profile();
  var ranked = match.rankSchools(SCHOOLS, p);
  var gardner = ranked.find(function (row) { return row.school.slug === "the-gardner-school-arlington"; });
  var hagerstown = ranked.find(function (row) { return row.school.slug === "hagerstown-preschool-center"; });
  assert.ok(gardner.match.score >= 75, "Gardner score " + gardner.match.score);
  assert.ok(hagerstown.match.score <= 55, "Hagerstown score " + hagerstown.match.score);
  assert.ok(ranked.indexOf(gardner) < ranked.indexOf(hagerstown));
  assert.ok(/MCCYN/.test(gardner.match.factors.find(function (f) { return f.id === "militaryAid"; }).detail));
  assert.ok(/straight-line miles/.test(gardner.match.headline + gardner.match.factors.map(function (f) { return f.detail; }).join(" ")));
});

check("explicit ages outside the family are a known miss, not a blank", function () {
  var school = bySlug("hagerstown-preschool-center");
  var result = match.scoreSchool(school, profile({ ages: ["infant"] }));
  var age = result.factors.find(function (f) { return f.id === "age"; });
  assert.strictEqual(age.status, "known");
  assert.ok(age.score < 40, "age score " + age.score);
  assert.ok(/Outside the ages/.test(age.detail));
});

check("missing facts stay unknown and cannot look like a perfect match", function () {
  var bare = { id: 9000, slug: "bare", name: "Bare Listing", loc: "Arlington, VA", lat: 38.872, lng: -77.056, score: "", tier: "hi", badges: [], tags: [], quote: "" };
  var rich = {
    id: 9001, slug: "rich", name: "Rich Listing", loc: "Arlington, VA", lat: 38.88, lng: -77.06, score: "90", tier: "hi",
    badges: [{ t: "MCCYN" }, { t: "6:30am–6pm" }, { t: "Rolling admission" }, { t: "Ages 6wks–5yr" }, { t: "Montessori" }],
    tags: ["montessori", "toddler", "mil"], quote: "Montessori for infants."
  };
  var far = Object.assign({}, rich, { id: 9002, slug: "far", name: "Far Match", lat: 39.64, lng: -77.72 });
  var p = profile();
  var a = match.scoreSchool(bare, p);
  var b = match.scoreSchool(rich, p);
  var c = match.scoreSchool(far, p);
  assert.ok(a.confidence < 0.55, "bare confidence " + a.confidence);
  assert.ok(a.factors.some(function (f) { return f.id === "hours" && f.status === "unknown"; }));
  assert.ok(a.score > 40 && a.score < 75, "bare score " + a.score);
  assert.ok(b.score > c.score, "near rich " + b.score + " should beat far rich " + c.score);
  assert.ok(b.score > a.score, "rich " + b.score + " should beat bare " + a.score);
  assert.ok(a.factors.every(function (f) { return f.status !== "known" || (f.score >= 0 && f.score <= 100); }));
});

check("closer identical listings rank first", function () {
  var mk = function (id, lat) {
    return { id: id, slug: "s" + id, name: "Same " + id, loc: "VA", lat: lat, lng: -77.056, score: "80", tier: "hi", badges: [{ t: "Montessori" }], tags: ["montessori"], quote: "" };
  };
  var ranked = match.rankSchools([mk(2, 38.95), mk(1, 38.873)], profile({ philosophies: ["montessori"], ages: [], hours: "any", mccyn: false, timing: "unsure" }));
  assert.strictEqual(ranked[0].school.id, 1);
  assert.ok(ranked[0].match.distanceMiles < ranked[1].match.distanceMiles);
});

check("on-post waitlist is quoted, not invented", function () {
  var cdc = match.scoreSchool(bySlug("fort-belvoir-cdc"), profile({ baseId: "belvoir", timing: "now", ages: ["toddler"], philosophies: [] }));
  var wait = cdc.factors.find(function (f) { return f.id === "waitlist"; });
  assert.strictEqual(wait.status, "known");
  assert.ok(wait.score < 50, "wait score " + wait.score);
  assert.ok(/12/.test(wait.detail) && /18/.test(wait.detail));
  var distance = cdc.factors.find(function (f) { return f.id === "distance"; });
  assert.ok(/on-post/i.test(distance.detail));
});

check("EFMP need does not punish a school for a blank support field", function () {
  var p = profile({ efmp: true, philosophies: [], ages: ["pk"], hours: "any", mccyn: false, baseId: "pentagon" });
  var special = match.scoreSchool(bySlug("arlingtonians-for-residential-schools"), p);
  var plain = match.scoreSchool(bySlug("little-folks-school"), p);
  var efmp = plain.factors.find(function (f) { return f.id === "efmp"; });
  assert.strictEqual(efmp.status, "unknown");
  assert.ok(special.factors.find(function (f) { return f.id === "efmp"; }).score === 100);
  assert.ok(special.match ? true : special.score >= plain.score);
  assert.ok(plain.score > 0);
});

check("philosophy uses the listing and ignores schools with no philosophy note", function () {
  var p = profile({
    baseId: "germantown",
    ages: [],
    hours: "any",
    mccyn: false,
    timing: "unsure",
    philosophies: ["montessori"]
  });
  var montessori = match.scoreSchool(bySlug("bethesda-montessori-school"), p);
  var play = match.scoreSchool(bySlug("westover-hills-preschool"), p);
  assert.ok(montessori.factors.find(function (f) { return f.id === "philosophy"; }).score > play.factors.find(function (f) { return f.id === "philosophy"; }).score);
  var church = match.scoreSchool(bySlug("fairfax-presbyterian-preschool"), p);
  assert.strictEqual(church.factors.find(function (f) { return f.id === "philosophy"; }).status, "unknown");
});

check("quiz votes become philosophies without a hardcoded military score", function () {
  assert.deepStrictEqual(match.philosophiesFromVotes({ montessori: 4, play: 1, reggio: 0 }), ["montessori"]);
  var p = match.withQuiz(profile({ philosophies: [] }), { montessori: 3, play: 3, nature: 1 }, "family");
  assert.ok(p.philosophies.indexOf("montessori") !== -1);
  assert.ok(p.philosophies.indexOf("play") !== -1);
  assert.ok(p.philosophies.indexOf("nature") === -1);
});

check("ranking is deterministic and stays in range", function () {
  var p = profile();
  var once = match.rankSchools(SCHOOLS, p).map(function (row) { return row.school.id + ":" + row.match.score; }).join(",");
  var twice = match.rankSchools(SCHOOLS, p).map(function (row) { return row.school.id + ":" + row.match.score; }).join(",");
  assert.strictEqual(once, twice);
  match.rankSchools(SCHOOLS, p).forEach(function (row) {
    assert.ok(row.match.score >= 0 && row.match.score <= 100);
    assert.ok(row.match.confidence >= 0 && row.match.confidence <= 1);
    assert.ok(!row.match.factors.some(function (f) { return f.score != null && (f.score < 0 || f.score > 100); }));
  });
});

check("ranking 150 schools stays interactive", function () {
  var start = Date.now();
  for (var i = 0; i < 20; i++) match.rankSchools(SCHOOLS, profile());
  var elapsed = Date.now() - start;
  assert.ok(elapsed < 1500, "20 full ranks took " + elapsed + "ms");
});

check("summaries do not invent MCCYN, hours, or waitlists", function () {
  var bare = { id: 1, slug: "bare", name: "Bare Listing", loc: "Arlington, VA", lat: 1, lng: 2, badges: [], tags: [], quote: "" };
  var lines = insights.summarizeSchool(bare).map(function (s) { return s.text; }).join(" ");
  assert.ok(/Arlington/.test(lines));
  assert.ok(/not on this listing/i.test(lines));
  assert.ok(!/accepts MCCYN|opens at|waitlist is 12/i.test(lines));
  var toth = insights.summarizeSchool(bySlug("toth-montessori"));
  var listing = toth.filter(function (s) { return s.kind === "listing"; }).map(function (s) { return s.text; }).join(" ");
  assert.ok(/MCCYN/.test(listing));
  assert.ok(/Navy Yard/.test(listing));
  toth.filter(function (s) { return s.kind === "listing"; }).forEach(function (s) {
    assert.ok(!/we called|families told us|definitely accepts/i.test(s.text));
  });
});

check("checklist gaps are labeled and listing lines are grounded", function () {
  var school = bySlug("fort-belvoir-cdc");
  var list = insights.tourChecklist(school, profile({ baseId: "belvoir", efmp: true }), null);
  assert.ok(list.length >= 5 && list.length <= 8);
  list.forEach(function (entry) {
    assert.ok(["listing", "gap", "guidance"].indexOf(entry.kind) !== -1);
  });
  var blob = [school.name, school.loc, school.quote].concat((school.badges || []).map(function (b) { return b.t; })).join(" ").toLowerCase();
  list.filter(function (entry) { return entry.kind === "listing"; }).forEach(function (entry) {
    assert.ok(!/child care aware accepts/i.test(entry.text));
    if (/12/.test(entry.text)) assert.ok(/12/.test(blob) || /wait/.test(blob));
  });
  var bare = { id: 3, slug: "x", name: "X", loc: "Y", badges: [], tags: [], quote: "", lat: 1, lng: 1 };
  var gaps = insights.tourChecklist(bare, profile(), null);
  assert.ok(gaps.some(function (entry) { return entry.kind === "gap" && /hours/i.test(entry.text); }));
  assert.ok(!gaps.some(function (entry) { return entry.kind === "listing" && /MCCYN/.test(entry.text); }));
});

check("PCS timeline is general guidance", function () {
  var guide = insights.pcsTimeline(profile({ timing: "now" }));
  assert.strictEqual(guide.kind, "guidance");
  assert.ok(/not a promise/i.test(guide.title));
  assert.ok(guide.items.length >= 3);
  guide.items.forEach(function (line) {
    assert.ok(!/Gardner|ToTH|Fort Belvoir CDC accepts/i.test(line));
  });
});

check("parent disagreements come from saved votes only", function () {
  var diff = match.voteDisagreements({ montessori: 4, play: 0 }, { montessori: 0, play: 4 });
  assert.ok(diff.indexOf("montessori") !== -1 && diff.indexOf("play") !== -1);
  assert.deepStrictEqual(match.voteDisagreements({ montessori: 2 }, { montessori: 2 }), []);
});

if (failures) {
  console.error("\n" + failures + " failed");
  process.exit(1);
}
console.log("\nAll match and insight checks passed (" + SCHOOLS.length + " schools).");
