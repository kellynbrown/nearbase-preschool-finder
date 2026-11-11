#!/usr/bin/env node
// Read-only check against the public Supabase directory. No writes.
var assert = require("assert");

var PROJECT = "https://ipwvweqqzvozuvgkwxpm.supabase.co";
var PUBLIC_CONFIG = "https://nearbase.net/.netlify/functions/public-config";
var MD_IDS = [
  "ncr-md-license-255033",
  "ncr-md-license-257812",
  "ncr-md-license-250711",
  "ncr-md-license-130288",
  "ncr-md-license-162124",
  "ncr-md-license-40321",
  "ncr-md-license-253443"
];
var DISTANCE_KEYS = [
  "pentagon", "fort-belvoir", "fort-myer", "jb-anacostia-bolling", "nsa-bethesda",
  "quantico", "fort-detrick", "washington-navy-yard", "jb-andrews", "fort-meade",
  "fort-mcnair", "coast-guard-hq"
];

function fail(message) {
  console.error("  FAIL  " + message);
  process.exit(1);
}

function request(url, key, headers) {
  var init = { method: "GET", headers: Object.assign({ accept: "application/json", apikey: key, authorization: "Bearer " + key }, headers || {}) };
  return fetch(url, init).then(function (response) {
    return response.text().then(function (body) {
      var parsed = null;
      try { parsed = body ? JSON.parse(body) : null; } catch (error) { parsed = null; }
      return { status: response.status, headers: response.headers, body: parsed, raw: body };
    });
  });
}

request(PUBLIC_CONFIG, "").then(function (configResponse) {
  var config = configResponse.body || {};
  var key = String(config.supabaseAnonKey || "");
  var url = String(config.supabaseUrl || "");
  if (!key || url.indexOf("ipwvweqqzvozuvgkwxpm") === -1) fail("public anon config was not available");
  var base = PROJECT + "/rest/v1/schools";
  return request(base + "?select=id&limit=1", key, { prefer: "count=exact" }).then(function (countResponse) {
    var range = countResponse.headers.get("content-range") || "";
    var total = Number((range.split("/")[1] || "").trim());
    assert.ok(total >= 500, "expected at least 500 schools, saw " + range);
    var idList = MD_IDS.map(function (id) { return '"' + id + '"'; }).join(",");
    return request(base + "?select=id,name,state,jurisdiction,eligibility_path,quality_rating,pilot_base,installation_distances_miles,website&id=in.(" + idList + ")", key).then(function (mdResponse) {
      assert.strictEqual(mdResponse.status, 200);
      var rows = mdResponse.body || [];
      assert.strictEqual(rows.length, MD_IDS.length);
      rows.forEach(function (row) {
        assert.strictEqual(row.state, "MD");
        assert.strictEqual(row.eligibility_path, "DOD_RECOGNIZED_AMI_USA_ACCREDITATION");
        assert.strictEqual(row.quality_rating, null);
        assert.ok(/^https?:\/\//.test(row.website));
        DISTANCE_KEYS.forEach(function (distanceKey) {
          assert.strictEqual(typeof row.installation_distances_miles[distanceKey], "number", distanceKey);
        });
      });
      var mater = rows.filter(function (row) { return row.id === "ncr-md-license-162124"; })[0];
      assert.strictEqual(mater.pilot_base, "nsa-bethesda");
      assert.ok(mater.installation_distances_miles["fort-meade"] > 0);
      return request(base + "?select=id,eligibility_evidence&id=eq.ncr-md-license-162124", key).then(function (evidenceResponse) {
        var evidence = evidenceResponse.body && evidenceResponse.body[0] && evidenceResponse.body[0].eligibility_evidence;
        assert.strictEqual(evidence.status, "quality_pathway_documented_not_family_approval");
        assert.ok(evidence.eligible_age_scope.indexOf("Recognized") !== -1);
        assert.ok(/^https:/.test(evidence.accreditation_source_url));
        return request(base + "?select=id&eligibility_path=is.null&limit=1", key, { prefer: "count=exact" }).then(function (pendingResponse) {
          var pendingRange = pendingResponse.headers.get("content-range") || "";
          var pending = Number((pendingRange.split("/")[1] || "").trim());
          assert.ok(pending >= 195, "expected legacy rows without a pathway, saw " + pendingRange);
          console.log("  ok  live directory has " + total + " rows, 7 Maryland AMI records, and " + pending + " rows with verification evidence pending");
          console.log("\nLive NCR read passed.");
        });
      });
    });
  });
}).catch(function (error) {
  console.error(error && error.stack || error);
  process.exit(1);
});
