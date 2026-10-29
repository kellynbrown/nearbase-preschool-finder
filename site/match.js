// NearBase family match.
// Client-side, no network. Scores use only fields on the school record.
// Missing facts are neutral, not a "no", and each factor says why.
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NearBaseMatch = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var PROFILE_KEY = "nb_family";
  var QUIZ_KEY = "nb_quiz_votes";

  // Map pins and the match use the same coordinates.
  var BASES = [
    { id: "pentagon", name: "Pentagon", lat: 38.872, lng: -77.056, kind: "installation" },
    { id: "belvoir", name: "Fort Belvoir", lat: 38.71, lng: -77.15, kind: "installation" },
    { id: "jbab", name: "Joint Base Anacostia-Bolling", lat: 38.843, lng: -77.016, kind: "installation" },
    { id: "andrews", name: "Joint Base Andrews", lat: 38.812, lng: -76.867, kind: "installation" },
    { id: "meade", name: "Fort Meade", lat: 39.108, lng: -76.771, kind: "installation" },
    { id: "usna", name: "Naval Academy / Annapolis", lat: 38.975, lng: -76.49, kind: "installation" },
    { id: "quantico", name: "MCB Quantico", lat: 38.524, lng: -77.303, kind: "installation" },
    { id: "navyyard", name: "Navy Yard", lat: 38.876, lng: -77.003, kind: "installation" },
    { id: "culmore", name: "Culmore / Bailey's Crossroads", lat: 38.856, lng: -77.128, kind: "area" },
    { id: "germantown", name: "Germantown / Rockville", lat: 39.16, lng: -77.0, kind: "area" },
    { id: "reston", name: "Reston / Herndon", lat: 38.95, lng: -77.33, kind: "area" }
  ];

  var AGE_IDS = ["infant", "toddler", "pk"];
  var PHILOSOPHY_IDS = ["montessori", "play", "reggio", "waldorf", "academic", "nature", "bilingual"];
  var HOURS_IDS = ["any", "early", "duty", "half"];
  var TIMING_IDS = ["now", "summer", "planning", "unsure"];

  var AGE_LABEL = { infant: "infant (under 18 months)", toddler: "toddler (18 months–3)", pk: "preschool (3–5)" };
  var PHILOSOPHY_LABEL = {
    montessori: "Montessori", play: "play-based", reggio: "Reggio", waldorf: "Waldorf",
    academic: "academic", nature: "nature-based", bilingual: "bilingual"
  };
  var AGE_RANGE = { infant: [0, 17], toddler: [18, 35], pk: [36, 71] };

  function defaultProfile() {
    return {
      baseId: "pentagon",
      ages: [],
      philosophies: [],
      hours: "any",
      timing: "unsure",
      mccyn: false,
      subsidy: false,
      efmp: false,
      quiz: null
    };
  }

  function asArray(v) {
    return Array.isArray(v) ? v : [];
  }

  function unique(list) {
    var out = [];
    list.forEach(function (item) { if (out.indexOf(item) === -1) out.push(item); });
    return out;
  }

  function baseById(id) {
    for (var i = 0; i < BASES.length; i++) if (BASES[i].id === id) return BASES[i];
    return BASES[0];
  }

  function normalizeProfile(input) {
    var src = input || {};
    var p = defaultProfile();
    p.baseId = BASES.some(function (b) { return b.id === src.baseId; }) ? src.baseId : p.baseId;
    p.ages = unique(asArray(src.ages).filter(function (a) { return AGE_IDS.indexOf(a) !== -1; }));
    p.philosophies = unique(asArray(src.philosophies).filter(function (a) { return PHILOSOPHY_IDS.indexOf(a) !== -1; }));
    p.hours = HOURS_IDS.indexOf(src.hours) !== -1 ? src.hours : "any";
    p.timing = TIMING_IDS.indexOf(src.timing) !== -1 ? src.timing : "unsure";
    p.mccyn = !!src.mccyn;
    p.subsidy = !!src.subsidy;
    p.efmp = !!src.efmp;
    p.quiz = src.quiz || null;
    return p;
  }

  function timingFromMonth(ym, now) {
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return "unsure";
    var parts = ym.split("-");
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var clock = now instanceof Date ? now : new Date();
    var delta = (y * 12 + (m - 1)) - (clock.getFullYear() * 12 + clock.getMonth());
    if (delta <= 3) return "now";
    if (delta <= 8) return "summer";
    return "planning";
  }

  function philosophiesFromVotes(votes) {
    var v = votes || {};
    var ranked = PHILOSOPHY_IDS.map(function (k) { return [k, Number(v[k]) || 0]; })
      .sort(function (a, b) { return b[1] - a[1]; });
    if (!ranked[0][1]) return [];
    var top = ranked[0][1];
    var floor = Math.max(1, Math.ceil(top * 0.67));
    return ranked.filter(function (pair) { return pair[1] >= floor; }).map(function (pair) { return pair[0]; });
  }

  function mergeVotes(a, b) {
    var out = {};
    var keys = {};
    Object.keys(a || {}).concat(Object.keys(b || {})).forEach(function (k) { keys[k] = true; });
    Object.keys(keys).forEach(function (k) {
      out[k] = ((Number(a && a[k]) || 0) + (Number(b && b[k]) || 0)) / 2;
    });
    return out;
  }

  function voteDisagreements(a, b) {
    return PHILOSOPHY_IDS.filter(function (k) {
      var x = Number(a && a[k]) || 0;
      var y = Number(b && b[k]) || 0;
      if (x === 0 && y === 0) return false;
      if (x === 0 || y === 0) return true;
      return Math.max(x, y) >= Math.min(x, y) * 2 && Math.abs(x - y) >= 2;
    });
  }

  function withQuiz(profile, votes, who) {
    var p = normalizeProfile(profile);
    var philosophies = philosophiesFromVotes(votes);
    if (philosophies.length) p.philosophies = philosophies;
    p.quiz = { who: who || "family", votes: votes || {}, at: new Date().toISOString() };
    return p;
  }

  function haversineMiles(lat1, lng1, lat2, lng2) {
    if (![lat1, lng1, lat2, lng2].every(function (n) { return typeof n === "number" && isFinite(n); })) return null;
    var R = 3958.8;
    var p = Math.PI / 180;
    var dLat = (lat2 - lat1) * p;
    var dLng = (lng2 - lng1) * p;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function normText(s) {
    return String(s || "").replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim();
  }

  function corpus(school) {
    var badges = asArray(school && school.badges).map(function (b) { return normText(b && b.t); }).filter(Boolean);
    var tags = asArray(school && school.tags).map(function (t) { return normText(t).toLowerCase(); });
    var quote = normText(school && school.quote);
    var name = normText(school && school.name);
    var loc = normText(school && school.loc);
    var blob = [name, loc, quote].concat(badges).concat(tags).join(" \n ");
    return { badges: badges, tags: tags, quote: quote, name: name, loc: loc, blob: blob, lower: blob.toLowerCase() };
  }

  function firstMatch(list, re) {
    for (var i = 0; i < list.length; i++) if (re.test(list[i])) return list[i];
    return "";
  }

  function toMonths(n, unit) {
    var u = String(unit || "").toLowerCase();
    if (/^wk|^week/.test(u)) return n * 12 / 52;
    if (/^yr|^year/.test(u)) return n * 12;
    return n;
  }

  function parseAge(text) {
    var src = normText(text);
    var stripped = src.replace(/\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?\s*mo(?:nth)?s?\s*wait(?:list)?/ig, " ");
    var min = null;
    var max = null;
    var open = false;
    function add(a, b) {
      if (a != null && isFinite(a)) min = min == null ? a : Math.min(min, a);
      if (b == null) open = true;
      else if (isFinite(b)) max = max == null ? b : Math.max(max, b);
    }
    var reRange = /(\d+(?:\.\d+)?)\s*(wks?|weeks?|mos?|months?|yrs?|years?)\s*-\s*(\d+(?:\.\d+)?)\s*(wks?|weeks?|mos?|months?|yrs?|years?)/ig;
    var m;
    while ((m = reRange.exec(stripped))) add(toMonths(Number(m[1]), m[2]), toMonths(Number(m[3]), m[4]));
    var rePlus = /(\d+(?:\.\d+)?)\s*(wks?|weeks?|mos?|months?|yrs?|years?)\s*\+/ig;
    while ((m = rePlus.exec(stripped))) add(toMonths(Number(m[1]), m[2]), null);
    var reAges = /ages?\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/ig;
    while ((m = reAges.exec(stripped))) add(Number(m[1]) * 12, Number(m[2]) * 12 + 11);
    var reAgesPlus = /ages?\s*(\d+(?:\.\d+)?)\s*\+/ig;
    while ((m = reAgesPlus.exec(stripped))) add(Number(m[1]) * 12, null);
    var reYears = /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:yrs?|years?)/ig;
    while ((m = reYears.exec(stripped))) add(Number(m[1]) * 12, Number(m[2]) * 12 + 11);
    if (open) max = null;
    var kw = [];
    if (/\b(nido|infant)\b/i.test(stripped)) kw.push("infant");
    if (/\bpk\s*-?\s*3\b|\bpre-?k\b/i.test(stripped)) kw.push("pk");
    if (min == null && kw.indexOf("pk") !== -1) min = 36;
    var known = min != null || max != null || kw.length > 0;
    return { known: known, min: min, max: max, keywords: kw };
  }

  function ageCovers(bounds, band) {
    if (!bounds.known) return null;
    var span = AGE_RANGE[band];
    if (bounds.min == null && bounds.max == null) {
      if (bounds.keywords.indexOf(band) !== -1) return true;
      return null;
    }
    var lo = bounds.min == null ? 0 : bounds.min;
    var hi = bounds.max == null ? 216 : bounds.max;
    return hi >= span[0] && lo <= span[1];
  }

  function parseClock(h, minute, ap) {
    var hh = Number(h);
    var mm = minute ? Number(minute) : 0;
    if (ap) {
      var a = ap.toLowerCase();
      if (a === "pm" && hh < 12) hh += 12;
      if (a === "am" && hh === 12) hh = 0;
    }
    return hh * 60 + mm;
  }

  function parseHours(text) {
    var src = normText(text);
    var half = /half-?\s*day|part-?\s*day/i.test(src);
    var range = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(src);
    var open = null;
    var close = null;
    var evidence = "";
    if (range) {
      var startAp = range[3] || (range[6] && range[6].toLowerCase() === "pm" && Number(range[1]) <= 11 ? "am" : "");
      open = parseClock(range[1], range[2], startAp);
      close = parseClock(range[4], range[5], range[6]);
      if (close != null && open != null && close <= open) close += 12 * 60;
      evidence = range[0];
    } else {
      var only = /(?:opens|open|before care at|before-care at)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(src);
      if (only) {
        open = parseClock(only[1], only[2], only[3]);
        evidence = only[0];
      }
    }
    var qualitative = "";
    if (open == null && /long hours/i.test(src)) qualitative = "long hours";
    var known = open != null || half || !!qualitative;
    return { known: known, open: open, close: close, half: half && open == null, qualitative: qualitative, evidence: evidence || (half ? "half day" : qualitative) };
  }

  function clockLabel(mins) {
    if (mins == null) return "";
    var h24 = Math.floor(mins / 60) % 24;
    var mm = mins % 60;
    var ap = h24 >= 12 ? "pm" : "am";
    var h = h24 % 12;
    if (h === 0) h = 12;
    return h + (mm ? ":" + (mm < 10 ? "0" : "") + mm : "") + ap;
  }

  function readSignals(school) {
    var c = corpus(school || {});
    var badgeText = c.badges.join(" \n ");
    var ageText = [c.name, c.quote, badgeText].join(" \n ");
    var age = parseAge(ageText);
    var ageEvidence = c.badges.filter(function (b) {
      return /(mo|month|wk|week|yr|year|age|nido|infant|pk3|pre-k|prek)/i.test(b);
    });
    if (!ageEvidence.length && age.known && c.quote && /(mo|month|wk|age|nido|infant|pk)/i.test(c.quote)) ageEvidence = [c.quote];
    // The finder already uses the toddler tag to mean "18mo+".
    if (c.tags.indexOf("toddler") !== -1) {
      if (age.keywords.indexOf("toddler") === -1) age.keywords.push("toddler");
      if (age.min == null && age.max == null) age.known = true;
      if (!ageEvidence.length) ageEvidence = ["directory tag, 18mo+"];
    }
    var hours = parseHours(badgeText + " \n " + c.quote);
    var philosophies = [];
    function addP(id, re) { if (re.test(c.lower) && philosophies.indexOf(id) === -1) philosophies.push(id); }
    addP("montessori", /\bmontessori\b|\bami\b|\bams\b/);
    addP("play", /play-based|play based|\bplayschool\b/);
    addP("reggio", /reggio/);
    addP("waldorf", /waldorf|steiner/);
    addP("academic", /\bstem\b|academic|rigorous curriculum|rigorous academics/);
    addP("nature", /forest school|nature-based|nature-inspired|nature-first|nature based|outdoor daily/);
    addP("bilingual", /bilingual|immersion|\bspanish\b|\bfrench\b|\bmandarin\b|dual language|languages/);
    var mccynEvidence = firstMatch(c.badges, /\bmccyn\b/i) || (/\bmccyn\b/i.test(c.quote) ? c.quote : "");
    var discountEvidence = firstMatch(c.badges, /mil(?:itary)? discount|rank-based|dod fee|fee assistance/i) ||
      (/mil(?:itary)? discount|fee assistance/i.test(c.quote) ? c.quote : "");
    var subsidyEvidence = "";
    if (school && (school.score === "FREE" || school.tier === "fr")) subsidyEvidence = school.score === "FREE" ? "FREE" : "free tier";
    if (!subsidyEvidence) subsidyEvidence = firstMatch(c.badges, /head start|subsidy|sliding|free charter|free dcps|free eligible|free early/i);
    var onPost = /on-post|on post/.test(c.lower);
    var midYearEvidence = firstMatch(c.badges, /mid-year|rolling admission|pcs|portfolio|flexible enrollment/i) ||
      (/(mid-year|rolling admission|pcs transition|pcs portfolio)/i.test(c.quote) ? c.quote : "");
    var lotteryEvidence = firstMatch(c.badges, /lottery/i);
    var waitEvidence = firstMatch(c.badges, /waitlist|wait list/i) || (/waitlist/i.test(c.quote) ? c.quote : "");
    var waitMonths = null;
    var waitMatch = /(\d+)\s*-\s*(\d+)\s*mo(?:nth)?s?\s*wait/i.exec(c.lower) || /wait(?:list)?[^\d]{0,12}(\d+)\s*-\s*(\d+)\s*mo/i.exec(c.lower);
    if (waitMatch) waitMonths = [Number(waitMatch[1]), Number(waitMatch[2])];
    var efmpEvidence = firstMatch(c.badges, /efmp|special ed|special needs|inclusion|sped/i) ||
      (/\befmp\b|special needs|inclusion/i.test(c.quote) ? c.quote : "");
    var directory = null;
    if (school && school.score != null && school.score !== "" && isFinite(Number(school.score))) {
      directory = Math.max(0, Math.min(100, Math.round(Number(school.score))));
    }
    return {
      corpus: c,
      age: age,
      ageEvidence: ageEvidence,
      hours: hours,
      philosophies: philosophies,
      mccyn: !!mccynEvidence,
      mccynEvidence: mccynEvidence,
      discount: !!discountEvidence,
      discountEvidence: discountEvidence,
      subsidy: !!subsidyEvidence,
      subsidyEvidence: subsidyEvidence,
      onPost: onPost,
      midYear: !!midYearEvidence,
      midYearEvidence: midYearEvidence,
      lottery: !!lotteryEvidence,
      lotteryEvidence: lotteryEvidence,
      waitEvidence: waitEvidence,
      waitMonths: waitMonths,
      efmp: !!efmpEvidence,
      efmpEvidence: efmpEvidence,
      directory: directory
    };
  }

  function factor(id, label, weight, status, score, detail) {
    return { id: id, label: label, weight: weight, status: status, score: score, detail: detail };
  }

  function na(id, label) { return factor(id, label, 0, "na", null, ""); }
  function unknown(id, label, weight, detail) { return factor(id, label, weight, "unknown", null, detail); }
  function known(id, label, weight, score, detail) {
    return factor(id, label, weight, "known", Math.max(0, Math.min(100, Math.round(score))), detail);
  }

  function distancePoints(miles, onPost) {
    if (onPost) return 100;
    if (miles == null) return null;
    if (miles <= 3) return 100;
    if (miles <= 7) return 88;
    if (miles <= 12) return 74;
    if (miles <= 18) return 58;
    if (miles <= 28) return 40;
    if (miles <= 40) return 26;
    return 12;
  }

  function isOnThisBase(school, base, signals) {
    if (!signals.onPost) return false;
    var blob = signals.corpus.lower;
    var keys = {
      belvoir: /belvoir/,
      meade: /meade/,
      quantico: /quantico/,
      andrews: /andrews/,
      jbab: /jbab|bolling|anacostia/,
      pentagon: /pentagon/,
      usna: /annapolis|naval academy|usna/,
      navyyard: /navy yard/
    };
    return !!(keys[base.id] && keys[base.id].test(blob));
  }

  function weightsFor(profile) {
    var w = { distance: 28, age: 16, philosophy: 12, hours: 12, militaryAid: 12, pcs: 10, waitlist: 8, efmp: 0, directory: 2 };
    function move(from, amount, to) {
      var take = Math.min(w[from], amount);
      w[from] -= take;
      w[to] += take;
    }
    if (!profile.ages.length) move("age", w.age, "distance");
    if (!profile.philosophies.length) move("philosophy", w.philosophy, "distance");
    if (profile.hours === "any") move("hours", w.hours, "distance");
    if (!profile.mccyn && !profile.subsidy) move("militaryAid", 8, "distance");
    if (profile.efmp) {
      var keys = Object.keys(w).filter(function (k) { return k !== "efmp"; });
      var sum = keys.reduce(function (s, k) { return s + w[k]; }, 0);
      keys.forEach(function (k) { w[k] = Math.round(w[k] * 86 / sum); });
      var drift = 86 - keys.reduce(function (s, k) { return s + w[k]; }, 0);
      w.distance += drift;
      w.efmp = 14;
    }
    return w;
  }

  function scoreDistance(school, signals, base, weight) {
    var miles = haversineMiles(base.lat, base.lng, Number(school.lat), Number(school.lng));
    var onPost = isOnThisBase(school, base, signals);
    var points = distancePoints(miles, onPost);
    if (points == null) {
      return {
        factor: unknown("distance", "Distance", weight, "This listing has no map coordinates, so commute is unknown."),
        miles: null
      };
    }
    var where = base.kind === "installation" ? base.name : base.name;
    var detail = onPost
      ? "Listed as on-post at " + where + ". Straight-line distance to the map pin is about " + miles.toFixed(1) + " miles. Drive time is not estimated."
      : "About " + miles.toFixed(1) + " straight-line miles from " + where + ". Drive time is not estimated.";
    return { factor: known("distance", "Distance", weight, points, detail), miles: miles };
  }

  function scoreAge(signals, profile, weight) {
    if (!weight) return na("age", "Ages");
    if (!signals.age.known) {
      return unknown("age", "Ages", weight, "Ages served are not in this listing. The school is not removed for that.");
    }
    var covered = [];
    var missed = [];
    var unsure = [];
    profile.ages.forEach(function (band) {
      var hit = ageCovers(signals.age, band);
      if (hit === true) covered.push(band);
      else if (hit === false) missed.push(band);
      else unsure.push(band);
    });
    if (!covered.length && !missed.length) {
      return unknown("age", "Ages", weight, "Ages served are not specific enough in this listing.");
    }
    var score;
    if (!missed.length && covered.length) score = unsure.length ? 78 : 100;
    else if (!covered.length && missed.length && !unsure.length) score = 16;
    else if (covered.length && missed.length) score = 46;
    else score = 40;
    var ev = signals.ageEvidence.length ? " Listing: " + signals.ageEvidence.slice(0, 2).join("; ") + "." : "";
    var detail = "You asked about " + profile.ages.map(function (a) { return AGE_LABEL[a]; }).join(" and ") + ".";
    if (covered.length) detail += " In range: " + covered.map(function (a) { return AGE_LABEL[a]; }).join(", ") + ".";
    if (missed.length) detail += " Outside the ages written down: " + missed.map(function (a) { return AGE_LABEL[a]; }).join(", ") + ".";
    if (unsure.length) detail += " Not specified: " + unsure.map(function (a) { return AGE_LABEL[a]; }).join(", ") + ".";
    return known("age", "Ages", weight, score, detail + ev);
  }

  function scorePhilosophy(signals, profile, weight) {
    if (!weight) return na("philosophy", "Philosophy");
    if (!signals.philosophies.length) {
      return unknown("philosophy", "Philosophy", weight, "Program philosophy is not in this listing.");
    }
    var wanted = profile.philosophies;
    var hit = wanted.filter(function (id) { return signals.philosophies.indexOf(id) !== -1; });
    var listed = signals.philosophies.map(function (id) { return PHILOSOPHY_LABEL[id]; }).join(", ");
    var asked = wanted.map(function (id) { return PHILOSOPHY_LABEL[id]; }).join(", ");
    if (hit.length === wanted.length) {
      return known("philosophy", "Philosophy", weight, 100, "Listing reads as " + listed + ", which covers what you asked for (" + asked + ").");
    }
    if (hit.length) {
      return known("philosophy", "Philosophy", weight, 76, "Partial philosophy match. Listing reads as " + listed + ". You asked for " + asked + ".");
    }
    return known("philosophy", "Philosophy", weight, 30, "Listing reads as " + listed + ". You asked for " + asked + ", and that philosophy is not what the listing describes.");
  }

  function scoreHours(signals, profile, weight) {
    if (!weight) return na("hours", "Hours");
    var h = signals.hours;
    if (!h.known) return unknown("hours", "Hours", weight, "Open and close times are not in this listing.");
    var need = profile.hours;
    var score = 50;
    var extra = "";
    if (h.qualitative && h.open == null && !h.half) {
      score = need === "half" ? 55 : 62;
      extra = "The listing says \"" + h.qualitative + "\" and does not give clock times.";
    } else if (h.half) {
      score = need === "half" ? 96 : (need === "early" ? 22 : 34);
      extra = "Listing describes a half day, not a full duty-day schedule.";
    } else if (need === "early") {
      if (h.open <= 390) score = h.close == null ? 84 : 100;
      else if (h.open <= 420) score = 82;
      else if (h.open <= 450) score = 64;
      else if (h.open <= 480) score = 46;
      else score = 28;
      extra = "You need an early open. Listing open time is " + clockLabel(h.open) + (h.close != null ? ", close " + clockLabel(h.close) : ", close not listed") + ".";
    } else if (need === "duty") {
      var closesOk = h.close == null || h.close >= 1050;
      if (h.open <= 450 && closesOk) score = h.close == null ? 80 : 100;
      else if (h.open <= 480 && (h.close == null || h.close >= 1020)) score = 74;
      else score = 42;
      extra = "You need a duty-day span. Listing: " + (h.evidence || clockLabel(h.open)) + ".";
    } else if (need === "half") {
      score = 74;
      extra = "A half day would work for you. This listing shows a longer day" + (h.evidence ? " (" + h.evidence + ")" : "") + ", which can still fit.";
    }
    return known("hours", "Hours", weight, score, extra);
  }

  function scoreMilitary(signals, profile, weight) {
    if (!weight) return na("militaryAid", "Military fees");
    var bits = [];
    if (signals.mccyn) bits.push({ score: 100, text: "Listing notes MCCYN (" + signals.mccynEvidence + ")." });
    if (signals.discount) {
      bits.push({
        score: profile.mccyn && !signals.mccyn ? 70 : 84,
        text: "Listing notes military pricing (" + signals.discountEvidence + "). A discount or rank-based fee is not the same thing as MCCYN."
      });
    }
    if (signals.onPost) bits.push({ score: profile.mccyn && !signals.mccyn ? 86 : 90, text: "Listing marks the program on-post." });
    if (signals.subsidy) {
      var subScore = profile.subsidy ? 100 : (profile.mccyn ? 64 : 78);
      bits.push({ score: subScore, text: "Listing shows a free or subsidized option (" + signals.subsidyEvidence + ")." });
    }
    if (!bits.length) {
      return unknown("militaryAid", "Military fees", weight, "No MCCYN, military discount, or subsidy is written in this listing. That is missing data, not a no.");
    }
    var best = bits.reduce(function (a, b) { return a.score >= b.score ? a : b; });
    return known("militaryAid", "Military fees", weight, best.score, bits.map(function (b) { return b.text; }).join(" "));
  }

  function scorePcs(signals, profile, weight) {
    if (!weight) return na("pcs", "PCS enrollment");
    if (!signals.midYear && !signals.lottery) {
      return unknown("pcs", "PCS enrollment", weight, "Mid-year or lottery enrollment is not in this listing.");
    }
    var timing = profile.timing;
    if (signals.midYear) {
      var score = timing === "now" ? 100 : timing === "summer" ? 92 : timing === "planning" ? 84 : 88;
      return known("pcs", "PCS enrollment", weight, score, "Listing suggests off-cycle enrollment (" + signals.midYearEvidence + ").");
    }
    var lotteryScore = timing === "now" ? 28 : timing === "summer" ? 55 : timing === "planning" ? 84 : 58;
    return known("pcs", "PCS enrollment", weight, lotteryScore, "Listing mentions a lottery (" + signals.lotteryEvidence + "), not rolling enrollment.");
  }

  function scoreWaitlist(signals, profile, weight) {
    if (!weight) return na("waitlist", "Waitlist");
    if (!signals.waitMonths && !signals.waitEvidence) {
      return unknown("waitlist", "Waitlist", weight, "Waitlist length is not in this listing.");
    }
    var timing = profile.timing;
    if (signals.waitMonths) {
      var mid = (signals.waitMonths[0] + signals.waitMonths[1]) / 2;
      var score = timing === "now"
        ? (mid >= 12 ? 22 : mid >= 6 ? 45 : 72)
        : timing === "summer"
          ? (mid >= 12 ? 38 : mid >= 6 ? 60 : 82)
          : timing === "planning"
            ? (mid >= 12 ? 58 : 80)
            : (mid >= 12 ? 40 : 66);
      return known("waitlist", "Waitlist", weight, score, "Listing says " + signals.waitMonths[0] + "–" + signals.waitMonths[1] + " month wait" + (signals.waitEvidence ? " (" + signals.waitEvidence + ")" : "") + ".");
    }
    return known("waitlist", "Waitlist", weight, 48, "A waitlist is mentioned (" + signals.waitEvidence + ") but the length is not in the listing.");
  }

  function scoreEfmp(signals, profile, weight) {
    if (!weight) return na("efmp", "EFMP / special needs");
    if (!signals.efmp) {
      return unknown("efmp", "EFMP / special needs", weight, "Nothing in this listing describes EFMP, inclusion, or special education.");
    }
    return known("efmp", "EFMP / special needs", weight, 100, "Listing mentions support (" + signals.efmpEvidence + "). Confirm it matches your EFMP paperwork.");
  }

  function scoreDirectory(signals, weight) {
    if (!weight) return na("directory", "Directory note");
    if (signals.directory == null) return unknown("directory", "Directory note", weight, "No numeric directory note on this listing.");
    return known("directory", "Directory note", weight, signals.directory, "NearBase directory note is " + signals.directory + ". That number is an editorial listing score, separate from your family match.");
  }

  function blend(factors) {
    var rawNum = 0;
    var rawDen = 0;
    var applicable = 0;
    factors.forEach(function (f) {
      if (f.status === "na" || !f.weight) return;
      applicable += f.weight;
      if (f.status === "known") {
        rawNum += f.score * f.weight;
        rawDen += f.weight;
      }
    });
    if (!applicable || !rawDen) return { score: null, confidence: 0, raw: null };
    var raw = rawNum / rawDen;
    var confidence = rawDen / applicable;
    var score = Math.round(raw * confidence + 50 * (1 - confidence));
    score = Math.max(0, Math.min(100, score));
    return { score: score, confidence: confidence, raw: raw };
  }

  function scoreSchool(school, profile) {
    var p = normalizeProfile(profile);
    var base = baseById(p.baseId);
    var signals = readSignals(school);
    var w = weightsFor(p);
    var dist = scoreDistance(school, signals, base, w.distance);
    var factors = [
      dist.factor,
      scoreAge(signals, p, w.age),
      scorePhilosophy(signals, p, w.philosophy),
      scoreHours(signals, p, w.hours),
      scoreMilitary(signals, p, w.militaryAid),
      scorePcs(signals, p, w.pcs),
      scoreWaitlist(signals, p, w.waitlist),
      scoreEfmp(signals, p, w.efmp),
      scoreDirectory(signals, w.directory)
    ];
    var blended = blend(factors);
    var knownFactors = factors.filter(function (f) { return f.status === "known"; });
    var reasons = knownFactors.filter(function (f) { return f.score >= 70; })
      .sort(function (a, b) { return (b.weight * b.score) - (a.weight * a.score); });
    var problems = knownFactors.filter(function (f) { return f.score < 50; })
      .sort(function (a, b) { return a.score - b.score; });
    var gaps = factors.filter(function (f) { return f.status === "unknown" && f.weight; });
    var headline = (reasons[0] || knownFactors[0] || gaps[0] || {}).detail || "Not enough listing data to explain this score.";
    return {
      score: blended.score,
      confidence: blended.confidence,
      raw: blended.raw,
      factors: factors,
      reasons: reasons,
      problems: problems,
      gaps: gaps,
      headline: headline,
      distanceMiles: dist.miles,
      base: base,
      signals: signals,
      weights: w,
      profile: p
    };
  }

  function rankSchools(schools, profile) {
    return asArray(schools).map(function (school) {
      return { school: school, match: scoreSchool(school, profile) };
    }).sort(function (a, b) {
      var ds = (b.match.score || 0) - (a.match.score || 0);
      if (ds) return ds;
      var dc = (b.match.confidence || 0) - (a.match.confidence || 0);
      if (dc) return dc;
      var da = a.match.distanceMiles == null ? 9999 : a.match.distanceMiles;
      var db = b.match.distanceMiles == null ? 9999 : b.match.distanceMiles;
      if (da !== db) return da - db;
      return String(a.school.name || "").localeCompare(String(b.school.name || ""));
    });
  }

  function loadProfile() {
    try {
      if (typeof localStorage === "undefined") return defaultProfile();
      var raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return defaultProfile();
      return normalizeProfile(JSON.parse(raw));
    } catch (e) {
      return defaultProfile();
    }
  }

  function saveProfile(profile) {
    var p = normalizeProfile(profile);
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    } catch (e) { /* private mode */ }
    return p;
  }

  function loadQuiz(who) {
    try {
      if (typeof localStorage === "undefined") return null;
      var raw = localStorage.getItem(QUIZ_KEY);
      if (!raw) return null;
      var all = JSON.parse(raw);
      if (who) return all[who] || null;
      return all;
    } catch (e) {
      return null;
    }
  }

  function saveQuiz(who, votes) {
    try {
      if (typeof localStorage === "undefined") return;
      var all = loadQuiz() || {};
      all[who] = { votes: votes || {}, at: new Date().toISOString() };
      localStorage.setItem(QUIZ_KEY, JSON.stringify(all));
    } catch (e) { /* ignore */ }
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  return {
    PROFILE_KEY: PROFILE_KEY,
    BASES: BASES,
    AGE_IDS: AGE_IDS,
    PHILOSOPHY_IDS: PHILOSOPHY_IDS,
    AGE_LABEL: AGE_LABEL,
    PHILOSOPHY_LABEL: PHILOSOPHY_LABEL,
    defaultProfile: defaultProfile,
    normalizeProfile: normalizeProfile,
    timingFromMonth: timingFromMonth,
    philosophiesFromVotes: philosophiesFromVotes,
    mergeVotes: mergeVotes,
    voteDisagreements: voteDisagreements,
    withQuiz: withQuiz,
    haversineMiles: haversineMiles,
    readSignals: readSignals,
    weightsFor: weightsFor,
    scoreSchool: scoreSchool,
    rankSchools: rankSchools,
    loadProfile: loadProfile,
    saveProfile: saveProfile,
    loadQuiz: loadQuiz,
    saveQuiz: saveQuiz,
    esc: esc
  };
});
