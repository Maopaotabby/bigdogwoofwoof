(function attachJJKVersionUtils(global) {
  "use strict";

  var namespace = "JJKVersionUtils";
  var version = "0.1.0-candidate";
  var expectedExports = Object.freeze([
    "normalizeBuildVersion",
    "extractBuildVersion",
    "buildCacheBustedUrl",
    "sameBuildVersion",
    "createVersionRecord",
    "assertBuildVersion"
  ]);

  function normalizeBuildVersion(value) {
    return String(value || "").trim();
  }

  function extractBuildVersion(value) {
    var text = String(value || "");
    var queryMatch = text.match(/[?&]v=([^&#]+)/);
    var assignmentMatch = text.match(/APP_BUILD_VERSION\s*=\s*["']([^"']+)["']/);

    if (queryMatch) return decodeURIComponent(queryMatch[1]);
    if (assignmentMatch) return assignmentMatch[1];
    return normalizeBuildVersion(value);
  }

  function buildCacheBustedUrl(path, buildVersion) {
    var base = String(path || "");
    var normalized = normalizeBuildVersion(buildVersion);
    var separator = base.indexOf("?") === -1 ? "?" : "&";

    if (!normalized) return base;
    return base.replace(/([?&])v=[^&#]*/g, "$1v=" + encodeURIComponent(normalized))
      .replace(/[?&]$/, "") + (/[?&]v=/.test(base) ? "" : separator + "v=" + encodeURIComponent(normalized));
  }

  function sameBuildVersion(left, right) {
    return normalizeBuildVersion(left) === normalizeBuildVersion(right);
  }

  function createVersionRecord(buildVersion, options) {
    return {
      schema: "jjk-version-record",
      version: 1,
      buildVersion: normalizeBuildVersion(buildVersion),
      source: String(options?.source || ""),
      status: options?.status || "CANDIDATE",
      recordedAt: options?.recordedAt || new Date().toISOString()
    };
  }

  function assertBuildVersion(actual, expected) {
    if (!sameBuildVersion(actual, expected)) {
      throw new Error(namespace + ": build version mismatch: expected " + expected + ", got " + actual);
    }
    return true;
  }

  function getExpectedExports() {
    return expectedExports.slice();
  }

  function registerWithParent() {
    try {
      if (global.JJKTool && typeof global.JJKTool.registerSubmodule === "function") {
        global.JJKTool.registerSubmodule("version", api);
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
      layer: "tool-version-utils",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "pure-helper",
      ownsBehavior: false,
      domBehavior: "none",
      status: "CANDIDATE"
    }),
    expectedExports: expectedExports,
    getExpectedExports: getExpectedExports,
    normalizeBuildVersion: normalizeBuildVersion,
    extractBuildVersion: extractBuildVersion,
    buildCacheBustedUrl: buildCacheBustedUrl,
    sameBuildVersion: sameBuildVersion,
    createVersionRecord: createVersionRecord,
    assertBuildVersion: assertBuildVersion
  };

  global[namespace] = api;
  registerWithParent();
})(globalThis);
