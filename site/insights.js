// Plain-language insights from listing fields and general PCS guidance.
// School facts are quoted from the record. Guidance is labeled as guidance.
(function (root, factory) {
  var Match = (typeof root.NearBaseMatch === "object" && root.NearBaseMatch) ||
    (typeof require === "function" ? require("./match.js") : null);
  var api = factory(Match);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NearBaseInsights = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Match) {
  function signalsOf(school, signals) {
    return signals || Match.readSignals(school);
  }

  function item(kind, text) {
    return { kind: kind, text: text };
  }

  function summarizeSchool(school, signals) {
    var s = signalsOf(school, signals);
    var c = s.corpus;
    var sentences = [];
    var name = c.name || "This school";
    var place = c.loc ? name + " is listed in " + c.loc + "." : name + " is in the NearBase directory.";
    sentences.push({ kind: "listing", text: place });

    var notes = c.badges.slice(0, 4);
    if (notes.length) {
      sentences.push({ kind: "listing", text: "Notes on the listing: " + notes.join(", ") + "." });
    } else {
      sentences.push({ kind: "gap", text: "This listing has no program badges yet." });
    }

    if (s.philosophies.length) {
      sentences.push({
        kind: "listing",
        text: "From those fields, the program reads as " + s.philosophies.map(function (id) {
          return Match.PHILOSOPHY_LABEL[id];
        }).join(" and ") + "."
      });
    } else {
      sentences.push({ kind: "gap", text: "Program philosophy is not written on this listing." });
    }

    if (s.hours.known && s.hours.evidence) {
      sentences.push({ kind: "listing", text: "Hours noted: " + s.hours.evidence + "." });
    } else {
      sentences.push({ kind: "gap", text: "Open and close times are not on this listing." });
    }

    if (s.waitMonths) {
      sentences.push({ kind: "listing", text: "Waitlist noted: " + s.waitMonths[0] + "–" + s.waitMonths[1] + " months." });
    } else if (s.waitEvidence) {
      sentences.push({ kind: "listing", text: "A waitlist is mentioned (" + s.waitEvidence + ") without a length." });
    } else {
      sentences.push({ kind: "gap", text: "Waitlist length is not on this listing." });
    }

    if (s.mccyn) sentences.push({ kind: "listing", text: "Military fee assistance noted: " + s.mccynEvidence + "." });
    else if (s.discount) sentences.push({ kind: "listing", text: "Military pricing noted: " + s.discountEvidence + "." });
    else if (s.subsidy) sentences.push({ kind: "listing", text: "Free or subsidized seat noted: " + s.subsidyEvidence + "." });
    else sentences.push({ kind: "gap", text: "MCCYN, a military discount, and subsidy status are not on this listing." });

    if (s.efmp) sentences.push({ kind: "listing", text: "Support note: " + s.efmpEvidence + "." });
    else sentences.push({ kind: "gap", text: "EFMP or special-needs support is not described on this listing." });

    if (c.quote) sentences.push({ kind: "listing", text: "Listing note: \u201c" + c.quote + "\u201d" });
    return sentences;
  }

  function tourChecklist(school, profile, signals) {
    var s = signalsOf(school, signals);
    var p = Match.normalizeProfile(profile);
    var out = [];

    if (s.hours.known && s.hours.evidence) {
      out.push(item("listing", "Confirm the hours on the listing (" + s.hours.evidence + "), including before-care and what happens if duty runs late."));
    } else {
      out.push(item("gap", "Ask what time the door opens and closes, and whether before-care covers an early duty call. Hours are not on this listing."));
    }

    if (p.ages.length && s.age.known) {
      var asked = p.ages.map(function (a) { return Match.AGE_LABEL[a]; }).join(" and ");
      var ev = s.ageEvidence.length ? s.ageEvidence.slice(0, 2).join("; ") : "the ages written on the listing";
      out.push(item("listing", "Confirm they can take your " + asked + ". The listing mentions: " + ev + "."));
    } else if (p.ages.length) {
      out.push(item("gap", "Ask which ages they actually enroll. Your search includes " + p.ages.map(function (a) { return Match.AGE_LABEL[a]; }).join(" and ") + ", and ages are thin on this listing."));
    } else {
      out.push(item("gap", "Ask the youngest and oldest ages in the room you would join. Ages are not specific on this listing."));
    }

    if (s.mccyn) {
      out.push(item("listing", "The listing says " + s.mccynEvidence + ". Ask which fee-assistance paperwork they need and how long approval takes."));
    } else if (p.mccyn || p.subsidy) {
      out.push(item("gap", "Ask whether they accept MCCYN / Child Care Aware fee assistance, or another military discount. That is not written on this listing."));
    } else {
      out.push(item("guidance", "Even if you may not use it, ask about MCCYN and military discounts. General question, not a claim about this school."));
    }

    if (s.midYear) {
      out.push(item("listing", "Ask how the off-cycle note works in practice (" + s.midYearEvidence + "): a seat now, or a list for later?"));
    } else if (s.lottery) {
      out.push(item("listing", "The listing mentions a lottery (" + s.lotteryEvidence + "). Ask the current deadline and whether a PCS arrival can start outside that cycle."));
    } else if (p.timing === "now" || p.timing === "summer") {
      out.push(item("gap", "Ask if they enroll mid-year when orders arrive, or only at the fall start. Mid-year enrollment is not on this listing."));
    } else {
      out.push(item("guidance", "Ask whether a family can start mid-year. General PCS question, not something this listing answers."));
    }

    if (s.waitMonths) {
      out.push(item("listing", "Ask where you would actually land on the list. The listing says " + s.waitMonths[0] + "–" + s.waitMonths[1] + " months."));
    } else if (s.waitEvidence) {
      out.push(item("listing", "Ask for today's wait in months. The listing mentions a waitlist (" + s.waitEvidence + ") without a number."));
    } else {
      out.push(item("gap", "Ask for the current wait in months, and whether siblings or military orders move it. Waitlist length is not on this listing."));
    }

    if (p.efmp && s.efmp) {
      out.push(item("listing", "The listing mentions " + s.efmpEvidence + ". Ask how that works with your EFMP plan, therapies, and ratios."));
    } else if (p.efmp) {
      out.push(item("gap", "Ask how they support EFMP, IEPs, and therapies. This listing does not describe special-needs support."));
    } else if (s.efmp) {
      out.push(item("listing", "The listing mentions " + s.efmpEvidence + ". If that matters later, ask what is actually on site."));
    }

    if (s.philosophies.length) {
      out.push(item("listing", "Ask to see the classroom that matches the listing's " + s.philosophies.map(function (id) { return Match.PHILOSOPHY_LABEL[id]; }).join(" / ") + " description, not only the lobby."));
    } else {
      out.push(item("gap", "Ask what a morning looks like: child-led, teacher-led, outdoor, or a mix. Philosophy is not on this listing."));
    }

    out.push(item("guidance", "Ask what happens to your spot if deployment, a shift change, or a new set of orders lands. General military-family question, not a fact about this school."));
    return out.slice(0, 8);
  }

  function familyQuestions(school, signals) {
    var s = signalsOf(school, signals);
    var prompts = [];
    prompts.push(item("guidance", "Did someone answer, and how many days did it take? Response time is not on this listing."));
    if (s.waitMonths) {
      prompts.push(item("listing", "The listing says a " + s.waitMonths[0] + "–" + s.waitMonths[1] + " month wait. What number did they give you on the phone?"));
    } else {
      prompts.push(item("gap", "What waitlist length, in months, did they give you? Nothing numeric is on this listing."));
    }
    if (s.midYear) {
      prompts.push(item("listing", "The listing mentions " + s.midYearEvidence + ". Did they actually offer a mid-year start?"));
    } else {
      prompts.push(item("gap", "Can a family with orders in hand start mid-year? The listing does not say."));
    }
    if (s.hours.known && s.hours.evidence) {
      prompts.push(item("listing", "Hours on the listing: " + s.hours.evidence + ". Did the phone match that, including early drop-off?"));
    } else {
      prompts.push(item("gap", "What open and close times did they quote, including before-care?"));
    }
    if (s.mccyn || s.discount) {
      prompts.push(item("listing", "The listing notes " + (s.mccynEvidence || s.discountEvidence) + ". Did staff confirm it, and what paperwork did they name?"));
    } else {
      prompts.push(item("gap", "Do they take MCCYN or a military discount? It is not on this listing."));
    }
    prompts.push(item("guidance", "How did the room feel for a child who just arrived? Culture is not something this listing can know."));
    return prompts;
  }

  function pcsTimeline(profile) {
    var p = Match.normalizeProfile(profile);
    var items;
    if (p.timing === "now") {
      items = [
        "This week: call installation child development centers if you are eligible. Many lists are long, and a listing will say so only when NearBase has that note.",
        "This week: put your name on two or three civilian programs that fit your hours. Do not wait until housing is signed.",
        "Next two weeks: tour. Ask the mid-year question before you plan around a September-only start.",
        "Keep a written note from each call. That note is what the next family needs."
      ];
    } else if (p.timing === "summer") {
      items = [
        "Now: submit installation CDC applications if your branch allows it this far out.",
        "DC charter and public PK lotteries often have a winter deadline. Confirm this year's date with the school system. NearBase does not store a live deadline per school.",
        "Spring: tour, before summer PCS traffic fills the calendars.",
        "Three months out: call again. Waitlist numbers move, and the listing may be older than your orders."
      ];
    } else if (p.timing === "planning") {
      items = [
        "Installation lists of a year or more are the reason families call when orders are still early, if the branch will take the application.",
        "When you read each school, separate September-start programs from ones that say rolling or mid-year enrollment.",
        "Use the preference quiz now, then run it again when the base and the ages are firm.",
        "A listing without a waitlist number is unfinished business, not a short list."
      ];
    } else {
      items = [
        "If you are inside three months, call this week and ask about mid-year seats.",
        "If you are several months out, start installation lists early and confirm lottery dates yourself.",
        "If the timeline is still unknown, collect hours, ages, and fee assistance before you fall in love with a philosophy.",
        "Every call you write down shortens the search for the family behind you."
      ];
    }
    return {
      kind: "guidance",
      title: "PCS timing — general guidance, not a promise about any school",
      items: items
    };
  }

  function kindLabel(kind) {
    if (kind === "listing") return "From this listing";
    if (kind === "gap") return "Not in our notes";
    return "General guidance";
  }

  function renderSchoolPanel(school, profile) {
    var match = Match.scoreSchool(school, profile);
    var summary = summarizeSchool(school, match.signals);
    var checklist = tourChecklist(school, profile, match.signals);
    var questions = familyQuestions(school, match.signals);
    var timeline = pcsTimeline(profile);
    var esc = Match.esc;
    var pct = Math.round((match.confidence || 0) * 100);
    var score = match.score == null ? "—" : String(match.score);

    function rows(list) {
      return list.map(function (entry) {
        return '<li><span class="nb-k nb-k-' + entry.kind + '">' + kindLabel(entry.kind) + '</span> ' + esc(entry.text) + '</li>';
      }).join("");
    }

    var why = match.factors.filter(function (f) { return f.status !== "na" && f.weight; }).map(function (f) {
      var tag = f.status === "known" ? (f.score + " / 100") : "Not in the listing";
      return '<li><strong>' + esc(f.label) + '</strong> <span class="nb-k nb-k-' + (f.status === "known" ? "listing" : "gap") + '">' + tag + '</span><div>' + esc(f.detail) + '</div></li>';
    }).join("");

    return (
      '<section class="nb-insights" aria-labelledby="nb-insights-title">' +
        '<p class="nb-kicker">Family match · built only from this listing</p>' +
        '<h2 id="nb-insights-title">Why this school scored <span id="nb-match-score">' + esc(score) + '</span></h2>' +
        '<p class="nb-lead">' + esc(match.headline) + '</p>' +
        '<p class="nb-meta">About ' + pct + '% of the weight is backed by listing fields. Missing facts count as neutral, not as a no. Straight-line miles, not drive time.</p>' +
        '<ol class="nb-why">' + why + '</ol>' +
        '<h3>In plain language</h3>' +
        '<ul class="nb-list">' + rows(summary) + '</ul>' +
        '<h3>What to ask on the tour or call</h3>' +
        '<ul class="nb-list">' + rows(checklist) + '</ul>' +
        '<h3>Questions other military families need answered</h3>' +
        '<p class="nb-meta">Prompts for the paid-forward loop. These are not quotes from a named family.</p>' +
        '<ul class="nb-list">' + rows(questions) + '</ul>' +
        '<p><a class="nb-forward" href="/checkin?school=' + encodeURIComponent(school.id) + '">Share what you learned at ' + esc(school.name) + ' →</a></p>' +
        '<h3>' + esc(timeline.title) + '</h3>' +
        '<ul class="nb-list">' + timeline.items.map(function (t) {
          return '<li><span class="nb-k nb-k-guidance">General guidance</span> ' + esc(t) + '</li>';
        }).join("") + '</ul>' +
        '<div class="nb-share" data-slug="' + esc(school.slug) + '">' +
          '<button type="button" class="nb-share-btn" data-share="copy">Copy link</button>' +
          '<button type="button" class="nb-share-btn" data-share="x">Share on X</button>' +
          '<button type="button" class="nb-share-btn" data-share="card">Download Instagram card</button>' +
        '</div>' +
      '</section>'
    );
  }

  return {
    summarizeSchool: summarizeSchool,
    tourChecklist: tourChecklist,
    familyQuestions: familyQuestions,
    pcsTimeline: pcsTimeline,
    kindLabel: kindLabel,
    renderSchoolPanel: renderSchoolPanel
  };
});
