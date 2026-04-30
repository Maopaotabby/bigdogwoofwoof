(function attachJJKAiWorkerClient(global) {
  "use strict";

  var namespace = "JJKAiWorkerClient";
  var version = "0.1.0-candidate";
  var expectedExports = Object.freeze([
    "normalizeEndpoint",
    "buildEndpointCandidates",
    "requestJson",
    "postJson",
    "getJson",
    "requestWithFallback",
    "shouldTryNextEndpoint"
  ]);
  var expectedDependencies = Object.freeze(["fetch", "setTimeout", "clearTimeout"]);
  var dependencies = Object.create(null);

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function getDependency(name) {
    if (hasOwn(dependencies, name)) return dependencies[name];
    return global[name];
  }

  function normalizeEndpoint(value) {
    var trimmed = String(value || "").trim().replace(/\/+$/, "");

    if (!trimmed) return "";
    try {
      var url = new URL(trimmed);
      if (url.protocol !== "https:" && url.protocol !== "http:") return "";
      return url.toString().replace(/\/+$/, "");
    } catch (error) {
      return "";
    }
  }

  function normalizeRoute(route) {
    var text = String(route || "").trim();
    if (!text) return "";
    return text.charAt(0) === "/" ? text : "/" + text;
  }

  function buildEndpointCandidates(options) {
    var config = options || {};
    var mode = ["auto", "global", "cn"].indexOf(config.mode) !== -1 ? config.mode : "auto";
    var candidates = {
      global: [{ id: "global", label: config.globalLabel || "global", endpoint: normalizeEndpoint(config.globalEndpoint) }],
      cn: [{ id: "cn", label: config.cnLabel || "cn", endpoint: normalizeEndpoint(config.cnEndpoint) }]
    };
    var ordered = mode === "global" ? candidates.global : mode === "cn" ? candidates.cn : candidates.global.concat(candidates.cn);
    var seen = Object.create(null);

    return ordered.filter(function unique(item) {
      if (!item.endpoint || seen[item.endpoint]) return false;
      seen[item.endpoint] = true;
      return true;
    });
  }

  function createAbortController(timeoutMs) {
    var Controller = global.AbortController;
    var setTimer = getDependency("setTimeout");
    var clearTimer = getDependency("clearTimeout");
    var controller = typeof Controller === "function" ? new Controller() : null;
    var timeoutId = null;

    if (controller && Number(timeoutMs) > 0 && typeof setTimer === "function") {
      timeoutId = setTimer(function abortRequest() {
        controller.abort();
      }, Number(timeoutMs));
    }
    return {
      signal: controller?.signal,
      clear: function clear() {
        if (timeoutId && typeof clearTimer === "function") clearTimer(timeoutId);
      }
    };
  }

  async function requestJson(endpoint, route, options) {
    var config = options || {};
    var fetchImpl = config.fetch || getDependency("fetch");
    var base = normalizeEndpoint(endpoint);
    var abort;
    var response;
    var data;

    if (!base) throw new Error(namespace + ": valid endpoint is required");
    if (typeof fetchImpl !== "function") throw new Error(namespace + ": fetch is unavailable");

    abort = createAbortController(config.timeoutMs || 0);
    try {
      response = await fetchImpl(base + normalizeRoute(route), {
        method: config.method || "GET",
        headers: config.headers || undefined,
        body: hasOwn(config, "body") ? config.body : undefined,
        cache: config.cache,
        signal: abort.signal
      });
    } catch (error) {
      if (error?.name === "AbortError") error.timeout = true;
      throw error;
    } finally {
      abort.clear();
    }

    data = await response.json().catch(function fallbackJson() {
      return {};
    });
    if (!response.ok) {
      var requestError = new Error(data.error || "HTTP " + response.status);
      requestError.status = response.status;
      requestError.data = data;
      throw requestError;
    }
    return data;
  }

  function postJson(endpoint, route, payload, options) {
    var headers = Object.assign({ "content-type": "application/json" }, (options && options.headers) || {});
    return requestJson(endpoint, route, Object.assign({}, options || {}, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload || {})
    }));
  }

  function getJson(endpoint, route, options) {
    return requestJson(endpoint, route, Object.assign({}, options || {}, {
      method: "GET"
    }));
  }

  function shouldTryNextEndpoint(error) {
    if (!error?.status) return true;
    return [401, 403, 408, 429].indexOf(error.status) !== -1 || Number(error.status) >= 500;
  }

  async function requestWithFallback(candidates, requestFactory, options) {
    var list = Array.isArray(candidates) ? candidates : [];
    var failures = [];
    var config = options || {};

    if (typeof requestFactory !== "function") {
      throw new Error(namespace + ": requestFactory must be a function");
    }
    for (var index = 0; index < list.length; index += 1) {
      var candidate = list[index];
      try {
        return {
          data: await requestFactory(candidate, index),
          candidate: candidate,
          failures: failures.slice()
        };
      } catch (error) {
        failures.push({
          candidate: candidate,
          message: error?.message || String(error || "request failed"),
          status: error?.status || null
        });
        if (config.stopOnNonRetryable !== false && !shouldTryNextEndpoint(error)) break;
      }
    }
    var fallbackError = new Error(failures.map(function mapFailure(item) {
      return (item.candidate?.label || item.candidate?.id || "endpoint") + ": " + item.message;
    }).join("; ") || "AI worker request failed");
    fallbackError.failures = failures;
    throw fallbackError;
  }

  function registerDependencies(map) {
    Object.keys(map || {}).forEach(function registerDependency(name) {
      if (expectedDependencies.indexOf(name) === -1) {
        throw new Error(namespace + ": unexpected dependency '" + name + "'");
      }
      dependencies[name] = map[name];
    });
    return api;
  }

  function clearDependencies() {
    expectedDependencies.forEach(function clearDependency(name) {
      delete dependencies[name];
    });
    return api;
  }

  function listDependencies() {
    return expectedDependencies.reduce(function build(result, name) {
      result[name] = hasOwn(dependencies, name);
      return result;
    }, {});
  }

  function getExpectedExports() {
    return expectedExports.slice();
  }

  function registerWithParent() {
    try {
      if (global.JJKApi && typeof global.JJKApi.registerSubmodule === "function") {
        global.JJKApi.registerSubmodule("aiWorker", api);
        return true;
      }
    } catch (error) {
      return false;
    }
    return false;
  }

  var api = {
    namespace: namespace,
    version: version,
    metadata: Object.freeze({
      namespace: namespace,
      version: version,
      layer: "api-ai-worker-client",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "worker-request-wrapper",
      ownsBehavior: false,
      mutatesCombat: false,
      decidesWinner: false,
      domBehavior: "none",
      status: "CANDIDATE"
    }),
    expectedExports: expectedExports,
    getExpectedExports: getExpectedExports,
    expectedDependencies: expectedDependencies,
    registerDependencies: registerDependencies,
    configure: registerDependencies,
    clearDependencies: clearDependencies,
    listDependencies: listDependencies,
    normalizeEndpoint: normalizeEndpoint,
    buildEndpointCandidates: buildEndpointCandidates,
    requestJson: requestJson,
    postJson: postJson,
    getJson: getJson,
    requestWithFallback: requestWithFallback,
    shouldTryNextEndpoint: shouldTryNextEndpoint
  };

  global[namespace] = api;
  registerWithParent();
})(globalThis);
