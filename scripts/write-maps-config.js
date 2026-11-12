#!/usr/bin/env node
// Copy GOOGLE_MAPS_BROWSER_KEY into the public billing config at build time.
// The value is a referrer-restricted browser key. This script does not print it
// and does not call Netlify.
var fs = require("fs");
var path = require("path");

var file = path.join(__dirname, "..", "site/billing-config.js");
var key = String(process.env.GOOGLE_MAPS_BROWSER_KEY || "").trim();
if (/[\r\n]/.test(key)) {
  console.error("GOOGLE_MAPS_BROWSER_KEY was rejected.");
  process.exit(1);
}
var source = fs.readFileSync(file, "utf8");
var field = /GOOGLE_MAPS_BROWSER_KEY:\s*"(?:\\.|[^"\\])*"/;
if (!field.test(source)) {
  console.error("site/billing-config.js has no GOOGLE_MAPS_BROWSER_KEY field.");
  process.exit(1);
}
var next = source.replace(field, "GOOGLE_MAPS_BROWSER_KEY: " + JSON.stringify(key));
if (next !== source) fs.writeFileSync(file, next);
if (key) console.log("Wrote GOOGLE_MAPS_BROWSER_KEY into site/billing-config.js (" + key.length + " characters).");
else console.log("GOOGLE_MAPS_BROWSER_KEY is empty. School profiles keep the photo placeholder.");
