#!/usr/bin/env node
// Idempotent: per-school share meta, insight scripts, and twitter:image.
var fs = require("fs");
var path = require("path");

var site = path.join(__dirname, "..", "site");
var schoolDir = path.join(site, "school");
var changed = 0;

function writeIfChanged(file, before, after) {
  if (before !== after) {
    fs.writeFileSync(file, after);
    changed++;
  }
}

fs.readdirSync(schoolDir).filter(function (name) { return name.endsWith(".html"); }).forEach(function (name) {
  var file = path.join(schoolDir, name);
  var slug = name.replace(/\.html$/, "");
  var html = fs.readFileSync(file, "utf8");
  var before = html;
  var image = "https://nearbase.net/.netlify/functions/og-card?slug=" + slug;
  if (!html.includes("og:image:width")) {
    html = html.replace(
      /<meta property="og:image" content="[^"]*">/,
      '<meta property="og:image" content="' + image + '">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">'
    );
  } else {
    html = html.replace(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + image + '">');
  }
  if (!html.includes("twitter:image")) {
    var title = (html.match(/property="og:title" content="([^"]*)"/) || [null, slug])[1];
    html = html.replace(
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:site" content="@nearbasenet">\n<meta name="twitter:title" content="' + title + '">\n<meta name="twitter:image" content="' + image + '">'
    );
  }
  if (!html.includes('"image"')) {
    html = html.replace(
      /"url": "https:\/\/nearbase\.net\/school\/[^"]+"/,
      function (match) { return match + ', "image": "' + image + '"'; }
    );
  }
  if (!html.includes("school-page.js")) {
    html = html.replace(
      "</body>",
      '<script src="../match.js"></script>\n<script src="../insights.js"></script>\n<script src="../school-page.js"></script>\n</body>'
    );
  }
  writeIfChanged(file, before, html);
});

fs.readdirSync(site).filter(function (name) { return name.endsWith(".html"); }).forEach(function (name) {
  var file = path.join(site, name);
  var html = fs.readFileSync(file, "utf8");
  if (!html.includes("og:image") || html.includes("twitter:image")) return;
  var image = (html.match(/property="og:image" content="([^"]*)"/) || [null, "https://nearbase.net/og-card.png"])[1];
  var next = html.replace(
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="' + image + '">'
  );
  writeIfChanged(file, html, next);
});

console.log("updated files:", changed);
