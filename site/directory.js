// Fort Belvoir pilot directory.
// Reads public.schools with the same Supabase client account.js already
// builds from window.NB_CONFIG or Netlify SUPABASE_URL + SUPABASE_ANON_KEY.
// The anon key is enough: schools allows public SELECT. Never send a
// service role key to the browser.
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NearBaseDirectory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var PILOT_BASE = "fort-belvoir";
  var PILOT_BASE_ID = "belvoir";
  var PAGE_SIZE = 1000;
  var SELECT_COLUMNS = [
    "id", "name", "address", "city", "state", "zip", "phone",
    "lat", "lng", "distance_miles_to_belvoir",
    "license_type", "license_status", "capacity", "ages_served",
    "hours", "locality", "pilot_base"
  ].join(",");

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
      licenseType: text(row.license_type),
      licenseStatus: text(row.license_status),
      capacity: num(row.capacity),
      agesServed: text(row.ages_served),
      hours: text(row.hours),
      locality: text(row.locality),
      pilotBase: text(row.pilot_base)
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

  function distanceFor(school, homePoint, haversine) {
    if (homePoint && school.lat != null && school.lng != null &&
        homePoint.lat != null && homePoint.lng != null && typeof haversine === "function") {
      var miles = haversine(Number(homePoint.lat), Number(homePoint.lng), school.lat, school.lng);
      if (miles != null && isFinite(miles)) {
        return { miles: miles, label: miles.toFixed(1) + " mi from home", from: "home" };
      }
    }
    if (school.distanceMilesToBelvoir != null) {
      return {
        miles: school.distanceMilesToBelvoir,
        label: school.distanceMilesToBelvoir.toFixed(1) + " mi from Belvoir",
        from: "belvoir"
      };
    }
    return { miles: null, label: "", from: "none" };
  }

  function sortSchools(schools, homePoint, haversine) {
    return (schools || []).slice().sort(function (a, b) {
      var da = distanceFor(a, homePoint, haversine).miles;
      var db = distanceFor(b, homePoint, haversine).miles;
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

  function presentSchool(school, homePoint, haversine) {
    var dist = distanceFor(school, homePoint, haversine);
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
      facts: facts
    };
  }

  function errorMessage(error) {
    var message = error && error.message ? String(error.message).trim() : "";
    return message ? message.slice(0, 180) : "The directory query failed.";
  }

  function fetchPilotSchools(sb) {
    var acc = [];
    function page(from) {
      return sb.from("schools")
        .select(SELECT_COLUMNS)
        .eq("pilot_base", PILOT_BASE)
        .order("distance_miles_to_belvoir", { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
        .then(function (result) {
          if (!result || result.error) {
            return { ok: false, schools: [], message: errorMessage(result && result.error) };
          }
          var rows = result.data || [];
          rows.forEach(function (row) {
            var school = normalizeSchool(row);
            if (school && (!school.pilotBase || school.pilotBase === PILOT_BASE)) acc.push(school);
          });
          if (rows.length === PAGE_SIZE) return page(from + PAGE_SIZE);
          return { ok: true, schools: acc, message: "" };
        });
    }
    return Promise.resolve().then(function () { return page(0); }).catch(function (error) {
      return { ok: false, schools: [], message: errorMessage(error) };
    });
  }

  return {
    PILOT_BASE: PILOT_BASE,
    PILOT_BASE_ID: PILOT_BASE_ID,
    CONFIG_MESSAGE: CONFIG_MESSAGE,
    QUERY_MESSAGE: QUERY_MESSAGE,
    normalizeSchool: normalizeSchool,
    addressLine: addressLine,
    placeLine: placeLine,
    distanceFor: distanceFor,
    sortSchools: sortSchools,
    matchesQuery: matchesQuery,
    presentSchool: presentSchool,
    fetchPilotSchools: fetchPilotSchools
  };
});
