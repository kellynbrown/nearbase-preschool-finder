// Pilot directory for the selected base.
// Reads public.schools with the same Supabase client account.js already
// builds from window.NB_CONFIG or Netlify SUPABASE_URL + SUPABASE_ANON_KEY.
// The anon key is enough: schools allows public SELECT. Never send a
// service role key to the browser.
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NearBaseDirectory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  // The Pentagon is the primary pilot. Fort Belvoir stays a second pilot.
  // Coordinates match NearBaseMatch.BASES so distance can fall back to a
  // straight-line mile when a base has no distance column yet.
  var PILOTS = {
    pentagon: {
      baseId: "pentagon",
      pilotBase: "pentagon",
      name: "Pentagon",
      nearPhrase: "the Pentagon",
      distancePlace: "the Pentagon",
      badge: "Pentagon pilot",
      distanceColumn: "distance_miles_to_pentagon",
      lat: 38.872,
      lng: -77.056
    },
    belvoir: {
      baseId: "belvoir",
      pilotBase: "fort-belvoir",
      name: "Fort Belvoir",
      nearPhrase: "Fort Belvoir",
      distancePlace: "Belvoir",
      badge: "Fort Belvoir pilot",
      distanceColumn: "distance_miles_to_belvoir",
      lat: 38.71,
      lng: -77.15
    }
  };
  var DEFAULT_PILOT_ID = "pentagon";
  var PAGE_SIZE = 1000;
  var SELECT_BASE = [
    "id", "name", "address", "city", "state", "zip", "phone",
    "lat", "lng",
    "license_type", "license_status", "capacity", "ages_served",
    "hours", "locality", "pilot_base"
  ];

  var CONFIG_MESSAGE = "The school directory isn’t connected. This site needs the existing Supabase URL and anon key (Netlify SUPABASE_URL and SUPABASE_ANON_KEY, or window.NB_CONFIG). The list stays empty until then, and the rest of the page still works.";
  var QUERY_MESSAGE = "The licensed-center list didn’t load. Check the connection and try again. The map and the rest of the page still work.";

  function text(value) {
    return value == null ? "" : String(value).trim();
  }

  function num(value) {
    if (value == null || value === "") return null;
    var n = Number(value);
    return isFinite(n) ? n : null;
  }

  function pilotFor(baseId) {
    return PILOTS[baseId] || null;
  }

  function normalizeSchool(row) {
    row = row || {};
    var id = text(row.id);
    if (!id) return null;
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
      capacity: num(row.capacity),
      agesServed: text(row.ages_served),
      hours: text(row.hours),
      locality: text(row.locality),
      pilotBase: text(row.pilot_base),
      website: websiteHref(row.website)
    };
  }

  function addressLine(school) {
    var stateZip = [school.state, school.zip].filter(Boolean).join(" ");
    var cityLine = [school.city, stateZip].filter(Boolean).join(", ");
    return [school.address, cityLine].filter(Boolean).join(", ");
  }

  function placeLine(school) {
    var city = [school.city, school.state].filter(Boolean).join(", ");
    var locality = school.locality || "";
    if (locality && locality.toLowerCase() !== (school.city || "").toLowerCase()) {
      return city ? locality + " · " + city : locality;
    }
    return city || locality;
  }

  function phoneHref(phone) {
    var compact = String(phone || "").replace(/[^\d+]/g, "");
    return compact.length >= 7 ? "tel:" + compact : "";
  }

  function websiteHref(value) {
    var raw = text(value);
    if (!raw || /[\s<>"'\\]/.test(raw) || /[\u0000-\u001f]/.test(raw)) return "";
    var url;
    try { url = new URL(raw); } catch (error) { return ""; }
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  }

  function storedMiles(school, base) {
    if (!school) return null;
    if (base && base.baseId === "pentagon") return school.distanceMilesToPentagon;
    if (base && base.baseId === "belvoir") return school.distanceMilesToBelvoir;
    if (!base) return school.distanceMilesToBelvoir;
    return null;
  }

  function baseCoords(base) {
    var bases = root.NearBaseMatch && root.NearBaseMatch.BASES;
    if (bases && base && base.baseId) {
      for (var i = 0; i < bases.length; i++) {
        if (bases[i].id === base.baseId && bases[i].lat != null && bases[i].lng != null) {
          return { lat: Number(bases[i].lat), lng: Number(bases[i].lng) };
        }
      }
    }
    if (base && base.lat != null && base.lng != null) return { lat: Number(base.lat), lng: Number(base.lng) };
    return null;
  }

  function distanceFor(school, homePoint, haversine, base) {
    if (homePoint && school.lat != null && school.lng != null &&
        homePoint.lat != null && homePoint.lng != null && typeof haversine === "function") {
      var homeMiles = haversine(Number(homePoint.lat), Number(homePoint.lng), school.lat, school.lng);
      if (homeMiles != null && isFinite(homeMiles)) {
        return { miles: homeMiles, label: homeMiles.toFixed(1) + " mi from home", from: "home" };
      }
    }
    var stored = storedMiles(school, base);
    if (stored != null) {
      var place = base && base.distancePlace ? base.distancePlace : "Belvoir";
      return {
        miles: stored,
        label: stored.toFixed(1) + " mi from " + place,
        from: base && base.baseId ? base.baseId : "belvoir"
      };
    }
    var point = baseCoords(base);
    if (point && school.lat != null && school.lng != null && typeof haversine === "function") {
      var miles = haversine(point.lat, point.lng, school.lat, school.lng);
      if (miles != null && isFinite(miles)) {
        var basePlace = base.distancePlace || base.name || "base";
        return { miles: miles, label: miles.toFixed(1) + " mi from " + basePlace, from: "base" };
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
      school.name, school.city, school.locality, school.address, school.zip,
      school.state, school.hours, school.agesServed, school.licenseType, school.licenseStatus, school.phone
    ].join(" ").toLowerCase();
    return blob.indexOf(q) !== -1;
  }

  function presentSchool(school, homePoint, haversine, base) {
    var dist = distanceFor(school, homePoint, haversine, base);
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
      miles: dist.miles,
      distanceLabel: dist.label,
      milesShort: dist.miles == null ? "—" : dist.miles.toFixed(1),
      websiteHref: websiteHref(school.website),
      facts: facts
    };
  }

  function errorMessage(error) {
    var message = error && error.message ? String(error.message).trim() : "";
    return message ? message.slice(0, 180) : "The directory query failed.";
  }

  function columnMissing(error, column) {
    if (!error || !column) return false;
    var blob = [error.message, error.details, error.hint, error.code].map(function (part) {
      return part == null ? "" : String(part);
    }).join(" ");
    if (blob.indexOf(column) === -1) return false;
    return /does not exist|schema cache|42703|PGRST204/i.test(blob);
  }

  function readPilot(sb, pilot, attempt) {
    var acc = [];
    var cols = SELECT_BASE.slice();
    if (attempt.website) cols.push("website");
    if (attempt.distance && pilot.distanceColumn) cols.push(pilot.distanceColumn);
    var selectList = cols.join(",");
    function page(from) {
      var query = sb.from("schools").select(selectList).eq("pilot_base", pilot.pilotBase);
      if (attempt.distance && pilot.distanceColumn) query = query.order(pilot.distanceColumn, { ascending: true });
      else query = query.order("name", { ascending: true });
      return query.range(from, from + PAGE_SIZE - 1).then(function (result) {
        if (!result || result.error) {
          var missingColumn = "";
          if (attempt.website && columnMissing(result && result.error, "website")) missingColumn = "website";
          else if (attempt.distance && columnMissing(result && result.error, pilot.distanceColumn)) missingColumn = pilot.distanceColumn;
          return {
            ok: false,
            schools: [],
            message: errorMessage(result && result.error),
            missingColumn: missingColumn,
            missingDistanceColumn: missingColumn === pilot.distanceColumn
          };
        }
        var rows = result.data || [];
        rows.forEach(function (row) {
          var school = normalizeSchool(row);
          if (school && (!school.pilotBase || school.pilotBase === pilot.pilotBase)) acc.push(school);
        });
        if (rows.length === PAGE_SIZE) return page(from + PAGE_SIZE);
        return { ok: true, schools: acc, message: "", missingColumn: "", missingDistanceColumn: false };
      });
    }
    return Promise.resolve().then(function () { return page(0); }).catch(function (error) {
      var missingColumn = "";
      if (attempt.website && columnMissing(error, "website")) missingColumn = "website";
      else if (attempt.distance && columnMissing(error, pilot.distanceColumn)) missingColumn = pilot.distanceColumn;
      return {
        ok: false,
        schools: [],
        message: errorMessage(error),
        missingColumn: missingColumn,
        missingDistanceColumn: missingColumn === pilot.distanceColumn
      };
    });
  }

  function fetchPilotSchools(sb, baseId) {
    var pilot = pilotFor(baseId || DEFAULT_PILOT_ID);
    if (!pilot) {
      return Promise.resolve({ ok: false, schools: [], message: "That base does not have a pilot directory yet." });
    }
    var attempt = { distance: true, website: true };
    function once() {
      return readPilot(sb, pilot, attempt).then(function (result) {
        if (result && result.missingColumn === "website" && attempt.website) {
          attempt.website = false;
          return once();
        }
        if (result && result.missingColumn === pilot.distanceColumn && attempt.distance) {
          attempt.distance = false;
          return once();
        }
        return result;
      });
    }
    return once();
  }

  var primary = PILOTS[DEFAULT_PILOT_ID];

  return {
    PILOTS: PILOTS,
    DEFAULT_PILOT_ID: DEFAULT_PILOT_ID,
    PILOT_BASE: primary.pilotBase,
    PILOT_BASE_ID: primary.baseId,
    CONFIG_MESSAGE: CONFIG_MESSAGE,
    QUERY_MESSAGE: QUERY_MESSAGE,
    pilotFor: pilotFor,
    normalizeSchool: normalizeSchool,
    addressLine: addressLine,
    placeLine: placeLine,
    distanceFor: distanceFor,
    sortSchools: sortSchools,
    matchesQuery: matchesQuery,
    presentSchool: presentSchool,
    websiteHref: websiteHref,
    fetchPilotSchools: fetchPilotSchools
  };
});
