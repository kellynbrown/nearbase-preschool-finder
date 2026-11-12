#!/usr/bin/env node
// Runtime NCR directory: distance sort, jurisdiction, evidence, dedupe, XSS.
var assert = require("assert");
var fs = require("fs");
var path = require("path");
var directory = require(path.join(__dirname, "..", "site/directory.js"));

var failures = 0;
var pending = [];
function check(name, fn) {
  var result;
  try {
    result = fn();
  } catch (error) {
    failures += 1;
    console.error("  FAIL  " + name);
    console.error(error && error.stack || error);
    return;
  }
  if (result && typeof result.then === "function") {
    pending.push(result.then(function () {
      console.log("  ok  " + name);
    }, function (error) {
      failures += 1;
      console.error("  FAIL  " + name);
      console.error(error && error.stack || error);
    }));
    return;
  }
  console.log("  ok  " + name);
}

function row(overrides) {
  return Object.assign({
    id: "sample-center",
    name: "Sample Center",
    address: "1 Main Street",
    city: "Arlington",
    state: "VA",
    zip: "22201",
    lat: 38.88,
    lng: -77.1,
    pilot_base: "pentagon",
    source_license_id: "lic-1"
  }, overrides || {});
}

function haversine(lat1, lng1, lat2, lng2) {
  var p = Math.PI / 180;
  var dLat = (lat2 - lat1) * p;
  var dLng = (lng2 - lng1) * p;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

check("base sort uses installation miles and ignores pilot_base equality", function () {
  var assignedElsewhere = directory.normalizeSchool(row({
    id: "closer",
    name: "Closer To Meade",
    pilot_base: "pentagon",
    installation_distances_miles: { "fort-meade": 2.2, pentagon: 30 }
  }));
  var assignedMeade = directory.normalizeSchool(row({
    id: "farther",
    name: "Farther From Meade",
    pilot_base: "fort-meade",
    installation_distances_miles: { "fort-meade": 18, pentagon: 4 }
  }));
  var sorted = directory.sortSchools([assignedMeade, assignedElsewhere], null, haversine, directory.pilotFor("meade"));
  assert.deepStrictEqual(sorted.map(function (school) { return school.id; }), ["closer", "farther"]);
  var view = directory.presentSchool(assignedElsewhere, null, haversine, directory.pilotFor("fort-meade"));
  assert.strictEqual(view.distanceLabel, "2.2 straight-line mi from Meade");
  assert.ok(view.distanceLabel.indexOf("drive") === -1);
});

check("stored installation miles beat the legacy Pentagon column", function () {
  var school = directory.normalizeSchool(row({
    distance_miles_to_pentagon: 9,
    installation_distances_miles: { pentagon: 3.25 }
  }));
  var dist = directory.distanceFor(school, null, haversine, directory.pilotFor("pentagon"));
  assert.strictEqual(dist.miles, 3.25);
  assert.strictEqual(dist.from, "pentagon");
});

check("legacy Pentagon and Belvoir miles remain when newer metadata is absent", function () {
  var school = directory.normalizeSchool(row({
    distance_miles_to_pentagon: 4.2,
    distance_miles_to_belvoir: 1.5,
    lat: 38.872,
    lng: -77.056
  }));
  assert.strictEqual(directory.distanceFor(school, null, haversine, directory.pilotFor("pentagon")).miles, 4.2);
  assert.strictEqual(directory.distanceFor(school, null, haversine, directory.pilotFor("belvoir")).miles, 1.5);
  var other = directory.distanceFor(school, null, haversine, directory.pilotFor("fort-myer"));
  assert.strictEqual(other.from, "base");
  assert.ok(other.label.indexOf("straight-line mi from Fort Myer") !== -1);
});

check("jurisdiction comes from state, including legacy rows with a blank jurisdiction", function () {
  assert.strictEqual(directory.jurisdictionCode(directory.normalizeSchool(row({ jurisdiction: "", state: "VA" }))), "VA");
  assert.strictEqual(directory.jurisdictionCode(directory.normalizeSchool(row({ jurisdiction: "District of Columbia", state: "DC" }))), "DC");
  assert.strictEqual(directory.jurisdictionCode(directory.normalizeSchool(row({ jurisdiction: "Montgomery County", state: "MD" }))), "MD");
  assert.strictEqual(directory.normalizeJurisdiction("maryland"), "MD");
  assert.strictEqual(directory.normalizeJurisdiction("D.C."), "DC");
  assert.strictEqual(directory.normalizeJurisdiction("all"), "");
  var filtered = directory.filterDirectory([
    directory.normalizeSchool(row({ id: "va", name: "Virginia Center", address: "1 Virginia Ave", source_license_id: "va-1", state: "VA" })),
    directory.normalizeSchool(row({ id: "md", name: "Maryland Center", address: "2 Maryland Ave", source_license_id: "md-1", state: "MD", city: "Ashton", jurisdiction: "Montgomery County" })),
    directory.normalizeSchool(row({ id: "dc", name: "DC Center", address: "3 DC Ave", source_license_id: "dc-1", state: "DC", jurisdiction: "District of Columbia" }))
  ], { baseId: "pentagon", jurisdiction: "MD" });
  assert.deepStrictEqual(filtered.schools.map(function (school) { return school.id; }), ["md"]);
  assert.strictEqual(filtered.coverage.byJurisdiction.VA, 1);
  assert.strictEqual(filtered.coverage.byJurisdiction.MD, 1);
  assert.strictEqual(filtered.coverage.byJurisdiction.DC, 1);
  assert.strictEqual(filtered.coverage.shown, 1);
});

check("campus dedupe is presentation-only and keeps both ids", function () {
  var legacy = directory.normalizeSchool(row({
    id: "center-vdoe1",
    name: "Same Campus",
    address: "10 Duke Street",
    source_license_id: "100",
    pilot_base: "fort-belvoir"
  }));
  var copy = directory.normalizeSchool(row({
    id: "center-pentagon-vdoe1",
    name: "Same Campus",
    address: "10 Duke Street",
    source_license_id: "100",
    pilot_base: "pentagon",
    eligibility_path: "VA_VQB5_MCCYN_PLUS",
    distance_miles_to_pentagon: 2
  }));
  var otherAddress = directory.normalizeSchool(row({
    id: "other-campus",
    name: "Same Campus",
    address: "99 Other Road",
    source_license_id: "100"
  }));
  var otherName = directory.normalizeSchool(row({
    id: "neighbor",
    name: "Different Center",
    address: "10 Duke Street",
    source_license_id: "200"
  }));
  var deduped = directory.dedupeCampuses([legacy, copy, otherAddress, otherName]);
  assert.strictEqual(deduped.combined, 1);
  assert.strictEqual(deduped.schools.length, 3);
  var winner = directory.findSchool(deduped.schools, "center-vdoe1");
  assert.strictEqual(winner.id, "center-pentagon-vdoe1");
  assert.ok(winner.alsoIds.indexOf("center-vdoe1") !== -1);
  assert.strictEqual(winner.distanceMilesToPentagon, 2);
  assert.strictEqual(directory.findSchool(deduped.schools, "other-campus").id, "other-campus");
  assert.strictEqual(directory.findSchool(deduped.schools, "neighbor").id, "neighbor");
});

check("conflicting license ids at one name and address stay visible", function () {
  var a = directory.normalizeSchool(row({ id: "nest-a", name: "The Nest", address: "2609 Mount Vernon Avenue", source_license_id: "1107105" }));
  var b = directory.normalizeSchool(row({ id: "nest-b", name: "The Nest", address: "2609 Mount Vernon Avenue", source_license_id: "1073544", eligibility_path: "VA_VQB5_MCCYN_PLUS" }));
  var deduped = directory.dedupeCampuses([a, b]);
  assert.strictEqual(deduped.schools.length, 1);
  assert.strictEqual(deduped.schools[0].id, "nest-b");
  assert.deepStrictEqual(deduped.schools[0].alsoLicenseIds, ["1107105"]);
});

check("eligibility labels stay exact and do not claim MCCYN approval", function () {
  var pending = directory.eligibilityBadge(directory.normalizeSchool(row({ eligibility_path: null })));
  assert.strictEqual(pending.label, "Verification evidence pending");
  assert.strictEqual(pending.code, "");
  assert.ok(pending.detail.indexOf("not MCCYN approval") !== -1);

  var ami = directory.eligibilityBadge(directory.normalizeSchool(row({
    eligibility_path: "DOD_RECOGNIZED_AMI_USA_ACCREDITATION",
    quality_rating: null
  })));
  assert.strictEqual(ami.label, "Quality pathway documented");
  assert.strictEqual(ami.code, "DOD_RECOGNIZED_AMI_USA_ACCREDITATION");
  assert.ok(ami.detail.indexOf("Affiliated or member-only ages do not") !== -1);
  assert.ok(ami.detail.indexOf("not MCCYN enrollment") !== -1);

  var vqb5 = directory.eligibilityBadge(directory.normalizeSchool(row({ eligibility_path: "VA_VQB5_MCCYN_PLUS" })));
  assert.ok(vqb5.detail.indexOf("does not itself establish school-age eligibility") !== -1);

  var unknown = directory.eligibilityBadge(directory.normalizeSchool(row({ eligibility_path: "FUTURE_PATH" })));
  assert.strictEqual(unknown.code, "FUTURE_PATH");
  assert.strictEqual(unknown.label, "Quality pathway documented");
  assert.ok(unknown.detail.indexOf("MCCYN-approved") === -1);
});

check("evidence html escapes text and drops non-http links", function () {
  var school = directory.normalizeSchool(row({
    eligibility_path: "DOD_RECOGNIZED_AMI_USA_ACCREDITATION",
    quality_rating: null,
    eligibility_evidence: {
      eligible_age_scope: "Recognized <script>alert(1)</script>",
      policy_url: "javascript:alert(1)",
      accreditation_source_url: "https://www.amiusa.org/school-locator1/mater-amoris-montessori-school",
      provider_acceptance: "not_confirmed",
      checked_at: "2026-11-11T07:07:40-05:00"
    }
  }));
  var html = directory.evidenceHtml(school);
  assert.ok(html.indexOf("<script>") === -1);
  assert.ok(html.indexOf("&lt;script&gt;") !== -1);
  assert.ok(html.indexOf("javascript:") === -1);
  assert.ok(html.indexOf("https://www.amiusa.org/school-locator1/mater-amoris-montessori-school") !== -1);
  assert.ok(html.indexOf("No numeric quality rating is recorded") !== -1);
  assert.ok(html.indexOf("not confirmed") !== -1);
  assert.ok(html.indexOf('rel="noopener noreferrer"') !== -1);
  var unsafe = directory.presentSchool(directory.normalizeSchool(row({ website: "javascript:alert(1)" })), null, haversine);
  assert.strictEqual(unsafe.websiteHref, "");
  var quoted = directory.websiteHref("https://example.com/\"onmouseover=\"alert(1)");
  assert.ok(!quoted || quoted.indexOf("\"") === -1);
});

check("represented bases include distance keys that are not the nearest pilot_base", function () {
  var onlyPentagon = directory.normalizeSchool(row({
    pilot_base: "pentagon",
    nearest_installation: "pentagon",
    installation_distances_miles: {
      pentagon: 1,
      "fort-belvoir": 2,
      "fort-myer": 3,
      "jb-anacostia-bolling": 4,
      "nsa-bethesda": 5,
      quantico: 6,
      "fort-detrick": 7,
      "washington-navy-yard": 8,
      "jb-andrews": 9,
      "fort-meade": 10,
      "fort-mcnair": 11,
      "coast-guard-hq": 12,
      "future-anchor": 13
    }
  }));
  var represented = directory.representedInstallations([onlyPentagon]).map(function (item) { return item.id; });
  ["pentagon", "fort-belvoir", "fort-myer", "jb-anacostia-bolling", "nsa-bethesda", "quantico", "fort-detrick", "washington-navy-yard", "jb-andrews", "fort-meade", "fort-mcnair", "coast-guard-hq", "future-anchor"].forEach(function (id) {
    assert.ok(represented.indexOf(id) !== -1, id);
  });
  var options = directory.selectorBases([{ id: "culmore", name: "Culmore / Bailey's Crossroads" }], [onlyPentagon]);
  assert.strictEqual(options[0].value, "pentagon");
  var mcnair = options.filter(function (option) { return option.value === "fort-mcnair"; })[0];
  var coast = options.filter(function (option) { return option.value === "coast-guard-hq"; })[0];
  assert.ok(mcnair.label.indexOf("straight-line reference") !== -1);
  assert.ok(coast.label.indexOf("straight-line reference") !== -1);
  assert.ok(options.some(function (option) { return option.value === "culmore" && option.group === "Neighborhoods"; }));
  assert.strictEqual(directory.pilotFor("meade").id, "fort-meade");
  assert.strictEqual(directory.pilotFor("jbab").baseId, "jbab");
});

check("profile fetch asks for evidence and retries a missing column", function () {
  var calls = [];
  var sb = {
    from: function () {
      var query = { cols: "", filters: [] };
      var api = {
        select: function (cols) { query.cols = cols; return api; },
        eq: function (col, val) { query.filters.push([col, val]); return api; },
        order: function (col, opts) { query.order = [col, opts]; return api; },
        range: function (from, to) {
          calls.push({ cols: query.cols, filters: query.filters.slice(), from: from, to: to });
          if (query.cols.indexOf("installation_distances_miles") !== -1) {
            return Promise.resolve({ data: null, error: { code: "42703", message: "column schools.installation_distances_miles does not exist" } });
          }
          return Promise.resolve({
            data: [row({
              id: "ncr-md-license-162124",
              eligibility_path: "DOD_RECOGNIZED_AMI_USA_ACCREDITATION",
              eligibility_evidence: { policy_url: "https://public.militarychildcare.csd.disa.mil/policy" }
            })],
            error: null
          });
        }
      };
      return api;
    }
  };
  return directory.fetchSchoolProfile(sb, "ncr-md-license-162124").then(function (result) {
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.school.id, "ncr-md-license-162124");
    assert.strictEqual(result.school.eligibilityEvidence.policy_url, "https://public.militarychildcare.csd.disa.mil/policy");
    assert.ok(calls[0].cols.indexOf("eligibility_evidence") !== -1);
    assert.ok(calls[1].cols.indexOf("installation_distances_miles") === -1);
    assert.ok(calls[1].cols.indexOf("eligibility_evidence") !== -1);
    assert.deepStrictEqual(calls[1].filters, [["id", "ncr-md-license-162124"]]);
    assert.strictEqual(calls[0].to - calls[0].from + 1, 1000);
  });
});

check("a page size of 1000 is not a result cap", function () {
  assert.strictEqual(directory.PAGE_SIZE, 1000);
  var calls = [];
  var sb = {
    from: function () {
      var api = {
        select: function () { return api; },
        eq: function () { return api; },
        order: function () { return api; },
        range: function (from, to) {
          calls.push([from, to]);
          var count = to - from + 1;
          var start = from;
          var rows = [];
          for (var i = 0; i < count && start + i < 2001; i++) rows.push(row({ id: "s" + (start + i), name: "S" + (start + i) }));
          return Promise.resolve({ data: rows, error: null });
        }
      };
      return api;
    }
  };
  return directory.fetchDirectorySchools(sb).then(function (result) {
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.schools.length, 2001);
    assert.deepStrictEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
  });
});

check("coverage text states the row-count caveat and the honest pathway label", function () {
  var schools = [
    directory.normalizeSchool(row({ id: "a", state: "VA", eligibility_path: "VA_VQB5_MCCYN_PLUS" })),
    directory.normalizeSchool(row({ id: "b", state: "MD", eligibility_path: "" }))
  ];
  var view = directory.filterDirectory(schools, { baseId: "pentagon", jurisdiction: "" });
  var text = directory.coverageText(view.coverage, directory.pilotFor("pentagon"), "");
  assert.ok(text.indexOf("2 directory rows") !== -1);
  assert.ok(text.indexOf("Verification evidence pending: 1") !== -1);
  assert.ok(text.indexOf("not a drive time") !== -1);
  assert.ok(text.indexOf("not a complete census") !== -1);
  assert.ok(text.indexOf(directory.HONEST_LINE) !== -1);
});

check("find, home, and profile pages expose the runtime directory", function () {
  var root = path.join(__dirname, "..");
  var find = fs.readFileSync(path.join(root, "site/find.html"), "utf8");
  var profile = fs.readFileSync(path.join(root, "site/profile.html"), "utf8");
  var index = fs.readFileSync(path.join(root, "site/index.html"), "utf8");
  assert.ok(find.indexOf("fetchPilotSchools(sb, baseId)") !== -1);
  assert.ok(find.indexOf("filterDirectory") !== -1);
  assert.ok(find.indexOf("doorJurisdiction") !== -1);
  assert.ok(profile.indexOf("fetchSchoolProfile") !== -1);
  assert.ok(profile.indexOf("Visit website") !== -1);
  assert.ok(profile.indexOf("Quality pathway documented is not MCCYN enrollment, approval, or guaranteed family funding.") !== -1);
  assert.ok(index.indexOf("directory.js") !== -1);
  assert.ok(index.indexOf('sel.value = "pentagon"') !== -1);
});

Promise.all(pending).then(function () {
  if (failures) {
    console.error("\n" + failures + " failed");
    process.exit(1);
  }
  console.log("\nAll NCR runtime checks passed.");
});
