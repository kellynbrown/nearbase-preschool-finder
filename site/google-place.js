// Google place photos, Street View, and official social embeds.
// Photo bytes and photo URIs are never stored. A missing browser key
// leaves the school_media placeholder in place.
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NearBaseGoogle = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function text(value) {
    return value == null ? "" : String(value).trim();
  }

  function browserKey(source) {
    var config = source || (typeof window !== "undefined" && window.NB_CONFIG ? window.NB_CONFIG : {});
    var named = !source && typeof window !== "undefined" ? window.GOOGLE_MAPS_BROWSER_KEY : "";
    return text(config.GOOGLE_MAPS_BROWSER_KEY || named);
  }

  function httpsUrl(raw) {
    var rawText = text(raw);
    if (!rawText) return "";
    var url;
    try { url = new URL(rawText); } catch (error) { return ""; }
    if (url.protocol !== "https:") return "";
    if (url.username || url.password) return "";
    if (url.port && url.port !== "443") return "";
    return url.href;
  }

  function placeId(value) {
    var id = text(value);
    return /^[A-Za-z0-9_-]{8,255}$/.test(id) ? id : "";
  }

  function hostIs(url, names) {
    var host = url.hostname.toLowerCase();
    return names.indexOf(host) !== -1;
  }

  function streetViewEmbedUrl(key, lat, lng) {
    var apiKey = text(key);
    var latitude = Number(lat);
    var longitude = Number(lng);
    if (!apiKey || !isFinite(latitude) || !isFinite(longitude)) return "";
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return "";
    var url = new URL("https://www.google.com/maps/embed/v1/streetview");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("location", latitude.toFixed(6) + "," + longitude.toFixed(6));
    return url.href;
  }

  function authorAttributions(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (item) {
      var name = text(item && (item.displayName || item.display_name));
      if (!name || name.length > 200) return;
      out.push({
        displayName: name,
        uri: httpsUrl(item && item.uri),
        photoURI: httpsUrl(item && (item.photoURI || item.photoUri))
      });
    });
    return out;
  }

  function instagramEmbed(raw) {
    var href = httpsUrl(raw);
    if (!href) return null;
    var url;
    try { url = new URL(href); } catch (error) { return null; }
    if (!hostIs(url, ["instagram.com", "www.instagram.com"])) return null;
    var parts = url.pathname.split("/").filter(Boolean);
    var kind = parts[0];
    var code = parts[1] || "";
    var clean = "https://www.instagram.com" + url.pathname.replace(/\/+$/, "");
    if ((kind === "p" || kind === "reel" || kind === "tv") && /^[A-Za-z0-9_-]{5,80}$/.test(code)) {
      var stem = kind === "tv" ? "p" : kind;
      return {
        provider: "Instagram",
        href: clean,
        embedUrl: "https://www.instagram.com/" + stem + "/" + code + "/embed",
        notice: "This post is hosted by Instagram. Starting it loads Instagram in this page. NearBase does not copy or store the images."
      };
    }
    if (parts.length === 1 && /^[A-Za-z0-9._]{1,64}$/.test(parts[0]) && parts[0] !== "p" && parts[0] !== "reel") {
      return {
        provider: "Instagram",
        href: clean,
        embedUrl: "",
        notice: "This opens the school’s Instagram profile. A post or reel permalink can be embedded. NearBase does not copy the images."
      };
    }
    return null;
  }

  function facebookEmbed(raw) {
    var href = httpsUrl(raw);
    if (!href) return null;
    var url;
    try { url = new URL(href); } catch (error) { return null; }
    if (!hostIs(url, ["facebook.com", "www.facebook.com", "m.facebook.com"])) return null;
    var canonical = new URL("https://www.facebook.com" + url.pathname + url.search);
    var isPost = /\/(posts|photos|videos)\//.test(canonical.pathname) || /\/(permalink|story)\.php/.test(canonical.pathname);
    var embed = new URL(isPost ? "https://www.facebook.com/plugins/post.php" : "https://www.facebook.com/plugins/page.php");
    embed.searchParams.set("href", canonical.href);
    embed.searchParams.set("width", "500");
    embed.searchParams.set("height", "560");
    if (!isPost) {
      embed.searchParams.set("tabs", "timeline");
      embed.searchParams.set("small_header", "true");
      embed.searchParams.set("adapt_container_width", "true");
      embed.searchParams.set("hide_cover", "true");
      embed.searchParams.set("show_facepile", "false");
    } else {
      embed.searchParams.set("show_text", "true");
    }
    return {
      provider: "Facebook",
      href: canonical.href,
      embedUrl: embed.href,
      notice: "Public posts are hosted by Facebook. Starting this loads Facebook’s plugin. NearBase does not copy or store the images."
    };
  }

  function socialLinks(school) {
    school = school || {};
    return [instagramEmbed(school.instagramUrl || school.instagram_url), facebookEmbed(school.facebookUrl || school.facebook_url)].filter(Boolean);
  }

  function attributionLine(attributions) {
    var people = authorAttributions(attributions);
    if (!people.length) return "Photos from Google";
    return "Photos from Google. " + people.map(function (person) {
      return person.displayName;
    }).join(", ");
  }

  function el(tag, className, textValue) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (textValue) node.textContent = textValue;
    return node;
  }

  function appendAttributions(parent, attributions) {
    var people = authorAttributions(attributions);
    var line = el("p", "attribution");
    line.appendChild(document.createTextNode("Photos from Google"));
    if (!people.length) {
      parent.appendChild(line);
      return;
    }
    line.appendChild(document.createTextNode(". Photo by "));
    people.forEach(function (person, index) {
      if (index) line.appendChild(document.createTextNode(", "));
      if (person.uri) {
        var link = el("a");
        link.href = person.uri;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = person.displayName;
        line.appendChild(link);
      } else {
        line.appendChild(document.createTextNode(person.displayName));
      }
    });
    parent.appendChild(line);
  }

  function photoFigure(photo, name, eager) {
    var figure = el("figure", "shot google-shot");
    var image = el("img");
    image.alt = name ? "Google photo of " + name : "Google photo";
    image.referrerPolicy = "strict-origin-when-cross-origin";
    if (eager && photo && typeof photo.getURI === "function") image.src = photo.getURI({ maxHeight: 800 });
    figure.appendChild(image);
    appendAttributions(figure, photo && photo.authorAttributions);
    if (photo && httpsUrl(photo.googleMapsURI)) {
      var maps = el("a", "text-link", "View this photo on Google Maps");
      maps.href = httpsUrl(photo.googleMapsURI);
      maps.target = "_blank";
      maps.rel = "noopener noreferrer";
      figure.appendChild(maps);
    }
    return { figure: figure, image: image };
  }

  function renderStreet(container, key, school) {
    if (!container) return;
    var src = streetViewEmbedUrl(key, school.lat, school.lng);
    if (!src) {
      container.hidden = true;
      container.textContent = "";
      return;
    }
    container.hidden = false;
    container.textContent = "";
    container.appendChild(el("h2", "", "Street View"));
    container.appendChild(el("p", "", "Street View is a Google Maps embed. Starting it loads Google in this page. NearBase does not copy the imagery."));
    var button = el("button", "btn", "Show Street View");
    button.type = "button";
    button.addEventListener("click", function () {
      if (container.querySelector("iframe")) return;
      var frame = el("iframe", "tour-frame");
      frame.src = src;
      frame.title = "Google Street View";
      frame.loading = "lazy";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.setAttribute("allowfullscreen", "");
      frame.style.minHeight = "280px";
      container.appendChild(frame);
      button.disabled = true;
    });
    container.appendChild(button);
  }

  function renderSocial(container, school) {
    if (!container) return;
    var links = socialLinks(school);
    container.textContent = "";
    if (!links.length) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    links.forEach(function (link) {
      var block = el("div", "tour-slot");
      block.appendChild(el("h3", "", link.provider));
      block.appendChild(el("p", "", link.notice));
      var direct = el("a", "text-link", "Open on " + link.provider);
      direct.href = link.href;
      direct.target = "_blank";
      direct.rel = "noopener noreferrer";
      block.appendChild(direct);
      if (link.embedUrl) {
        var button = el("button", "btn", "Show " + link.provider + " posts");
        button.type = "button";
        button.addEventListener("click", function () {
          if (block.querySelector("iframe")) return;
          var checked = link.provider === "Instagram" ? instagramEmbed(link.href) : facebookEmbed(link.href);
          if (!checked || !checked.embedUrl) return;
          var frame = el("iframe", "tour-frame");
          frame.src = checked.embedUrl;
          frame.title = link.provider + " embed";
          frame.loading = "lazy";
          frame.referrerPolicy = "strict-origin-when-cross-origin";
          frame.style.minHeight = "280px";
          block.appendChild(frame);
          button.disabled = true;
        });
        block.appendChild(button);
      }
      container.appendChild(block);
    });
  }

  function loadPlaces(key) {
    if (window.google && window.google.maps && window.google.maps.importLibrary) {
      return window.google.maps.importLibrary("places");
    }
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.async = true;
      script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) + "&libraries=places&v=weekly&loading=async";
      script.onload = function () {
        if (!window.google || !window.google.maps || !window.google.maps.importLibrary) {
          reject(new Error("places"));
          return;
        }
        resolve(window.google.maps.importLibrary("places"));
      };
      script.onerror = function () { reject(new Error("maps")); };
      document.head.appendChild(script);
    });
  }

  function renderPhotos(container, key, id, name) {
    if (!container) return;
    container.hidden = false;
    container.textContent = "";
    container.appendChild(el("h2", "", "Photos from Google"));
    container.appendChild(el("p", "fine", "Shown from Google for this visit. NearBase does not download, store, or change these photos."));
    loadPlaces(key).then(function (places) {
      var place = new places.Place({ id: id });
      return place.fetchFields({ fields: ["photos"] }).then(function (result) {
        return result && result.place && result.place.photos ? result.place : place;
      });
    }).then(function (place) {
      var photos = place && place.photos ? Array.prototype.slice.call(place.photos) : [];
      if (!photos.length) {
        container.hidden = true;
        container.textContent = "";
        return;
      }
      var hero = photoFigure(photos[0], name, true);
      container.appendChild(hero.figure);
      if (photos.length < 2) return;
      var button = el("button", "btn ghost", "Show the rest of the Google photos");
      button.type = "button";
      button.addEventListener("click", function () {
        photos.slice(1).forEach(function (photo) {
          var item = photoFigure(photo, name, true);
          container.appendChild(item.figure);
        });
        button.remove();
      });
      container.appendChild(button);
    }).catch(function () {
      container.hidden = true;
      container.textContent = "";
    });
  }

  function mountProfile(options) {
    options = options || {};
    var school = options.school || {};
    var key = browserKey();
    renderSocial(options.socialEl, school);
    if (!key) {
      if (options.photosEl) {
        options.photosEl.hidden = true;
        options.photosEl.textContent = "";
      }
      if (options.streetEl) {
        options.streetEl.hidden = true;
        options.streetEl.textContent = "";
      }
      return;
    }
    renderStreet(options.streetEl, key, school);
    var id = placeId(school.googlePlaceId || school.google_place_id);
    if (id) renderPhotos(options.photosEl, key, id, school.name || "");
    else if (options.photosEl) {
      options.photosEl.hidden = true;
      options.photosEl.textContent = "";
    }
  }

  return {
    browserKey: browserKey,
    placeId: placeId,
    streetViewEmbedUrl: streetViewEmbedUrl,
    authorAttributions: authorAttributions,
    attributionLine: attributionLine,
    instagramEmbed: instagramEmbed,
    facebookEmbed: facebookEmbed,
    socialLinks: socialLinks,
    mountProfile: mountProfile
  };
});
