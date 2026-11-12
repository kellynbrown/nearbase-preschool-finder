#!/usr/bin/env node
// Pilot directory: skeleton rows, distance sort, and the Supabase read.
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
    id: "summer-breeze-learning-center-alexandria-vdoe5015",
    name: "Summer Breeze Learning Center",
    address: "8758 Richmond Highway",
    city: "Alexandria",
    state: "VA",
    zip: "22309",
    phone: "(703) 360-3668",
    lat: 38.721598,
    lng: -77.126036,
    distance_miles_to_belvoir: 1.54,
    license_type: "Licensed Child Day Center",
    license_status: "Licensed (Two Year)",
    capacity: 92,
    ages_served: "1 month - 12 years 11 months",
    hours: "6:00am - 6:30pm, Monday - Friday",
    locality: "Fairfax County",
    pilot_base: "fort-belvoir"
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

check("slug for favorites is the schools id", function () {
  var school = directory.normalizeSchool(row());
  assert.strictEqual(school.id, "summer-breeze-learning-center-alexandria-vdoe5015");
  assert.strictEqual(school.slug, school.id);
  assert.strictEqual(school.pilotBase, "fort-belvoir");
  assert.strictEqual(directory.normalizeSchool({ name: "Missing id" }), null);
});

check("cards keep license fields and skip blanks", function () {
  var full = directory.presentSchool(directory.normalizeSchool(row()), null, haversine);
  assert.strictEqual(full.place, "Fairfax County · Alexandria, VA");
  assert.strictEqual(full.addressLine, "8758 Richmond Highway, Alexandria, VA 22309");
  assert.strictEqual(full.distanceLabel, "1.5 straight-line mi from Belvoir");
  assert.ok(full.facts.some(function (fact) { return fact.text === "Capacity 92"; }));
  assert.ok(full.facts.some(function (fact) { return fact.text.indexOf("Ages ") === 0; }));
  assert.ok(full.facts.some(function (fact) { return fact.href === "tel:7033603668"; }));
  assert.ok(full.facts.some(function (fact) { return fact.text.indexOf("Licensed Child Day Center") === 0; }));

  var sparse = directory.presentSchool(directory.normalizeSchool(row({
    phone: "", hours: null, ages_served: "", capacity: null, license_status: ""
  })), null, haversine);
  assert.ok(sparse.facts.every(function (fact) { return fact.text.indexOf("Capacity") !== 0 && fact.text.indexOf("Ages") !== 0; }));
  assert.strictEqual(sparse.facts.filter(function (fact) { return fact.href; }).length, 0);
  assert.strictEqual(sparse.facts[sparse.facts.length - 1].text, "Licensed Child Day Center");
});

check("home distance wins over the Belvoir distance", function () {
  var school = directory.normalizeSchool(row());
  var away = directory.distanceFor(school, null, haversine);
  assert.strictEqual(away.from, "belvoir");
  assert.strictEqual(away.miles, 1.54);
  var home = directory.distanceFor(school, { lat: 38.73, lng: -77.14 }, haversine);
  assert.strictEqual(home.from, "home");
  assert.ok(home.miles < 2);
  assert.ok(/straight-line mi from home$/.test(home.label));
});

check("sort is by distance and search does not invent a score", function () {
  var near = directory.normalizeSchool(row({ id: "near", name: "Near", distance_miles_to_belvoir: 2 }));
  var far = directory.normalizeSchool(row({ id: "far", name: "Far", distance_miles_to_belvoir: 12, city: "Woodbridge" }));
  var mid = directory.normalizeSchool(row({ id: "mid", name: "Mid", distance_miles_to_belvoir: 5 }));
  var sorted = directory.sortSchools([far, near, mid], null, haversine);
  assert.deepStrictEqual(sorted.map(function (s) { return s.id; }), ["near", "mid", "far"]);
  var byHome = directory.sortSchools([far, near], { lat: far.lat, lng: far.lng }, haversine);
  assert.strictEqual(byHome[0].id, "far");
  assert.strictEqual(directory.matchesQuery(far, "woodbridge"), true);
  assert.strictEqual(directory.matchesQuery(near, "woodbridge"), false);
  assert.strictEqual(directory.matchesQuery(near, ""), true);
});

check("directory read pages every school and does not filter by pilot_base", function () {
  var calls = [];
  function client(pages, failAt) {
    return {
      from: function (table) {
        assert.strictEqual(table, "schools");
        var query = { filters: [] };
        var api = {
          select: function (cols) { query.cols = cols; return api; },
          eq: function (col, val) { query.filters.push([col, val]); return api; },
          order: function (col, opts) { query.order = [col, opts]; return api; },
          range: function (from, to) {
            calls.push({ from: from, to: to, filters: query.filters.slice(), order: query.order, cols: query.cols });
            if (failAt != null && from === failAt) return Promise.resolve({ data: null, error: { message: "permission denied" } });
            return Promise.resolve({ data: pages.slice(from, to + 1), error: null });
          }
        };
        return api;
      }
    };
  }
  var first = row({ id: "a", distance_miles_to_belvoir: 1 });
  var second = row({ id: "b", distance_miles_to_belvoir: 2 });
  return directory.fetchPilotSchools(client([first, second]), "belvoir").then(function (result) {
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.schools.map(function (s) { return s.slug; }), ["a", "b"]);
    assert.deepStrictEqual(calls[0].filters, []);
    assert.strictEqual(calls[0].order[0], "id");
    assert.ok(calls[0].cols.indexOf("distance_miles_to_belvoir") !== -1);
    assert.ok(calls[0].cols.indexOf("installation_distances_miles") !== -1);
    assert.ok(calls[0].cols.indexOf("eligibility_evidence") === -1);
    assert.strictEqual(calls[0].to, 999);
    assert.ok(calls[0].cols.indexOf("ages_served") !== -1);
    assert.strictEqual(calls.length, 1);
    calls = [];
    var page = [];
    for (var i = 0; i < 1000; i++) page.push(row({ id: "p" + i, name: "P" + i }));
    page.push(row({ id: "last", name: "Last" }));
    return directory.fetchPilotSchools(client(page), "belvoir").then(function (paged) {
      assert.strictEqual(paged.ok, true);
      assert.strictEqual(paged.schools.length, 1001);
      assert.strictEqual(paged.schools[1000].slug, "last");
      assert.deepStrictEqual(calls.map(function (call) { return [call.from, call.to]; }), [[0, 999], [1000, 1999]]);
    });
  });
});

check("a failed read stays an error and does not throw", function () {
  var sb = {
    from: function () {
      return {
        select: function () { return this; },
        eq: function () { return this; },
        order: function () { return this; },
        range: function () { return Promise.reject(new Error("network down")); }
      };
    }
  };
  return directory.fetchPilotSchools(sb).then(function (result) {
    assert.strictEqual(result.ok, false);
    assert.deepStrictEqual(result.schools, []);
    assert.ok(/network down/.test(result.message));
  });
});

check("pentagon distance column is used and does not borrow Belvoir miles", function () {
  var school = directory.normalizeSchool(row({
    distance_miles_to_belvoir: 1.54,
    distance_miles_to_pentagon: 4.2,
    lat: 38.872,
    lng: -77.056
  }));
  var pentagon = directory.distanceFor(school, null, haversine, directory.pilotFor("pentagon"));
  assert.strictEqual(pentagon.miles, 4.2);
  assert.strictEqual(pentagon.from, "pentagon");
  assert.strictEqual(pentagon.label, "4.2 straight-line mi from the Pentagon");
  var belvoir = directory.distanceFor(school, null, haversine, directory.pilotFor("belvoir"));
  assert.strictEqual(belvoir.miles, 1.54);
  assert.strictEqual(belvoir.from, "belvoir");
  assert.strictEqual(belvoir.label, "1.5 straight-line mi from Belvoir");
  var close = directory.normalizeSchool(row({ id: "close", name: "Close", lat: 38.872, lng: -77.056, distance_miles_to_belvoir: 20 }));
  var far = directory.normalizeSchool(row({ id: "far", name: "Far", lat: 38.7, lng: -77.15, distance_miles_to_belvoir: 1 }));
  var sorted = directory.sortSchools([far, close], null, haversine, directory.pilotFor("pentagon"));
  assert.deepStrictEqual(sorted.map(function (s) { return s.id; }), ["close", "far"]);
  assert.strictEqual(directory.presentSchool(close, null, haversine, directory.pilotFor("pentagon")).distanceLabel.indexOf("the Pentagon") !== -1, true);
});

check("haversine fallback uses the base point from NearBaseMatch.BASES", function () {
  var school = directory.normalizeSchool(row({ id: "shift", lat: 38.872, lng: -77.056 }));
  var previous = global.NearBaseMatch;
  global.NearBaseMatch = { BASES: [{ id: "pentagon", name: "Pentagon", lat: 39.872, lng: -77.056 }] };
  try {
    var dist = directory.distanceFor(school, null, haversine, directory.pilotFor("pentagon"));
    assert.strictEqual(dist.from, "base");
    assert.ok(dist.miles > 60);
  } finally {
    if (previous) global.NearBaseMatch = previous;
    else delete global.NearBaseMatch;
  }
});

check("pentagon read does not filter pilot_base and falls back when the distance column is missing", function () {
  var calls = [];
  function client(failDistance) {
    return {
      from: function (table) {
        assert.strictEqual(table, "schools");
        var query = { filters: [] };
        var api = {
          select: function (cols) { query.cols = cols; return api; },
          eq: function (col, val) { query.filters.push([col, val]); return api; },
          order: function (col, opts) { query.order = [col, opts]; return api; },
          range: function () {
            calls.push({ filters: query.filters.slice(), order: query.order.slice(), cols: query.cols });
            if (failDistance && query.cols.indexOf("distance_miles_to_pentagon") !== -1) {
              return Promise.resolve({
                data: null,
                error: { message: "column schools.distance_miles_to_pentagon does not exist", code: "42703" }
              });
            }
            return Promise.resolve({
              data: [row({
                id: "arlington-center",
                name: "Arlington Center",
                pilot_base: "pentagon",
                lat: 38.88,
                lng: -77.06,
                distance_miles_to_pentagon: failDistance ? null : 1.1,
                distance_miles_to_belvoir: 9
              })],
              error: null
            });
          }
        };
        return api;
      }
    };
  }
  calls = [];
  return directory.fetchPilotSchools(client(false), "pentagon").then(function (result) {
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.schools[0].pilotBase, "pentagon");
    assert.strictEqual(result.schools[0].distanceMilesToPentagon, 1.1);
    assert.deepStrictEqual(calls[0].filters, []);
    assert.strictEqual(calls[0].order[0], "id");
    assert.ok(calls[0].cols.indexOf("distance_miles_to_pentagon") !== -1);
    calls = [];
    return directory.fetchPilotSchools(client(false)).then(function (byDefault) {
      assert.strictEqual(byDefault.ok, true);
      assert.deepStrictEqual(calls[0].filters, []);
      calls = [];
      return directory.fetchPilotSchools(client(true), "pentagon").then(function (fallback) {
        assert.strictEqual(fallback.ok, true);
        assert.strictEqual(fallback.schools[0].slug, "arlington-center");
        assert.strictEqual(calls.length, 2);
        assert.strictEqual(calls[1].order[0], "id");
        assert.ok(calls[1].cols.indexOf("distance_miles_to_pentagon") === -1);
        var dist = directory.distanceFor(fallback.schools[0], null, haversine, directory.pilotFor("pentagon"));
        assert.strictEqual(dist.from, "base");
        assert.ok(dist.miles < 2);
        assert.ok(dist.miles !== 9);
        assert.ok(/straight-line mi from the Pentagon$/.test(dist.label));
      });
    });
  });
});

check("website is an http(s) link and never invented", function () {
  assert.strictEqual(directory.websiteHref("https://preschool.example/enroll"), "https://preschool.example/enroll");
  assert.strictEqual(directory.websiteHref("  http://school.example/path  "), "http://school.example/path");
  ["", null, "not a url", "javascript:alert(1)", "data:text/html,hi", "mailto:office@school.example", "//school.example"].forEach(function (bad) {
    assert.strictEqual(directory.websiteHref(bad), "", JSON.stringify(bad));
  });
  var school = directory.normalizeSchool(row({ website: "https://preschool.example/enroll" }));
  assert.strictEqual(school.website, "https://preschool.example/enroll");
  var view = directory.presentSchool(school, null, haversine);
  assert.strictEqual(view.websiteHref, "https://preschool.example/enroll");
  var blank = directory.presentSchool(directory.normalizeSchool(row({ website: "javascript:alert(1)" })), null, haversine);
  assert.strictEqual(blank.websiteHref, "");
  assert.strictEqual(blank.comingSoon, true);
});

check("a CCA-listed URL is not the visit link, and a zip pin is approximate", function () {
  var held = directory.presentSchool(directory.normalizeSchool(row({
    website: null,
    website_status: "unverified_listed",
    cca_listed_website: "https://www.kindercare.com/",
    cca_mccyn_tier: "accredited_plus",
    address: null,
    lat: 38.88,
    lng: -77.1
  })), null, haversine);
  assert.strictEqual(held.websiteHref, "");
  assert.strictEqual(held.websiteStatus, "unverified_listed");
  assert.strictEqual(held.comingSoon, true);
  assert.strictEqual(held.approximate, true);
  assert.strictEqual(held.approximateNote, directory.APPROXIMATE_NOTE);
  assert.strictEqual(held.ccaBadge.label, "On Child Care Aware MCCYN list");
  assert.strictEqual(held.ccaBadge.tier, "Accredited / MCCYN Plus");
  assert.ok(JSON.stringify(held).indexOf("kindercare.com") === -1);
  var participating = directory.mccynListBadge("participating");
  assert.strictEqual(participating.tier, "Participating");
  assert.strictEqual(directory.mccynListBadge("other"), null);
  var verified = directory.presentSchool(directory.normalizeSchool(row({
    website: "https://preschool.example/enroll",
    website_status: "verified",
    cca_listed_website: "https://www.kindercare.com/",
    address: "1 Main St"
  })), null, haversine);
  assert.strictEqual(verified.websiteHref, "https://preschool.example/enroll");
  assert.strictEqual(verified.comingSoon, false);
  assert.strictEqual(verified.approximate, false);
  var source = fs.readFileSync(path.join(__dirname, "..", "site/directory.js"), "utf8");
  var list = source.slice(source.indexOf("var LIST_OPTIONAL"), source.indexOf("var CONFIG_MESSAGE"));
  assert.ok(list.indexOf('"website_status"') !== -1);
  assert.ok(list.indexOf('"cca_mccyn_tier"') !== -1);
  assert.ok(list.indexOf("cca_listed_website") === -1);
  assert.ok(source.indexOf("CCA_MCCYN_LIST_ACCREDITED_PLUS") !== -1);
  assert.ok(source.indexOf("CCA_MCCYN_LIST_PARTICIPATING") !== -1);
  var find = fs.readFileSync(path.join(__dirname, "..", "site/find.html"), "utf8");
  assert.ok(find.indexOf("Website coming soon") !== -1);
  assert.ok(find.indexOf("leaflet.markercluster") !== -1);
  assert.ok(find.indexOf("Show more") !== -1);
  assert.ok(find.indexOf("cca_listed_website") === -1);
});

check("a missing website column retries without adding a pilot filter", function () {
  var calls = [];
  var sb = {
    from: function () {
      var query = { filters: [], cols: "" };
      var api = {
        select: function (cols) { query.cols = cols; return api; },
        eq: function (col, val) { query.filters.push([col, val]); return api; },
        order: function (col, opts) { query.order = [col, opts]; return api; },
        range: function () {
          calls.push({ cols: query.cols, filters: query.filters.slice(), order: query.order[0] });
          if (/(^|,)website(,|$)/.test(query.cols)) {
            return Promise.resolve({ data: null, error: { code: "PGRST204", message: "Could not find the 'website' column of 'schools' in the schema cache" } });
          }
          return Promise.resolve({ data: [row({ id: "kept", name: "Kept", pilot_base: "pentagon" })], error: null });
        }
      };
      return api;
    }
  };
  return directory.fetchPilotSchools(sb, "pentagon").then(function (result) {
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.schools[0].slug, "kept");
    assert.strictEqual(result.schools[0].website, "");
    assert.strictEqual(calls.length, 2);
    assert.ok(/(^|,)website(,|$)/.test(calls[0].cols));
    assert.ok(!/(^|,)website(,|$)/.test(calls[1].cols));
    assert.deepStrictEqual(calls[1].filters, []);
    assert.strictEqual(calls[1].order, "id");
  });
});

check("profile CTA opens a real website and skips a missing or unsafe one", function () {
  var vm = require("vm");
  function run(website) {
    var anchors = [];
    var row = {
      firstChild: null,
      querySelector: function () { return null; },
      insertBefore: function (node) { anchors.push(node); this.firstChild = node; }
    };
    var document = {
      querySelector: function (sel) { return sel === ".cta-row" ? row : null; },
      createElement: function (tag) { return { tagName: String(tag || "").toUpperCase(), attrs: {}, setAttribute: function (k, v) { this.attrs[k] = v; } }; }
    };
    var context = {
      window: { SCHOOLS: [{ slug: "fixture-school", name: "Fixture", website: website }] },
      document: document,
      location: { pathname: "/school/fixture-school.html" },
      URL: URL
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "site/school-page.js"), "utf8"), context);
    return { anchors: anchors, api: context.window.NearBaseSchoolPage };
  }
  var shown = run("https://preschool.example/enroll");
  assert.strictEqual(shown.anchors.length, 1);
  assert.strictEqual(shown.anchors[0].href, "https://preschool.example/enroll");
  assert.strictEqual(shown.anchors[0].target, "_blank");
  assert.strictEqual(shown.anchors[0].rel, "noopener noreferrer");
  assert.strictEqual(shown.anchors[0].className, "btn btn-p");
  assert.strictEqual(shown.anchors[0].textContent, "Visit website");
  assert.strictEqual(shown.anchors[0].attrs["data-nb-website"], "1");
  var missing = run("");
  assert.strictEqual(missing.anchors.length, 1);
  assert.strictEqual(missing.anchors[0].tagName, "SPAN");
  assert.strictEqual(missing.anchors[0].textContent, "Website coming soon");
  assert.strictEqual(missing.anchors[0].href, undefined);
  var unsafe = run("javascript:alert(1)");
  assert.strictEqual(unsafe.anchors.length, 1);
  assert.strictEqual(unsafe.anchors[0].tagName, "SPAN");
  assert.ok(shown.api && typeof shown.api.placeWebsiteCta === "function");
});

check("find and home lead with the Pentagon and still load Belvoir by base", function () {
  var root = path.join(__dirname, "..");
  var html = fs.readFileSync(path.join(root, "site/find.html"), "utf8");
  assert.ok(html.indexOf('src="directory.js"') !== -1);
  assert.ok(html.indexOf("fetchPilotSchools") !== -1);
  assert.ok(html.indexOf("nb-save-school") !== -1);
  assert.ok(html.indexOf("data-slug") !== -1);
  assert.ok(html.indexOf("World_Light_Gray_Base") !== -1);
  assert.ok(html.indexOf("loadDirectory") !== -1);
  assert.ok(html.indexOf("fetchPilotSchools(sb, baseId)") !== -1);
  assert.ok(html.indexOf("pilotFor") !== -1);
  assert.ok(html.indexOf("Pentagon pilot") !== -1);
  assert.ok(html.indexOf("Schools from another base are not shown here.") === -1);
  assert.ok(html.indexOf("doorJurisdiction") !== -1);
  assert.ok(html.indexOf("Evidence profile") !== -1);
  assert.ok(html.indexOf("Quality pathway documented is not MCCYN approval") !== -1);
  assert.ok(html.indexOf("profile.html") !== -1);
  assert.ok(html.indexOf("No Fort Belvoir licensed centers") === -1);
  assert.ok(html.indexOf("Visit website") !== -1);
  assert.ok(html.indexOf('rel="noopener noreferrer"') !== -1);
  assert.ok(html.indexOf('target="_blank"') !== -1);
  assert.ok(html.indexOf("websiteHref") !== -1);
  var index = fs.readFileSync(path.join(root, "site/index.html"), "utf8");
  assert.ok(index.indexOf("Pentagon pilot") !== -1);
  assert.ok(index.indexOf('sel.value = "pentagon"') !== -1);
  assert.ok(index.indexOf("Fort Belvoir and the other bases stay in the list.") !== -1);
  assert.ok(index.indexOf("Fort Belvoir pilot") === -1);
  assert.ok(fs.existsSync(path.join(root, "site/schools.js")));
  var account = fs.readFileSync(path.join(root, "site/account.js"), "utf8");
  assert.ok(account.indexOf("school_slug: slug") !== -1);
  assert.ok(/ready:\s*function/.test(account));
  assert.ok(/client:\s*client/.test(account));
});

check("neighborhood bases stay on the live directory sort", function () {
  global.NearBaseMatch = require(path.join(__dirname, "..", "site/match.js"));
  var anchor = directory.sortBase("reston");
  assert.strictEqual(anchor.baseId, "reston");
  assert.ok(anchor.lat);
  var cms = directory.normalizeSchool({
    id: "ncr-va-vdoe-3573",
    name: "Community Montessori School",
    address: "1700 Reston Parkway",
    city: "Reston",
    state: "VA",
    lat: 38.95,
    lng: -77.36,
    ages_served: "3 months–6 years 11 months",
    hours: "7:30 AM–5:30 PM"
  });
  var older = directory.normalizeSchool({
    id: "older-only",
    name: "Older Only",
    address: "1 Main St",
    city: "Arlington",
    state: "VA",
    lat: 38.87,
    lng: -77.06,
    ages_served: "Ages 3-5",
    hours: "9:00 AM-3:00 PM"
  });
  var unknown = directory.normalizeSchool({
    id: "unknown-age",
    name: "Unknown Age Center",
    city: "Alexandria",
    state: "VA",
    lat: 38.8,
    lng: -77.1
  });
  global.NearBaseMatch = require(path.join(__dirname, "..", "site/match.js"));
  var split = directory.familyPartition([cms, older, unknown], {
    ages: ["infant"],
    childMonths: 6,
    hours: "any",
    milesOf: function () { return 10; }
  });
  assert.deepStrictEqual(split.fit.map(function (school) { return school.id; }), ["ncr-va-vdoe-3573"]);
  assert.deepStrictEqual(split.unconfirmed.map(function (school) { return school.id; }), ["unknown-age"]);
  assert.strictEqual(split.excluded, 1);
  var early = directory.familyPartition([cms], { hours: "early", milesOf: function () { return 3; } });
  assert.strictEqual(early.fit.length, 0);
  assert.strictEqual(early.excluded, 1);
  var find = fs.readFileSync(path.join(__dirname, "..", "site/find.html"), "utf8");
  assert.ok(find.indexOf('href="school/') === -1);
  assert.ok(find.indexOf("profile.html?id=") !== -1);
  assert.ok(find.indexOf("function directoryActive()") !== -1);
  assert.ok(find.indexOf("return true;") !== -1);
  assert.ok(find.indexOf("Clear the search, age, hours, or distance filter") !== -1);
  assert.ok(find.indexOf("title: name") !== -1);
});

Promise.all(pending).then(function () {
  if (failures) {
    console.error("\n" + failures + " failed");
    process.exit(1);
  }
  console.log("\nAll directory checks passed.");
});
