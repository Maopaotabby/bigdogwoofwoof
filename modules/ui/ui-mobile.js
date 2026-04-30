(function attachJJKUIMobile(global) {
  "use strict";

  var namespace = "JJKUIMobile";
  var version = "0.1.0-ui-helper-candidate";
  var DEFAULT_QUERY = "(max-width: 640px)";
  var DEFAULT_SCROLL_DELTA = 8;
  var DEFAULT_MIN_HIDE_AFTER = 72;
  var DEFAULT_BODY_CLASS = "mobile-topbar-hidden";

  function readScrollY(viewport) {
    var source = viewport || global;
    return Math.max(Number(source.scrollY || source.pageYOffset || 0), 0);
  }

  function matchesViewport(query, viewport) {
    var source = viewport || global;
    var mediaQuery = query || DEFAULT_QUERY;

    if (!source || typeof source.matchMedia !== "function") return false;
    return Boolean(source.matchMedia(mediaQuery).matches);
  }

  function getTopbarHideAfter(topbar, options) {
    var config = options || {};
    var minHideAfter = Number.isFinite(Number(config.minHideAfter)) ? Number(config.minHideAfter) : DEFAULT_MIN_HIDE_AFTER;
    var offset = Number.isFinite(Number(config.offset)) ? Number(config.offset) : 32;
    var height = topbar && Number.isFinite(Number(topbar.offsetHeight)) ? Number(topbar.offsetHeight) : 0;

    return Math.max(minHideAfter, Math.round(height - offset));
  }

  function shouldHideTopbar(input) {
    var config = input || {};
    var isMobile = Boolean(config.isMobile);
    var currentY = Math.max(Number(config.currentY || 0), 0);
    var lastY = Math.max(Number(config.lastY || 0), 0);
    var hideAfter = Number.isFinite(Number(config.hideAfter)) ? Number(config.hideAfter) : DEFAULT_MIN_HIDE_AFTER;
    var scrollDelta = Number.isFinite(Number(config.scrollDelta)) ? Number(config.scrollDelta) : DEFAULT_SCROLL_DELTA;
    var delta = currentY - lastY;

    if (!isMobile || currentY <= hideAfter) return false;
    if (Math.abs(delta) < scrollDelta) return Boolean(config.previousHidden);
    return delta > 0 && currentY > hideAfter;
  }

  function createTopbarClassState(input) {
    var config = input || {};
    var hidden = shouldHideTopbar(config);

    return {
      hidden: hidden,
      className: config.className || DEFAULT_BODY_CLASS,
      lastY: Math.max(Number(config.currentY || 0), 0)
    };
  }

  function applyTopbarClass(target, input) {
    var state = createTopbarClassState(input);

    if (target && target.classList) {
      target.classList.toggle(state.className, state.hidden);
    }
    return state;
  }

  function createResponsiveClassMap(input) {
    var config = input || {};
    var mobile = typeof config.mobile === "boolean" ? config.mobile : matchesViewport(config.query, config.viewport);

    return {
      "is-mobile": mobile,
      "is-desktop": !mobile,
      "mobile-topbar-hidden": Boolean(config.topbarHidden)
    };
  }

  function getExpectedExports() {
    return [
      "readScrollY",
      "matchesViewport",
      "getTopbarHideAfter",
      "shouldHideTopbar",
      "createTopbarClassState",
      "applyTopbarClass",
      "createResponsiveClassMap"
    ];
  }

  function getMetadata() {
    return api.metadata;
  }

  var api = {
    metadata: Object.freeze({
      namespace: namespace,
      version: version,
      layer: "ui-mobile",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "mobile-class-helper",
      ownsBehavior: false,
      installsListeners: false,
      migratesRenderer: false
    }),
    constants: Object.freeze({
      defaultQuery: DEFAULT_QUERY,
      defaultScrollDelta: DEFAULT_SCROLL_DELTA,
      defaultMinHideAfter: DEFAULT_MIN_HIDE_AFTER,
      defaultBodyClass: DEFAULT_BODY_CLASS
    }),
    expectedExports: getExpectedExports(),
    getExpectedExports: getExpectedExports,
    getMetadata: getMetadata,
    readScrollY: readScrollY,
    matchesViewport: matchesViewport,
    getTopbarHideAfter: getTopbarHideAfter,
    shouldHideTopbar: shouldHideTopbar,
    createTopbarClassState: createTopbarClassState,
    applyTopbarClass: applyTopbarClass,
    createResponsiveClassMap: createResponsiveClassMap
  };

  global[namespace] = api;
  if (global.JJKUI && typeof global.JJKUI.registerModule === "function") {
    global.JJKUI.registerModule("mobile", api, {
      namespace: namespace,
      layer: "ui-mobile",
      owner: "Agent-D",
      status: "candidate"
    });
  }
})(globalThis);
