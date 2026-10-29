// School profile extras: family match, tour questions, and a share card.
(function () {
  var Match = window.NearBaseMatch;
  var Insights = window.NearBaseInsights;
  if (!Match || !Insights) return;

  var slug = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");
  var school = (window.SCHOOLS || []).find(function (s) { return s.slug === slug; });
  if (!school) return;

  var css = document.createElement("style");
  css.textContent = [
    ".nb-insights{background:#fff;border:1px solid #d4ead8;border-radius:20px;padding:1.25rem 1.35rem;margin-bottom:1rem}",
    ".nb-kicker{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:#1D9E75;font-weight:500;margin-bottom:.35rem}",
    ".nb-insights h2{font-family:Fraunces,serif;font-weight:600;color:#085041;font-size:1.35rem;line-height:1.2;margin-bottom:.45rem}",
    ".nb-insights h3{font-family:Fraunces,serif;font-weight:600;color:#085041;font-size:1.05rem;margin:1.1rem 0 .4rem}",
    ".nb-lead{font-size:.95rem;line-height:1.55;color:#1a1a18;margin-bottom:.35rem}",
    ".nb-meta{font-size:.78rem;line-height:1.5;color:#6b6b67;margin-bottom:.6rem}",
    ".nb-why,.nb-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:.55rem}",
    ".nb-why li,.nb-list li{font-size:.86rem;line-height:1.5;color:#1a1a18}",
    ".nb-k{display:inline-block;font-size:.62rem;letter-spacing:.04em;text-transform:uppercase;font-weight:500;border-radius:100px;padding:.12rem .45rem;margin-right:.3rem;vertical-align:1px}",
    ".nb-k-listing{background:#E1F5EE;color:#085041}",
    ".nb-k-gap{background:#FAEEDA;color:#633806}",
    ".nb-k-guidance{background:#F3EEF8;color:#5B2D8E}",
    ".nb-forward{color:#1D9E75;font-weight:500;text-decoration:none}",
    ".nb-share{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1rem}",
    ".nb-share-btn{background:#fff;color:#085041;border:1px solid #d4ead8;border-radius:100px;padding:.5rem .9rem;font-family:inherit;font-size:.8rem;cursor:pointer}",
    ".nb-share-btn:hover,.nb-share-btn:focus-visible{border-color:#1D9E75;outline:none}",
    ".nb-dir{font-size:.75rem;color:#6b6b67;margin-top:.35rem}",
    ".worth{background:#F8FAF8;border:1px solid #d4ead8;border-radius:16px;padding:.9rem 1rem;margin-top:1rem}",
    ".worth h3{margin-top:0}",
    ".nb-track-school{background:#1D9E75;color:#fff;border-color:#1D9E75}"
  ].join("");
  document.head.appendChild(css);

  var saved = false;
  try { saved = !!localStorage.getItem(Match.PROFILE_KEY); } catch (err) { saved = false; }
  var profile = Match.loadProfile();
  var mount = document.createElement("div");
  mount.innerHTML = Insights.renderSchoolPanel(school, profile);
  var anchor = document.querySelector(".pf");
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(mount, anchor);
  else document.querySelector(".wrap") && document.querySelector(".wrap").appendChild(mount);

  var scoreEl = document.getElementById("score");
  var result = Match.scoreSchool(school, profile);
  if (scoreEl && result.score != null) {
    scoreEl.textContent = result.score;
    var label = scoreEl.parentNode && scoreEl.parentNode.querySelector(".l");
    if (label) label.textContent = saved ? "Family match" : "Match vs Pentagon";
    if (!document.getElementById("nb-dir-note") && school.score) {
      var note = document.createElement("div");
      note.id = "nb-dir-note";
      note.className = "nb-dir";
      note.textContent = "Directory note " + school.score + (saved ? "" : " · Set your base for a closer match");
      scoreEl.parentNode.appendChild(note);
    }
  }

  var root = mount.querySelector(".nb-insights") || mount;
  root.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-share]");
    if (!btn) return;
    var kind = btn.getAttribute("data-share");
    var link = (document.querySelector('link[rel="canonical"]') || {}).href || location.href;
    if (kind === "copy") {
      var done = function () { btn.textContent = "Link copied"; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done).catch(done);
      else done();
    } else if (kind === "x") {
      var text = school.name + " on NearBase — a preschool listing for military families";
      window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(link), "_blank", "noopener,noreferrer");
    } else if (kind === "card") {
      drawCard(school).then(function (blob) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "nearbase-" + school.slug + ".png";
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
      });
    }
  });

  function drawCard(s) {
    var canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#085041";
    ctx.fillRect(0, 0, 1080, 1080);
    ctx.fillStyle = "#1D9E75";
    ctx.fillRect(0, 0, 1080, 18);
    ctx.fillStyle = "#F8FAF8";
    roundRect(ctx, 72, 120, 936, 840, 36);
    ctx.fill();
    var ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    return ready.then(function () {
      ctx.fillStyle = "#1D9E75";
      ctx.font = "500 28px 'DM Sans', sans-serif";
      ctx.fillText("NEARBASE", 120, 200);
      ctx.fillStyle = "#C8922A";
      ctx.fillRect(120, 224, 72, 6);
      ctx.fillStyle = "#085041";
      ctx.font = "600 64px Fraunces, serif";
      wrapText(ctx, s.name, 120, 320, 840, 74);
      ctx.fillStyle = "#6b6b67";
      ctx.font = "400 32px 'DM Sans', sans-serif";
      ctx.fillText(s.loc || "National Capital Region", 120, 560);
      var badges = (s.badges || []).slice(0, 3);
      var x = 120;
      ctx.font = "500 24px 'DM Sans', sans-serif";
      badges.forEach(function (b) {
        var label = b.t || "";
        var w = ctx.measureText(label).width + 36;
        ctx.fillStyle = "#E1F5EE";
        roundRect(ctx, x, 610, w, 48, 24);
        ctx.fill();
        ctx.fillStyle = "#085041";
        ctx.fillText(label, x + 18, 642);
        x += w + 12;
      });
      ctx.fillStyle = "#085041";
      ctx.font = "400 28px 'DM Sans', sans-serif";
      ctx.fillText("For military families on a PCS move", 120, 820);
      ctx.fillStyle = "#6b6b67";
      ctx.font = "400 22px 'DM Sans', sans-serif";
      ctx.fillText("Listing preview. Not a live waitlist.", 120, 870);
      return new Promise(function (resolve) { canvas.toBlob(resolve, "image/png"); });
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, x, y, max, lineHeight) {
    var words = String(text || "").split(/\s+/);
    var line = "";
    var yy = y;
    words.forEach(function (word) {
      var next = line ? line + " " + word : word;
      if (ctx.measureText(next).width > max && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineHeight;
      } else line = next;
    });
    if (line) ctx.fillText(line, x, yy);
  }

  var Tracker = window.NearBaseTracker;
  if (Tracker) {
    var worth = document.createElement("div");
    worth.className = "nb-worth";
    var already = false;
    try {
      var savedList = JSON.parse(localStorage.getItem("nb_waitlist") || "[]");
      already = savedList.some(function (item) { return item.school_slug === school.slug; });
    } catch (err) { already = false; }
    worth.innerHTML = Tracker.renderWorth(Tracker.fitFactors(result), { disclaimer: true }) +
      '<div class="nb-share"><button type="button" class="nb-share-btn nb-track-school" data-slug="' + Match.esc(school.slug) + '" data-name="' + Match.esc(school.name) + '">' +
      (already ? "On your tracker" : "Add to tracker") + "</button></div>" +
      '<p class="nb-meta">Free with a NearBase account. Premium is optional.</p>';
    root.appendChild(worth);
  }
})();
