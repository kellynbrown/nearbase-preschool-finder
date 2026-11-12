// Side-by-side shortlist. Public school facts come from the directory.
// Rating, ratio, and quoted cost come from the signed-in family's tour log.
(function () {
  var Family = window.NearBaseFamily;
  var Directory = window.NearBaseDirectory;
  var params = new URLSearchParams(location.search);
  var schools = [];
  var shortlist = [];
  var tours = [];
  var openings = [];
  var signedIn = false;

  function localFavorites() {
    try {
      return JSON.parse(localStorage.getItem("nb_favorites") || "[]").map(function (item) {
        return { school_slug: item.slug, school_name: item.name || item.slug };
      });
    } catch (error) {
      return [];
    }
  }

  function selectedIds() {
    return [].map.call(document.querySelectorAll("#picks input:checked"), function (box) {
      return box.value;
    }).slice(0, 4);
  }

  function paint() {
    var base = Directory.pilotFor(document.getElementById("compareBase").value) || Directory.pilotFor("pentagon");
    var ids = selectedIds();
    var columns = ids.map(function (id) {
      var school = schools.filter(function (item) { return item.id === id; })[0];
      if (!school) {
        var saved = shortlist.filter(function (item) { return item.school_slug === id; })[0];
        school = { id: id, name: saved && saved.school_name ? saved.school_name : id };
      }
      var distance = Directory.distanceFor(school, null, window.NearBaseMatch.haversineMiles, base);
      var tour = tours.filter(function (item) { return item.school_id === id; })[0] || null;
      return Family.compareColumn(school, {
        signedIn: signedIn,
        tour: tour,
        openings: openings.filter(function (item) { return item.school_id === id; }),
        distanceLabel: distance.label || "Distance not on record",
        eligibility: Directory.eligibilityBadge(school),
        now: new Date()
      });
    });
    document.getElementById("compareTable").innerHTML = Family.compareTableHtml(columns);
  }

  function renderPicks() {
    var requested = (params.get("ids") || "").split(",").map(function (id) { return id.trim(); }).filter(Boolean);
    var ids = [];
    shortlist.forEach(function (item) {
      if (item.school_slug && ids.indexOf(item.school_slug) === -1) ids.push(item.school_slug);
    });
    requested.forEach(function (id) {
      if (ids.indexOf(id) === -1) ids.push(id);
    });
    var box = document.getElementById("picks");
    if (!ids.length) {
      box.innerHTML = "";
      document.getElementById("compareTable").innerHTML = Family.compareTableHtml([]);
      document.getElementById("compareStatus").textContent = "No saved schools yet. Use the heart on Find.";
      return;
    }
    box.innerHTML = ids.map(function (id) {
      var school = schools.filter(function (item) { return item.id === id; })[0];
      var saved = shortlist.filter(function (item) { return item.school_slug === id; })[0];
      var name = school ? school.name : (saved && saved.school_name) || id;
      var checked = requested.length ? requested.indexOf(id) !== -1 : ids.indexOf(id) < 3;
      return '<label><input type="checkbox" value="' + Family.esc(id) + '"' + (checked ? " checked" : "") + "> " + Family.esc(name) + "</label>";
    }).join("");
    paint();
  }

  function fillBases() {
    var select = document.getElementById("compareBase");
    var options = Directory.selectorBases(window.NearBaseMatch.BASES, schools);
    select.innerHTML = options.map(function (item) {
      return '<option value="' + Family.esc(item.value) + '">' + Family.esc(item.label) + "</option>";
    }).join("");
    var requested = Directory.pilotFor(params.get("base"));
    var wanted = requested ? requested.baseId : "pentagon";
    if ([].some.call(select.options, function (option) { return option.value === wanted; })) select.value = wanted;
  }

  document.getElementById("compareForm").addEventListener("submit", function (event) {
    event.preventDefault();
    paint();
  });
  document.getElementById("compareForm").addEventListener("change", function (event) {
    if (event.target && event.target.type === "checkbox") paint();
  });

  window.NearBaseAccount.ready().then(function () {
    return window.NearBaseAccount.client();
  }).then(function (sb) {
    if (!sb) {
      document.getElementById("compareStatus").textContent = Directory.CONFIG_MESSAGE;
      document.getElementById("compareTable").innerHTML = Family.compareTableHtml([]);
      return;
    }
    var user = window.NearBaseAccount.state().session && window.NearBaseAccount.state().session.user;
    signedIn = !!user;
    shortlist = localFavorites();
    var directoryLoad = Directory.fetchDirectorySchools(sb).then(function (result) {
      if (!result || !result.ok) {
        document.getElementById("compareStatus").textContent = result && result.message ? result.message : Directory.QUERY_MESSAGE;
        return;
      }
      schools = result.schools || [];
    });
    var favoriteLoad = user
      ? sb.from("favorites").select("school_slug,school_name").eq("user_id", user.id).then(function (result) {
        (result.data || []).forEach(function (item) {
          if (!shortlist.some(function (saved) { return saved.school_slug === item.school_slug; })) shortlist.push(item);
        });
      })
      : Promise.resolve();
    return Promise.all([directoryLoad, favoriteLoad]).then(function () {
      var ids = shortlist.map(function (item) { return item.school_slug; }).concat((params.get("ids") || "").split(",")).filter(Boolean);
      ids = ids.filter(function (id, index) { return ids.indexOf(id) === index; }).slice(0, 12);
      var openingLoad = ids.length
        ? sb.from("openings_reports_public").select("school_id,age_room,status,available_places,opens_on,as_of,expires_at,source,provider_confirmed,public_note").in("school_id", ids)
        : Promise.resolve({ data: [] });
      var tourLoad = user && ids.length
        ? sb.from("tour_logs").select("school_id,rating,would_enroll,quoted_cost,quoted_cost_period,infant_checklist").eq("user_id", user.id).in("school_id", ids)
        : Promise.resolve({ data: [] });
      return Promise.all([openingLoad, tourLoad]).then(function (results) {
        openings = results[0] && results[0].data || [];
        tours = results[1] && results[1].data || [];
        fillBases();
        renderPicks();
        if (!document.getElementById("compareStatus").textContent) {
          document.getElementById("compareStatus").textContent = signedIn
            ? "Your rating is included where you have a tour log."
            : "Sign in to add your rating, ratio, and quoted cost. Public distance, eligibility, and openings are shown.";
        }
      });
    });
  }).catch(function () {
    document.getElementById("compareStatus").textContent = Directory.QUERY_MESSAGE;
    document.getElementById("compareTable").innerHTML = Family.compareTableHtml([]);
  });
})();
