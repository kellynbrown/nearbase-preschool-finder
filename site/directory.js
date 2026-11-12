// National Capital Region directory.
// Reads public.schools at runtime with the anon key account.js already
// loads from window.NB_CONFIG or the public-config function. The anon key
// is enough: schools allows public SELECT. Never send a service role key
// to the browser, and never write from this file.
//
// pilot_base is the closest planning point stored on a row. It is not a
// catchment. Choosing a base sorts every loaded row by straight-line miles
// to that base. Legacy Pentagon and Belvoir distance columns still fill in
// when the newer installation_distances_miles object is absent.
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NearBaseDirectory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  // Twelve approximate planning anchors recorded with the distance method
  // in eligibility evidence (ncr_planning_anchors_v1). These are straight-line
  // reference points, not gates and not commute times. Fort Belvoir's legacy
  // map coordinate stays in NearBaseMatch.BASES and is preferred for the
  // haversine fallback when a stored mile value is missing.
  var INSTALLATIONS = [
    { id: "pentagon", baseId: "pentagon", aliases: ["pentagon"], name: "Pentagon", nearPhrase: "the Pentagon", distancePlace: "the Pentagon", badge: "Pentagon pilot", label: "Pentagon", lat: 38.872, lng: -77.056, legacy: "pentagon" },
    { id: "fort-belvoir", baseId: "belvoir", aliases: ["belvoir", "fort-belvoir", "ft-belvoir"], name: "Fort Belvoir", nearPhrase: "Fort Belvoir", distancePlace: "Belvoir", badge: "Fort Belvoir", label: "Fort Belvoir", lat: 38.719737, lng: -77.154582, legacy: "belvoir" },
    { id: "fort-myer", baseId: "fort-myer", aliases: ["fort-myer", "myer", "ft-myer"], name: "Fort Myer", nearPhrase: "Fort Myer", distancePlace: "Fort Myer", badge: "Fort Myer", label: "Fort Myer", lat: 38.8804, lng: -77.0794 },
    { id: "jb-anacostia-bolling", baseId: "jbab", aliases: ["jbab", "jb-anacostia-bolling", "anacostia-bolling"], name: "Joint Base Anacostia-Bolling", nearPhrase: "Joint Base Anacostia-Bolling", distancePlace: "JBAB", badge: "JBAB", label: "Joint Base Anacostia-Bolling", lat: 38.8425, lng: -77.0154 },
    { id: "nsa-bethesda", baseId: "nsa-bethesda", aliases: ["nsa-bethesda", "bethesda"], name: "NSA Bethesda", nearPhrase: "NSA Bethesda", distancePlace: "Bethesda", badge: "NSA Bethesda", label: "NSA Bethesda", lat: 39.0016, lng: -77.093 },
    { id: "quantico", baseId: "quantico", aliases: ["quantico"], name: "MCB Quantico", nearPhrase: "Quantico", distancePlace: "Quantico", badge: "Quantico", label: "MCB Quantico", lat: 38.522, lng: -77.306 },
    { id: "fort-detrick", baseId: "fort-detrick", aliases: ["fort-detrick", "detrick"], name: "Fort Detrick", nearPhrase: "Fort Detrick", distancePlace: "Detrick", badge: "Fort Detrick", label: "Fort Detrick", lat: 39.438, lng: -77.426 },
    { id: "washington-navy-yard", baseId: "navyyard", aliases: ["navyyard", "washington-navy-yard", "navy-yard"], name: "Washington Navy Yard", nearPhrase: "the Washington Navy Yard", distancePlace: "Navy Yard", badge: "Navy Yard", label: "Washington Navy Yard", lat: 38.8737, lng: -76.995 },
    { id: "jb-andrews", baseId: "andrews", aliases: ["andrews", "jb-andrews"], name: "Joint Base Andrews", nearPhrase: "Joint Base Andrews", distancePlace: "Andrews", badge: "Andrews", label: "Joint Base Andrews", lat: 38.8108, lng: -76.867 },
    { id: "fort-meade", baseId: "meade", aliases: ["meade", "fort-meade"], name: "Fort Meade", nearPhrase: "Fort Meade", distancePlace: "Meade", badge: "Fort Meade", label: "Fort Meade", lat: 39.108, lng: -76.746 },
    { id: "fort-mcnair", baseId: "fort-mcnair", aliases: ["fort-mcnair", "mcnair"], name: "Fort McNair", nearPhrase: "Fort McNair", distancePlace: "McNair", badge: "Fort McNair reference", label: "Fort McNair (straight-line reference)", referenceOnly: true, lat: 38.8652, lng: -77.0151 },
    { id: "coast-guard-hq", baseId: "coast-guard-hq", aliases: ["coast-guard-hq", "coast-guard"], name: "Coast Guard HQ", nearPhrase: "Coast Guard Headquarters", distancePlace: "Coast Guard HQ", badge: "Coast Guard HQ reference", label: "Coast Guard HQ (straight-line reference)", referenceOnly: true, lat: 38.8554, lng: -76.9973 }
  ];

  var JURISDICTIONS = [
    { id: "VA", label: "Virginia" },
    { id: "DC", label: "DC" },
    { id: "MD", label: "Maryland" }
  ];

  var MD_JURISDICTION = /montgomery|prince george|howard|anne arundel|frederick|charles|calvert/;
  var VA_JURISDICTION = /fairfax|loudoun|prince william|alexandria|arlington|stafford|spotsylvania|manassas|fauquier|falls church|fredericksburg/;

  var PATH_NOTES = {
    VA_VQB5_MCCYN_PLUS: "Virginia VQB5 participation is the documented pathway. VQB5 does not itself establish school-age eligibility.",
    DOD_RECOGNIZED_AMI_USA_ACCREDITATION: "AMI/USA recognition is the documented pathway. Recognized ages count. Affiliated or member-only ages do not.",
    DOD_RECOGNIZED_AMS_ACCREDITATION: "AMS accreditation is the documented pathway. Membership or an affiliated-only listing is not accreditation.",
    DOD_RECOGNIZED_NAEYC_ACCREDITATION: "NAEYC accreditation is the documented pathway.",
    DOD_RECOGNIZED_NAC_ACCREDITATION: "NAC accreditation is the documented pathway.",
    DOD_RECOGNIZED_NECPA_ACCREDITATION: "NECPA accreditation is the documented pathway.",
    CCA_MCCYN_LIST_ACCREDITED_PLUS: "Presence on the official Child Care Aware MCCYN list as Accredited / MCCYN Plus is documented. That is not family approval or guaranteed fee assistance.",
    CCA_MCCYN_LIST_PARTICIPATING: "Presence on the official Child Care Aware MCCYN list as Participating is documented. That is not family approval or guaranteed fee assistance."
  };

  var SOURCE_LABELS = {
    policy_url: "Pathway policy",
    license_source_url: "License source",
    accreditation_source_url: "Accreditation source",
    participation_url: "VQB5 participation list",
    rating_source_url: "VQB5 rating source",
    website_source_url: "Website source",
    website_identity_source_url: "Website identity check",
    license_and_accreditation_source_url: "License and accreditation profile",
    licensed_roster_source_url: "Licensed roster",
    geocode_source_url: "Geocode source"
  };

  var DEFAULT_PILOT_ID = "pentagon";
  // PostgREST page size. The read keeps requesting pages until a short page
  // comes back, so this is not a cap on how many schools the directory holds.
  var PAGE_SIZE = 1000;
  var CORE_COLUMNS = [
    "id", "name", "address", "city", "state", "zip", "phone",
    "lat", "lng",
    "license_type", "license_status", "capacity", "ages_served",
    "hours", "locality", "pilot_base"
  ];
  // cca_listed_website is a CCA URL that did not verify as this campus's site.
  // It is intentionally not selected and must never become a Visit website href.
  var LIST_OPTIONAL = [
    "website",
    "distance_miles_to_pentagon",
    "distance_miles_to_belvoir",
    "jurisdiction",
    "eligibility_path",
    "accreditation",
    "quality_rating",
    "nearest_installation",
    "installation_distances_miles",
    "website_verified_at",
    "verification_at",
    "source_license_id",
    "website_status",
    "cca_mccyn_tier"
  ];

  var CONFIG_MESSAGE = "The school directory isn’t connected. This site needs the existing Supabase URL and anon key (Netlify SUPABASE_URL and SUPABASE_ANON_KEY, or window.NB_CONFIG). The list stays empty until then, and the rest of the page still works.";
  var QUERY_MESSAGE = "The licensed-center list didn’t load. Check the connection and try again. The map and the rest of the page still work.";
  var HONEST_LINE = "Quality pathway documented is not MCCYN enrollment, approval, or guaranteed family funding.";

  function text(value) {
    return value == null ? "" : String(value).trim();
  }

  function num(value) {
    if (value == null || value === "") return null;
    var n = Number(value);
    return isFinite(n) ? n : null;
  }

  function plainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value;
  }

  function distanceMap(value) {
    if (typeof value === "string") {
      try { value = JSON.parse(value); } catch (error) { return {}; }
    }
    var source = plainObject(value);
    if (!source) return {};
    var out = {};
    Object.keys(source).forEach(function (key) {
      var miles = num(source[key]);
      var name = text(key).toLowerCase();
      if (name && miles != null && miles >= 0) out[name] = miles;
    });
    return out;
  }

  function pilotFor(baseId) {
    var key = text(baseId).toLowerCase();
    if (!key) return null;
    for (var i = 0; i < INSTALLATIONS.length; i++) {
      var item = INSTALLATIONS[i];
      if (item.baseId === key || item.id === key || item.aliases.indexOf(key) !== -1) return item;
    }
    return null;
  }

  function humanizeKey(key) {
    var words = text(key).toLowerCase().replace(/[_]+/g, " ").replace(/[-]+/g, " ");
    if (!words) return "";
    return words.replace(/\b[a-z]/g, function (ch) { return ch.toUpperCase(); })
      .replace(/\bJb\b/g, "JB")
      .replace(/\bNsa\b/g, "NSA")
      .replace(/\bMcb\b/g, "MCB")
      .replace(/\bHq\b/g, "HQ");
  }

  function discoveredInstallation(key) {
    var name = humanizeKey(key);
    return {
      id: key,
      baseId: key,
      aliases: [key],
      name: name,
      label: name + " (straight-line reference)",
      nearPhrase: name,
      distancePlace: name,
      badge: name + " reference",
      referenceOnly: true,
      discovered: true,
      lat: null,
      lng: null
    };
  }

  function representedInstallations(schools) {
    var seen = {};
    function mark(raw) {
      var key = text(raw).toLowerCase();
      if (!key) return;
      var known = pilotFor(key);
      if (known) seen[known.id] = known;
      else if (!seen[key]) seen[key] = discoveredInstallation(key);
    }
    (schools || []).forEach(function (school) {
      Object.keys(school.installationDistances || {}).forEach(mark);
      mark(school.nearestInstallation);
      mark(school.pilotBase);
      if (school.distanceMilesToPentagon != null) mark("pentagon");
      if (school.distanceMilesToBelvoir != null) mark("fort-belvoir");
    });
    var ordered = [];
    INSTALLATIONS.forEach(function (item) {
      if (seen[item.id]) ordered.push(item);
    });
    Object.keys(seen).forEach(function (id) {
      if (!pilotFor(id)) ordered.push(seen[id]);
    });
    return ordered;
  }

  function selectorBases(matchBases, schools) {
    var installations = schools && schools.length ? representedInstallations(schools) : INSTALLATIONS.slice();
    var options = installations.map(function (item) {
      return { value: item.baseId, label: item.label || item.name, group: "NCR installations" };
    });
    var used = {};
    installations.forEach(function (item) {
      used[item.baseId] = true;
      used[item.id] = true;
      (item.aliases || []).forEach(function (alias) { used[alias] = true; });
    });
    (matchBases || []).forEach(function (base) {
      if (!base || used[base.id] || pilotFor(base.id)) return;
      options.push({ value: base.id, label: base.name, group: "Neighborhoods" });
    });
    return options;
  }

  function normalizeJurisdiction(value) {
    var raw = text(value).toUpperCase().replace(/\./g, "");
    if (!raw || raw === "ALL") return "";
    if (raw === "VA" || raw === "VIRGINIA") return "VA";
    if (raw === "MD" || raw === "MARYLAND") return "MD";
    if (raw === "DC" || raw === "DISTRICT OF COLUMBIA") return "DC";
    return "";
  }

  function jurisdictionCode(school) {
    var state = text(school && school.state).toUpperCase();
    if (state === "VA" || state === "VIRGINIA") return "VA";
    if (state === "MD" || state === "MARYLAND") return "MD";
    if (state === "DC" || state === "DISTRICT OF COLUMBIA") return "DC";
    var jurisdiction = text(school && school.jurisdiction).toLowerCase();
    if (!jurisdiction) return "";
    if (jurisdiction === "dc" || jurisdiction.indexOf("district of columbia") !== -1) return "DC";
    if (MD_JURISDICTION.test(jurisdiction)) return "MD";
    if (VA_JURISDICTION.test(jurisdiction)) return "VA";
    return "";
  }

  function jurisdictionsIn(schools) {
    var present = {};
    (schools || []).forEach(function (school) {
      var code = jurisdictionCode(school);
      if (code) present[code] = true;
    });
    var known = JURISDICTIONS.filter(function (item) { return present[item.id]; });
    Object.keys(present).forEach(function (code) {
      if (!known.some(function (item) { return item.id === code; })) known.push({ id: code, label: code });
    });
    return known;
  }

  function normalizeSchool(row) {
    row = row || {};
    var id = text(row.id);
    if (!id) return null;
    var evidence = plainObject(row.eligibility_evidence);
    return {
      id: id,
      slug: id,
      name: text(row.name) || "Licensed center",
      address: text(row.address),
      city: text(row.city),
      state: text(row.state),
      zip: text(row.zip),
      phone: text(row.phone),
      lat: num(row.lat),
      lng: num(row.lng),
      distanceMilesToBelvoir: num(row.distance_miles_to_belvoir),
      distanceMilesToPentagon: num(row.distance_miles_to_pentagon),
      licenseType: text(row.license_type),
      licenseStatus: text(row.license_status),
      licenseId: text(row.source_license_id),
      capacity: num(row.capacity),
      agesServed: text(row.ages_served),
      hours: text(row.hours),
      locality: text(row.locality),
      pilotBase: text(row.pilot_base).toLowerCase(),
      website: websiteHref(row.website),
      websiteStatus: websiteStatus(row.website_status),
      ccaMccynTier: ccaTier(row.cca_mccyn_tier),
      jurisdiction: text(row.jurisdiction),
      jurisdictionCode: "",
      eligibilityPath: text(row.eligibility_path),
      accreditation: text(row.accreditation),
      qualityRating: text(row.quality_rating),
      nearestInstallation: text(row.nearest_installation).toLowerCase(),
      installationDistances: distanceMap(row.installation_distances_miles),
      eligibilityEvidence: evidence,
      websiteVerifiedAt: text(row.website_verified_at),
      verificationAt: text(row.verification_at),
      googlePlaceId: text(row.google_place_id),
      instagramUrl: text(row.instagram_url),
      facebookUrl: text(row.facebook_url),
      alsoIds: [],
      alsoLicenseIds: []
    };
  }

  function compact(value) {
    return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function campusKey(school) {
    var address = compact(school.address);
    var name = compact(school.name);
    var licenseId = compact(school.licenseId);
    if (name && address) return "na:" + name + "|" + address;
    if (licenseId && address) return "lic:" + licenseId + "|" + address;
    return "id:" + school.id;
  }

  function richness(school) {
    var score = 0;
    if (school.eligibilityPath) score += 8;
    if (school.eligibilityEvidence) score += 4;
    if (school.installationDistances && Object.keys(school.installationDistances).length) score += 4;
    if (school.website) score += 2;
    if (school.distanceMilesToPentagon != null) score += 1;
    if (school.distanceMilesToBelvoir != null) score += 1;
    if (school.lat != null && school.lng != null) score += 1;
    return score;
  }

  function preferCampus(a, b) {
    var diff = richness(b) - richness(a);
    if (diff !== 0) return diff > 0 ? b : a;
    var aCopy = /-pentagon-/.test(a.id) ? 1 : 0;
    var bCopy = /-pentagon-/.test(b.id) ? 1 : 0;
    if (aCopy !== bCopy) return aCopy > bCopy ? b : a;
    return String(a.id).localeCompare(String(b.id)) <= 0 ? a : b;
  }

  function cloneSchool(school) {
    var copy = {};
    Object.keys(school).forEach(function (key) { copy[key] = school[key]; });
    copy.installationDistances = {};
    Object.keys(school.installationDistances || {}).forEach(function (key) {
      copy.installationDistances[key] = school.installationDistances[key];
    });
    copy.alsoIds = (school.alsoIds || []).slice();
    copy.alsoLicenseIds = (school.alsoLicenseIds || []).slice();
    return copy;
  }

  function fillGaps(target, extra) {
    [
      "website", "phone", "address", "city", "state", "zip", "locality", "jurisdiction",
      "eligibilityPath", "accreditation", "qualityRating", "nearestInstallation", "pilotBase",
      "licenseId", "licenseType", "licenseStatus", "agesServed", "hours",
      "websiteVerifiedAt", "verificationAt", "googlePlaceId", "instagramUrl", "facebookUrl",
      "websiteStatus", "ccaMccynTier"
    ].forEach(function (field) {
      if ((target[field] == null || target[field] === "") && extra[field]) target[field] = extra[field];
    });
    if (target.lat == null) target.lat = extra.lat;
    if (target.lng == null) target.lng = extra.lng;
    if (target.capacity == null) target.capacity = extra.capacity;
    if (target.distanceMilesToPentagon == null) target.distanceMilesToPentagon = extra.distanceMilesToPentagon;
    if (target.distanceMilesToBelvoir == null) target.distanceMilesToBelvoir = extra.distanceMilesToBelvoir;
    if (!target.eligibilityEvidence && extra.eligibilityEvidence) target.eligibilityEvidence = extra.eligibilityEvidence;
    Object.keys(extra.installationDistances || {}).forEach(function (key) {
      if (target.installationDistances[key] == null) target.installationDistances[key] = extra.installationDistances[key];
    });
  }

  function dedupeCampuses(schools) {
    var buckets = {};
    var order = [];
    (schools || []).forEach(function (school) {
      if (!school || !school.id) return;
      var key = campusKey(school);
      if (!buckets[key]) {
        buckets[key] = [];
        order.push(key);
      }
      buckets[key].push(school);
    });
    var out = order.map(function (key) {
      var rows = buckets[key];
      var winner = rows[0];
      for (var i = 1; i < rows.length; i++) winner = preferCampus(winner, rows[i]);
      var merged = cloneSchool(winner);
      merged.alsoIds = [];
      merged.alsoLicenseIds = (winner.alsoLicenseIds || []).slice();
      rows.forEach(function (row) {
        if (row.id !== merged.id && merged.alsoIds.indexOf(row.id) === -1) merged.alsoIds.push(row.id);
        (row.alsoIds || []).forEach(function (id) {
          if (id !== merged.id && merged.alsoIds.indexOf(id) === -1) merged.alsoIds.push(id);
        });
        fillGaps(merged, row);
        if (row.licenseId && row.licenseId !== merged.licenseId && merged.alsoLicenseIds.indexOf(row.licenseId) === -1) {
          merged.alsoLicenseIds.push(row.licenseId);
        }
      });
      return merged;
    });
    var inputCount = (schools || []).filter(function (school) { return school && school.id; }).length;
    return { schools: out, combined: inputCount - out.length };
  }

  function findSchool(schools, id) {
    var wanted = text(id);
    if (!wanted) return null;
    var rows = schools || [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === wanted) return rows[i];
      if ((rows[i].alsoIds || []).indexOf(wanted) !== -1) return rows[i];
    }
    return null;
  }

  function addressLine(school) {
    var stateZip = [school.state, school.zip].filter(Boolean).join(" ");
    var cityLine = [school.city, stateZip].filter(Boolean).join(", ");
    return [school.address, cityLine].filter(Boolean).join(", ");
  }

  function placeLine(school) {
    var city = [school.city, school.state].filter(Boolean).join(", ");
    var locality = school.jurisdiction || school.locality || "";
    if (locality && locality.toLowerCase() !== (school.city || "").toLowerCase()) {
      return city ? locality + " · " + city : locality;
    }
    return city || locality;
  }

  function phoneHref(phone) {
    var compactPhone = String(phone || "").replace(/[^\d+]/g, "");
    return compactPhone.length >= 7 ? "tel:" + compactPhone : "";
  }

  function websiteStatus(value) {
    var status = text(value);
    if (status === "verified" || status === "coming_soon" || status === "unverified_listed") return status;
    return "";
  }

  function ccaTier(value) {
    var tier = text(value);
    if (tier === "accredited_plus" || tier === "participating") return tier;
    return "";
  }

  function mccynListBadge(tier) {
    if (tier === "accredited_plus") {
      return { label: "On Child Care Aware MCCYN list", tier: "Accredited / MCCYN Plus" };
    }
    if (tier === "participating") {
      return { label: "On Child Care Aware MCCYN list", tier: "Participating" };
    }
    return null;
  }

  function approximateLocation(school) {
    return !!(school && !text(school.address) && school.lat != null && school.lng != null);
  }

  var APPROXIMATE_NOTE = "Approximate location. No street address is stored, so this pin is not a door.";

  function websiteHref(value) {
    var raw = text(value);
    if (!raw || /[\s<>"'\\]/.test(raw) || /[\u0000-\u001f]/.test(raw)) return "";
    var url;
    try { url = new URL(raw); } catch (error) { return ""; }
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.username || url.password) return "";
    return url.href;
  }

  function escHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function eligibilityBadge(school) {
    var code = text(school && school.eligibilityPath);
    if (!code) {
      return {
        code: "",
        label: "Verification evidence pending",
        detail: "No sourced eligibility pathway is stored for this record. That is not a denial, and it is not MCCYN approval.",
        tone: "pending"
      };
    }
    var note = PATH_NOTES[code] || "This exact pathway code is stored. A narrower age-scope sentence is not attached to it yet. Read the source links.";
    return {
      code: code,
      label: "Quality pathway documented",
      detail: note + " This is not MCCYN enrollment, approval, or guaranteed family funding.",
      tone: "documented"
    };
  }

  function legacyMiles(school, installation) {
    if (!school || !installation) return null;
    if (installation.legacy === "pentagon") return school.distanceMilesToPentagon;
    if (installation.legacy === "belvoir") return school.distanceMilesToBelvoir;
    return null;
  }

  function baseCoords(base) {
    var bases = root.NearBaseMatch && root.NearBaseMatch.BASES;
    if (bases && base) {
      var ids = [base.baseId, base.id];
      for (var i = 0; i < bases.length; i++) {
        if (ids.indexOf(bases[i].id) !== -1 && bases[i].lat != null && bases[i].lng != null) {
          return { lat: Number(bases[i].lat), lng: Number(bases[i].lng) };
        }
      }
    }
    if (base && base.lat != null && base.lng != null) return { lat: Number(base.lat), lng: Number(base.lng) };
    return null;
  }

  function fromTag(installation, via) {
    if (via === "haversine") return "base";
    if (!installation || installation.legacy === "belvoir" || installation.id === "fort-belvoir") return "belvoir";
    if (installation.legacy === "pentagon" || installation.id === "pentagon") return "pentagon";
    return installation.id;
  }

  function mileLabel(miles, place) {
    return miles.toFixed(1) + " straight-line mi from " + place;
  }

  function distanceFor(school, homePoint, haversine, base) {
    if (homePoint && school.lat != null && school.lng != null &&
        homePoint.lat != null && homePoint.lng != null && typeof haversine === "function") {
      var homeMiles = haversine(Number(homePoint.lat), Number(homePoint.lng), school.lat, school.lng);
      if (homeMiles != null && isFinite(homeMiles)) {
        return { miles: homeMiles, label: mileLabel(homeMiles, "home"), from: "home" };
      }
    }
    var installation = base && base.id ? base : pilotFor(base && (base.baseId || base.id));
    if (!installation) {
      if (school.distanceMilesToBelvoir != null) {
        return { miles: school.distanceMilesToBelvoir, label: mileLabel(school.distanceMilesToBelvoir, "Belvoir"), from: "belvoir" };
      }
      return { miles: null, label: "", from: "none" };
    }
    var mapped = school.installationDistances && school.installationDistances[installation.id];
    if (mapped != null) {
      return { miles: mapped, label: mileLabel(mapped, installation.distancePlace), from: fromTag(installation) };
    }
    var stored = legacyMiles(school, installation);
    if (stored != null) {
      return { miles: stored, label: mileLabel(stored, installation.distancePlace), from: fromTag(installation) };
    }
    var point = baseCoords(installation);
    if (point && school.lat != null && school.lng != null && typeof haversine === "function") {
      var miles = haversine(point.lat, point.lng, school.lat, school.lng);
      if (miles != null && isFinite(miles)) {
        return { miles: miles, label: mileLabel(miles, installation.distancePlace || installation.name || "base"), from: "base" };
      }
    }
    return { miles: null, label: "", from: "none" };
  }

  function sortSchools(schools, homePoint, haversine, base) {
    return (schools || []).slice().sort(function (a, b) {
      var da = distanceFor(a, homePoint, haversine, base).miles;
      var db = distanceFor(b, homePoint, haversine, base).miles;
      if (da == null && db == null) return a.name.localeCompare(b.name);
      if (da == null) return 1;
      if (db == null) return -1;
      if (da !== db) return da - db;
      return a.name.localeCompare(b.name);
    });
  }

  function matchesQuery(school, query) {
    var q = text(query).toLowerCase();
    if (!q) return true;
    var blob = [
      school.name, school.city, school.locality, school.jurisdiction, school.address, school.zip,
      school.state, school.hours, school.agesServed, school.licenseType, school.licenseStatus,
      school.phone, school.eligibilityPath, school.accreditation, school.qualityRating,
      school.nearestInstallation, school.pilotBase, (school.alsoIds || []).join(" ")
    ].join(" ").toLowerCase();
    return blob.indexOf(q) !== -1;
  }

  function summarize(schools) {
    var byJurisdiction = { VA: 0, DC: 0, MD: 0, other: 0 };
    var documented = 0;
    var pending = 0;
    (schools || []).forEach(function (school) {
      var code = jurisdictionCode(school);
      if (byJurisdiction[code] != null) byJurisdiction[code] += 1;
      else byJurisdiction.other += 1;
      if (school.eligibilityPath) documented += 1;
      else pending += 1;
    });
    return {
      rowCount: (schools || []).length,
      byJurisdiction: byJurisdiction,
      documented: documented,
      pending: pending
    };
  }

  function sortBase(baseId) {
    var known = pilotFor(baseId);
    if (known) return known;
    var bases = root.NearBaseMatch && root.NearBaseMatch.BASES;
    var key = text(baseId);
    if (bases) {
      for (var i = 0; i < bases.length; i++) {
        if (bases[i].id === key) {
          return {
            id: bases[i].id,
            baseId: bases[i].id,
            aliases: [bases[i].id],
            name: bases[i].name,
            label: bases[i].name,
            nearPhrase: bases[i].name,
            distancePlace: bases[i].name,
            badge: bases[i].name,
            lat: bases[i].lat,
            lng: bases[i].lng,
            referenceOnly: true
          };
        }
      }
    }
    return pilotFor(DEFAULT_PILOT_ID);
  }

  function familyPartition(schools, options) {
    options = options || {};
    var Match = root.NearBaseMatch;
    var ages = options.ages || [];
    var hours = options.hours || "any";
    var childMonths = options.childMonths;
    var radius = options.radiusMiles === "" || options.radiusMiles == null ? null : Number(options.radiusMiles);
    var fit = [];
    var unconfirmed = [];
    var excluded = 0;
    (schools || []).forEach(function (school) {
      var miles = typeof options.milesOf === "function" ? options.milesOf(school) : null;
      if (radius != null && isFinite(radius)) {
        if (miles == null || miles > radius) {
          excluded += 1;
          return;
        }
      }
      var ageStatus = Match && Match.ageFilterStatus ? Match.ageFilterStatus(school, ages, childMonths) : "na";
      var hourStatus = Match && Match.hoursFilterStatus ? Match.hoursFilterStatus(school, hours) : "na";
      if (ageStatus === "miss" || hourStatus === "miss") {
        excluded += 1;
        return;
      }
      if (ageStatus === "unknown" || hourStatus === "unknown") unconfirmed.push(school);
      else fit.push(school);
    });
    return { fit: fit, unconfirmed: unconfirmed, excluded: excluded };
  }

  function filterDirectory(schools, options) {
    options = options || {};
    var base = sortBase(options.baseId) || pilotFor(DEFAULT_PILOT_ID);
    var summary = summarize(schools);
    var deduped = dedupeCampuses(schools);
    var jurisdiction = normalizeJurisdiction(options.jurisdiction);
    var filtered = deduped.schools.filter(function (school) {
      if (jurisdiction && jurisdictionCode(school) !== jurisdiction) return false;
      return matchesQuery(school, options.query);
    });
    return {
      schools: sortSchools(filtered, options.homePoint, options.haversine, base),
      base: base,
      jurisdiction: jurisdiction,
      coverage: {
        rowCount: summary.rowCount,
        campusCount: deduped.schools.length,
        combined: deduped.combined,
        documented: summary.documented,
        pending: summary.pending,
        byJurisdiction: summary.byJurisdiction,
        shown: filtered.length
      }
    };
  }

  function coverageText(coverage, base, jurisdiction) {
    var place = base && (base.nearPhrase || base.name) ? (base.nearPhrase || base.name) : "the selected base";
    var parts = [
      "Sorted by straight-line miles to " + place + ".",
      "Choosing a base reorders these records. It does not mean a school is eligible only for that base, and it is not a drive time."
    ];
    if (coverage) {
      parts.push(coverage.shown + " shown from " + coverage.campusCount + " campuses and " + coverage.rowCount + " directory rows.");
      if (coverage.combined) {
        parts.push(coverage.combined + " extra rows matched the same name and address, or the same license and address, and are combined in this list only.");
      }
      parts.push("Sourced pathway: " + coverage.documented + ". Verification evidence pending: " + coverage.pending + ".");
      var bits = [];
      JURISDICTIONS.forEach(function (item) {
        var count = coverage.byJurisdiction && coverage.byJurisdiction[item.id];
        if (count) bits.push(item.label + " " + count);
      });
      if (coverage.byJurisdiction && coverage.byJurisdiction.other) bits.push("Other " + coverage.byJurisdiction.other);
      if (bits.length) parts.push("Directory rows before campus combining: " + bits.join(", ") + ".");
    }
    if (jurisdiction === "MD") parts.push("Maryland rows are the verified extracts on file, not a complete county census.");
    if (jurisdiction === "DC") parts.push("DC rows are the verified extracts on file, not every licensed program.");
    if (jurisdiction === "VA") parts.push("Virginia includes older pilot rows whose pathway evidence is still pending.");
    parts.push(HONEST_LINE);
    parts.push("This is not a complete census of NCR providers.");
    return parts.join(" ");
  }

  function presentSchool(school, homePoint, haversine, base) {
    var installation = base && base.id ? base : pilotFor(base && (base.baseId || base.id));
    var dist = distanceFor(school, homePoint, haversine, installation);
    var badge = eligibilityBadge(school);
    var facts = [];
    if (school.phone) facts.push({ text: school.phone, href: phoneHref(school.phone) });
    if (school.capacity != null) facts.push({ text: "Capacity " + school.capacity });
    if (school.agesServed) facts.push({ text: "Ages " + school.agesServed });
    if (school.hours) facts.push({ text: school.hours });
    var license = [school.licenseType, school.licenseStatus].filter(Boolean).join(" · ");
    if (license) facts.push({ text: license });
    return {
      id: school.id,
      slug: school.slug,
      name: school.name,
      place: placeLine(school),
      addressLine: addressLine(school),
      jurisdictionCode: jurisdictionCode(school),
      miles: dist.miles,
      distanceLabel: dist.label,
      milesShort: dist.miles == null ? "—" : dist.miles.toFixed(1),
      websiteHref: websiteHref(school.website),
      websiteStatus: websiteStatus(school.websiteStatus),
      comingSoon: !websiteHref(school.website),
      ccaBadge: mccynListBadge(ccaTier(school.ccaMccynTier)),
      approximate: approximateLocation(school),
      approximateNote: approximateLocation(school) ? APPROXIMATE_NOTE : "",
      badge: badge,
      facts: facts
    };
  }

  function evidenceLines(school) {
    var evidence = school && school.eligibilityEvidence;
    var lines = [];
    var badge = eligibilityBadge(school || {});
    lines.push(badge.detail);
    if (!evidence) {
      lines.push("Verification evidence pending. No source bundle is stored for this record.");
    } else {
      [
        ["eligible_age_scope", ""],
        ["age_scope_warning", ""],
        ["accreditation_evidence", "Accreditation evidence: "],
        ["provider_reported_ages", "Ages recorded: "],
        ["maryland_plus_rule", ""],
        ["rating_year", "Rating year: "],
        ["participation_as_of", "Participation list as of: "],
        ["license_report_as_of", "License report as of: "],
        ["roster_report_date", "Roster report date: "],
        ["license_expires", "License expiration on record: "],
        ["accreditation_expires", "Accreditation expiration on record: "],
        ["latest_published_inspection_date", "Latest published inspection date: "],
        ["checked_at", "Evidence checked: "]
      ].forEach(function (pair) {
        var value = text(evidence[pair[0]]);
        if (value) lines.push(pair[1] + value);
      });
      if (text(evidence.provider_acceptance) && text(evidence.provider_acceptance) !== "confirmed") {
        lines.push("Provider acceptance of military fee assistance is not confirmed.");
      }
      if (text(evidence.annual_inspection_and_background_checks)) {
        lines.push("Annual inspection and background checks: " + text(evidence.annual_inspection_and_background_checks).replace(/_/g, " ") + ".");
      }
    }
    if (school && school.accreditation) lines.push("Accreditation on record: " + school.accreditation + ".");
    if (school && school.qualityRating) lines.push("Quality rating on record: " + school.qualityRating + ".");
    else lines.push("No numeric quality rating is recorded. None was inferred.");
    if (school && school.agesServed) lines.push("Ages on the directory record: " + school.agesServed + ".");
    if (school && school.websiteVerifiedAt) lines.push("Website verified at: " + school.websiteVerifiedAt + ".");
    if (school && school.verificationAt) lines.push("Record verified at: " + school.verificationAt + ".");
    lines.push("Distances are straight-line miles to approximate planning points, not drive time or a gate.");
    return lines;
  }

  function collectLinks(value, key, out, seen) {
    if (out.length >= 30) return;
    if (typeof value === "string") {
      var href = websiteHref(value);
      if (!href || seen[href]) return;
      seen[href] = true;
      out.push({ href: href, label: SOURCE_LABELS[key] || "Source" });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(function (item) { collectLinks(item, key, out, seen); });
      return;
    }
    var obj = plainObject(value);
    if (!obj) return;
    Object.keys(obj).forEach(function (child) { collectLinks(obj[child], child, out, seen); });
  }

  function evidenceHtml(school) {
    school = school || {};
    var badge = eligibilityBadge(school);
    var lines = evidenceLines(school).map(function (line) {
      return "<li>" + escHtml(line) + "</li>";
    }).join("");
    var links = [];
    if (school.eligibilityEvidence) collectLinks(school.eligibilityEvidence, "", links, {});
    var linkHtml = links.length
      ? "<ul class=\"nb-sources\">" + links.map(function (link) {
        return "<li><a href=\"" + escHtml(link.href) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + escHtml(link.label) + "</a></li>";
      }).join("") + "</ul>"
      : "<p>No official source links are stored for this record.</p>";
    var licenseNote = "";
    if (school.alsoLicenseIds && school.alsoLicenseIds.length) {
      licenseNote = "<p>" + escHtml("Another directory row for this name and address lists a different license id (" + school.alsoLicenseIds.join(", ") + "). Confirm the current license in the official record.") + "</p>";
    }
    var code = badge.code ? "<p>Exact eligibility path: <code>" + escHtml(badge.code) + "</code></p>" : "";
    return "<div class=\"nb-evidence\">" +
      "<p class=\"nb-honest\">" + escHtml(badge.label) + ". " + escHtml(HONEST_LINE) + "</p>" +
      code +
      "<ul>" + lines + "</ul>" +
      "<h3>Official source links</h3>" +
      linkHtml +
      licenseNote +
      "</div>";
  }

  function errorMessage(error) {
    var message = error && error.message ? String(error.message).trim() : "";
    return message ? message.slice(0, 180) : "The directory query failed.";
  }

  function columnMentioned(blob, column) {
    var escaped = String(column).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("(^|[^a-z0-9_])" + escaped + "([^a-z0-9_]|$)", "i").test(blob);
  }

  function columnMissing(error, column) {
    if (!error || !column) return false;
    var blob = [error.message, error.details, error.hint, error.code].map(function (part) {
      return part == null ? "" : String(part);
    }).join(" ");
    if (!columnMentioned(blob, column)) return false;
    return /does not exist|schema cache|42703|PGRST204/i.test(blob);
  }

  function missingColumnName(error, columns) {
    var list = columns || [];
    for (var i = 0; i < list.length; i++) {
      if (columnMissing(error, list[i])) return list[i];
    }
    return "";
  }

  function readPages(sb, columns, filters) {
    var acc = [];
    var selectList = columns.join(",");
    function page(from) {
      var query = sb.from("schools").select(selectList);
      (filters || []).forEach(function (pair) { query = query.eq(pair[0], pair[1]); });
      return query.order("id", { ascending: true }).range(from, from + PAGE_SIZE - 1).then(function (result) {
        if (!result || result.error) {
          return {
            ok: false,
            schools: [],
            message: errorMessage(result && result.error),
            missingColumn: missingColumnName(result && result.error, columns)
          };
        }
        var rows = result.data || [];
        rows.forEach(function (row) {
          var school = normalizeSchool(row);
          if (school) {
            school.jurisdictionCode = jurisdictionCode(school);
            acc.push(school);
          }
        });
        if (rows.length === PAGE_SIZE) return page(from + PAGE_SIZE);
        return { ok: true, schools: acc, message: "", missingColumn: "" };
      });
    }
    return Promise.resolve().then(function () { return page(0); }).catch(function (error) {
      return {
        ok: false,
        schools: [],
        message: errorMessage(error),
        missingColumn: missingColumnName(error, columns)
      };
    });
  }

  function fetchWithOptional(sb, extraOptional, filters) {
    var optional = LIST_OPTIONAL.concat(extraOptional || []);
    var tries = 0;
    function attempt() {
      tries += 1;
      if (tries > optional.length + 2) {
        return Promise.resolve({ ok: false, schools: [], message: "The directory query failed.", missingColumn: "" });
      }
    return readPages(sb, CORE_COLUMNS.concat(optional), filters).then(function (result) {
      if (result && result.missingColumn && optional.indexOf(result.missingColumn) !== -1) {
          optional = optional.filter(function (column) { return column !== result.missingColumn; });
          return attempt();
        }
        return result;
      });
    }
    return attempt();
  }

  function fetchDirectorySchools(sb) {
    return fetchWithOptional(sb, [], []);
  }

  function fetchPilotSchools(sb) {
    return fetchDirectorySchools(sb);
  }

  function fetchSchoolProfile(sb, id) {
    var wanted = text(id);
    if (!wanted) return Promise.resolve({ ok: false, school: null, message: "Missing school id." });
    return fetchWithOptional(sb, ["eligibility_evidence", "google_place_id", "instagram_url", "facebook_url"], [["id", wanted]]).then(function (result) {
      if (!result || !result.ok) return { ok: false, school: null, message: result && result.message ? result.message : QUERY_MESSAGE };
      return { ok: true, school: result.schools[0] || null, message: result.schools[0] ? "" : "That school is not in the directory." };
    });
  }

  var primary = pilotFor(DEFAULT_PILOT_ID);

  return {
    INSTALLATIONS: INSTALLATIONS,
    JURISDICTIONS: JURISDICTIONS,
    PILOTS: { pentagon: pilotFor("pentagon"), belvoir: pilotFor("belvoir") },
    DEFAULT_PILOT_ID: DEFAULT_PILOT_ID,
    PILOT_BASE: primary.id,
    PILOT_BASE_ID: primary.baseId,
    PAGE_SIZE: PAGE_SIZE,
    CONFIG_MESSAGE: CONFIG_MESSAGE,
    QUERY_MESSAGE: QUERY_MESSAGE,
    HONEST_LINE: HONEST_LINE,
    pilotFor: pilotFor,
    sortBase: sortBase,
    familyPartition: familyPartition,
    selectorBases: selectorBases,
    representedInstallations: representedInstallations,
    normalizeJurisdiction: normalizeJurisdiction,
    jurisdictionCode: jurisdictionCode,
    jurisdictionsIn: jurisdictionsIn,
    normalizeSchool: normalizeSchool,
    dedupeCampuses: dedupeCampuses,
    findSchool: findSchool,
    addressLine: addressLine,
    placeLine: placeLine,
    distanceFor: distanceFor,
    sortSchools: sortSchools,
    matchesQuery: matchesQuery,
    filterDirectory: filterDirectory,
    coverageText: coverageText,
    presentSchool: presentSchool,
    eligibilityBadge: eligibilityBadge,
    evidenceHtml: evidenceHtml,
    escHtml: escHtml,
    websiteHref: websiteHref,
    websiteStatus: websiteStatus,
    mccynListBadge: mccynListBadge,
    APPROXIMATE_NOTE: APPROXIMATE_NOTE,
    fetchDirectorySchools: fetchDirectorySchools,
    fetchPilotSchools: fetchPilotSchools,
    fetchSchoolProfile: fetchSchoolProfile
  };
});
