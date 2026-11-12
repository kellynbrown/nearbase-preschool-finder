#!/usr/bin/env node
// Google and social profile helpers. No network, no photo storage.
var assert = require("assert");
var child = require("child_process");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var google = require(path.join(root, "site/google-place.js"));
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

check("browser key comes from GOOGLE_MAPS_BROWSER_KEY and stays empty by default", function () {
  assert.strictEqual(google.browserKey({}), "");
  assert.strictEqual(google.browserKey({ GOOGLE_MAPS_BROWSER_KEY: " referrer-key " }), "referrer-key");
  var config = read("site/billing-config.js");
  assert.ok(config.indexOf('GOOGLE_MAPS_BROWSER_KEY: ""') !== -1);
  assert.ok(read("netlify/functions/public-config.mjs").indexOf("GOOGLE_MAPS_BROWSER_KEY") === -1);
  assert.ok(read("netlify.toml").indexOf("write-maps-config.js") !== -1);
});

check("build script writes the browser key and does not leave it in git", function () {
  var file = path.join(root, "site/billing-config.js");
  var before = fs.readFileSync(file, "utf8");
  try {
    child.execFileSync(process.execPath, [path.join(root, "scripts/write-maps-config.js")], {
      env: Object.assign({}, process.env, { GOOGLE_MAPS_BROWSER_KEY: "referrer-restricted-test" })
    });
    var written = fs.readFileSync(file, "utf8");
    assert.ok(written.indexOf('"referrer-restricted-test"') !== -1);
    assert.ok(written.indexOf('supabaseUrl: ""') !== -1);
  } finally {
    fs.writeFileSync(file, before);
  }
  assert.ok(fs.readFileSync(file, "utf8").indexOf("referrer-restricted-test") === -1);
});

check("Street View uses the Maps Embed streetview URL and a missing key does not invent one", function () {
  assert.strictEqual(google.streetViewEmbedUrl("", 38.87, -77.05), "");
  var url = new URL(google.streetViewEmbedUrl("browser-key", 38.872, -77.056));
  assert.strictEqual(url.origin + url.pathname, "https://www.google.com/maps/embed/v1/streetview");
  assert.strictEqual(url.searchParams.get("key"), "browser-key");
  assert.strictEqual(url.searchParams.get("location"), "38.872000,-77.056000");
  assert.strictEqual(google.placeId("ChIJexampleplace"), "ChIJexampleplace");
  assert.strictEqual(google.placeId("nope"), "");
  assert.strictEqual(google.placeId("javascript:alert(1)"), "");
});

check("photo attributions keep the author name and https profile link", function () {
  var people = google.authorAttributions([
    { displayName: "Alex Example", uri: "https://maps.google.com/person/1", photoURI: "http://cdn.example/face.jpg" },
    { displayName: "", uri: "https://maps.google.com/person/2" }
  ]);
  assert.strictEqual(people.length, 1);
  assert.strictEqual(people[0].displayName, "Alex Example");
  assert.strictEqual(people[0].uri, "https://maps.google.com/person/1");
  assert.strictEqual(people[0].photoURI, "");
  assert.ok(google.attributionLine(people).indexOf("Photos from Google") === 0);
  assert.ok(google.attributionLine(people).indexOf("Alex Example") !== -1);
});

check("social embeds stay on Instagram and Facebook and do not copy images", function () {
  var post = google.instagramEmbed("https://www.instagram.com/p/Abcd12345/?img_index=1");
  assert.strictEqual(post.embedUrl, "https://www.instagram.com/p/Abcd12345/embed");
  assert.ok(post.notice.indexOf("does not copy") !== -1);
  var profile = google.instagramEmbed("https://instagram.com/examplepreschool/");
  assert.strictEqual(profile.embedUrl, "");
  assert.strictEqual(profile.href, "https://www.instagram.com/examplepreschool");
  assert.strictEqual(google.instagramEmbed("https://cmsreston.com/photo.jpg"), null);
  assert.strictEqual(google.instagramEmbed("http://www.instagram.com/p/Abcd12345/"), null);
  var page = google.facebookEmbed("https://m.facebook.com/ExamplePreschool");
  assert.ok(page.embedUrl.indexOf("https://www.facebook.com/plugins/page.php") === 0);
  assert.ok(page.embedUrl.indexOf("tabs=timeline") !== -1);
  assert.ok(page.notice.indexOf("does not copy") !== -1);
  var story = google.facebookEmbed("https://www.facebook.com/ExamplePreschool/posts/12345");
  assert.ok(story.embedUrl.indexOf("https://www.facebook.com/plugins/post.php") === 0);
  assert.strictEqual(google.facebookEmbed("https://youtube.com/watch?v=abcdef"), null);
});

check("Google photos are profile-only and come after the school media gallery", function () {
  var profile = read("site/profile.html");
  var find = read("site/find.html");
  var directory = read("site/directory.js");
  assert.ok(profile.indexOf('id="gallery"') < profile.indexOf('id="googlePhotos"'));
  assert.ok(profile.indexOf('id="googlePhotos"') < profile.indexOf('id="streetView"'));
  assert.ok(profile.indexOf("school_media_public") !== -1);
  assert.ok(profile.indexOf("mountProfile") !== -1);
  assert.ok(find.indexOf("maps.googleapis.com") === -1);
  assert.ok(find.indexOf("fetchFields") === -1);
  assert.ok(find.indexOf("google-place.js") === -1);
  var list = directory.slice(directory.indexOf("var LIST_OPTIONAL"), directory.indexOf("var CONFIG_MESSAGE"));
  assert.ok(list.indexOf("google_place_id") === -1);
  assert.ok(list.indexOf("instagram_url") === -1);
  assert.ok(directory.indexOf('["eligibility_evidence", "google_place_id", "instagram_url", "facebook_url"]') !== -1);
  var sql = read("supabase/migrations/20261112020000_school_google_and_social.sql");
  assert.ok(sql.indexOf("google_place_id") !== -1);
  assert.ok(sql.indexOf("instagram_url") !== -1);
  assert.ok(sql.indexOf("facebook_url") !== -1);
  assert.ok(!/insert\s+into\s+public\.schools/i.test(sql));
  assert.ok(sql.indexOf("photo") !== -1);
});

if (failures) {
  console.error("\n" + failures + " google-place check" + (failures === 1 ? "" : "s") + " failed.");
  process.exit(1);
}
console.log("\nGoogle place checks passed.");
