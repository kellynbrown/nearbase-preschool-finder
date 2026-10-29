// Share image for a school listing. No paid font or image API.
// Crawlers (X, Facebook, iMessage) request this URL from og:image.
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const W = 1200;
const H = 630;

// 5x7 glyphs, bit 4 is the left column. Uppercase share cards.
const FONT = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b10010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  "2": [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  "3": [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  "6": [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0b01100, 0b01100],
  ",": [0, 0, 0, 0, 0b00100, 0b00100, 0b01000],
  "'": [0b00100, 0b00100, 0b01000, 0, 0, 0, 0],
  "-": [0, 0, 0, 0b11111, 0, 0, 0],
  "/": [0b00001, 0b00010, 0b00100, 0b00100, 0b01000, 0b10000, 0],
  "+": [0, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0],
  ":": [0, 0b01100, 0b01100, 0, 0b01100, 0b01100, 0],
  "&": [0b01100, 0b10010, 0b10100, 0b01000, 0b10101, 0b10010, 0b01101]
};

const GREEN = [8, 80, 65, 255];
const MINT = [29, 158, 117, 255];
const CREAM = [225, 245, 238, 255];
const WHITE = [255, 255, 255, 255];
const GOLD = [200, 146, 42, 255];

function loadSchools() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(process.cwd(), "site/schools.js"),
    join(here, "../../site/schools.js"),
    join(process.cwd(), "schools.js")
  ];
  for (const file of candidates) {
    try {
      const context = { window: {} };
      vm.createContext(context);
      vm.runInContext(readFileSync(file, "utf8"), context);
      if (Array.isArray(context.window.SCHOOLS)) return context.window.SCHOOLS;
    } catch (err) {
      // try the next path
    }
  }
  return [];
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function createCanvas() {
  const px = Buffer.alloc(W * H * 4);
  return {
    px,
    set(x, y, color) {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 4;
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
      px[i + 3] = color[3];
    }
  };
}

function fillRect(canvas, x, y, w, h, color) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) canvas.set(xx, yy, color);
  }
}

function glyphWidth(scale) {
  return 5 * scale + scale;
}

function measure(text, scale) {
  return [...text].reduce(function (sum, ch) {
    return sum + (FONT[ch] ? glyphWidth(scale) : Math.ceil(scale * 3));
  }, 0);
}

function drawText(canvas, text, x, y, scale, color) {
  let cursor = x;
  for (const ch of text) {
    const rows = FONT[ch];
    if (!rows) {
      cursor += Math.ceil(scale * 3);
      continue;
    }
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if ((rows[row] & (1 << (4 - col))) === 0) continue;
        fillRect(canvas, cursor + col * scale, y + row * scale, scale, scale, color);
      }
    }
    cursor += glyphWidth(scale);
  }
  return cursor;
}

function clean(text) {
  return String(text || "")
    .toUpperCase()
    .replace(/&AMP;/g, "&")
    .replace(/[^A-Z0-9 .,'&/+:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wrap(text, scale, maxWidth) {
  const words = clean(text).split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach(function (word) {
    const next = line ? line + " " + word : word;
    if (measure(next, scale) <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

export function renderCard(school) {
  const canvas = createCanvas();
  fillRect(canvas, 0, 0, W, H, GREEN);
  fillRect(canvas, 0, 0, 18, H, MINT);
  fillRect(canvas, 72, 78, 96, 8, GOLD);
  drawText(canvas, "NEARBASE", 72, 108, 5, CREAM);

  const name = school && school.name ? school.name : "Find a preschool before you unpack";
  let scale = 9;
  let lines = wrap(name, scale, 1040);
  if (lines.length > 2 || lines.some(function (line) { return measure(line, scale) > 1040; })) {
    scale = 7;
    lines = wrap(name, scale, 1040);
  }
  let y = 180;
  lines.forEach(function (line) {
    drawText(canvas, line, 72, y, scale, WHITE);
    y += 7 * scale + 16;
  });

  const loc = clean(school && school.loc ? school.loc : "National Capital Region");
  y += 8;
  drawText(canvas, loc, 72, y, 4, CREAM);
  y += 7 * 4 + 28;

  const badges = ((school && school.badges) || []).map(function (b) { return clean(b.t || b); }).filter(Boolean).slice(0, 3);
  let x = 72;
  badges.forEach(function (badge) {
    const text = badge.slice(0, 22);
    const tw = measure(text, 3);
    if (x + tw + 36 > 1120) return;
    fillRect(canvas, x, y, tw + 28, 36, MINT);
    drawText(canvas, text, x + 14, y + 8, 3, WHITE);
    x += tw + 44;
  });

  drawText(canvas, "PRESCHOOL FINDER FOR MILITARY FAMILIES", 72, 548, 3, CREAM);
  drawText(canvas, "LISTING PREVIEW  ·  NOT A LIVE WAITLIST", 72, 580, 3, GOLD);
  return encodePng(W, H, canvas.px);
}

export default async function handler(request) {
  let slug = "";
  try {
    slug = new URL(request.url).searchParams.get("slug") || "";
  } catch (err) {
    slug = "";
  }
  const school = slug ? loadSchools().find(function (s) { return s.slug === slug; }) : null;
  const png = renderCard(school);
  return new Response(png, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400",
      "x-content-type-options": "nosniff"
    }
  });
}

if (process.argv.includes("--self-test")) {
  const schools = loadSchools();
  const school = schools.find(function (s) { return s.slug === "toth-montessori"; }) || schools[0];
  const png = renderCard(school);
  const fs = await import("node:fs");
  fs.writeFileSync("/tmp/og-toth.png", png);
  fs.writeFileSync("/tmp/og-generic.png", renderCard(null));
  if (png[0] !== 137 || png[1] !== 80) {
    console.error("not a png");
    process.exit(1);
  }
  console.log("png bytes", png.length, "school", school && school.name);
}
