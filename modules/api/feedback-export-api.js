(function attachJJKFeedbackExportApi(global) {
  "use strict";

  var namespace = "JJKFeedbackExportApi";
  var version = "0.1.0-candidate";
  var expectedExports = Object.freeze([
    "serializeFeedbackPackage",
    "getFeedbackFilename",
    "validateFeedbackPackage",
    "buildFeedbackExportDescriptor",
    "sanitizeFilenamePart"
  ]);

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function sanitizeFilenamePart(value, fallback) {
    var text = String(value || "").trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    return text || fallback || "export";
  }

  function serializeFeedbackPackage(packageData, options) {
    var spaces = hasOwn(options || {}, "spaces") ? options.spaces : 2;
    return JSON.stringify(packageData || {}, null, spaces);
  }

  function getFeedbackFilename(packageData, options) {
    var config = options || {};
    var prefix = sanitizeFilenamePart(config.prefix || "jjk-feedback", "jjk-feedback");
    var schema = sanitizeFilenamePart(packageData?.schema || config.schema || "package", "package");
    var versionText = sanitizeFilenamePart(packageData?.version || config.version || "candidate", "candidate");
    var suffix = sanitizeFilenamePart(config.suffix || packageData?.battleId || packageData?.id || "", "");
    var extension = sanitizeFilenamePart(config.extension || "json", "json");
    var parts = [prefix, schema, versionText];

    if (suffix) parts.push(suffix);
    return parts.join("-") + "." + extension.replace(/^\.+/, "");
  }

  function validateFeedbackPackage(packageData, options) {
    var config = options || {};
    var required = Array.isArray(config.required) ? config.required : ["schema", "version", "status"];
    var missing = required.filter(function isMissing(key) {
      return !hasOwn(packageData || {}, key);
    });
    var schemaOk = !config.schema || packageData?.schema === config.schema;
    var statusOk = !config.status || packageData?.status === config.status;

    return {
      ok: missing.length === 0 && schemaOk && statusOk,
      missing: missing,
      schemaOk: schemaOk,
      statusOk: statusOk,
      checked: required.slice()
    };
  }

  function buildFeedbackExportDescriptor(packageData, options) {
    var validation = validateFeedbackPackage(packageData, options);
    var text = serializeFeedbackPackage(packageData, options);

    return {
      ok: validation.ok,
      validation: validation,
      filename: getFeedbackFilename(packageData, options),
      type: options?.type || "application/json;charset=utf-8",
      text: text,
      textLength: text.length
    };
  }

  function getExpectedExports() {
    return expectedExports.slice();
  }

  function registerWithParent() {
    try {
      if (global.JJKApi && typeof global.JJKApi.registerSubmodule === "function") {
        global.JJKApi.registerSubmodule("feedbackExport", api);
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
      layer: "api-feedback-export-helper",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "export-descriptor-helper",
      ownsBehavior: false,
      mutatesCombat: false,
      decidesWinner: false,
      domBehavior: "none",
      status: "CANDIDATE"
    }),
    expectedExports: expectedExports,
    getExpectedExports: getExpectedExports,
    serializeFeedbackPackage: serializeFeedbackPackage,
    getFeedbackFilename: getFeedbackFilename,
    validateFeedbackPackage: validateFeedbackPackage,
    buildFeedbackExportDescriptor: buildFeedbackExportDescriptor,
    sanitizeFilenamePart: sanitizeFilenamePart
  };

  global[namespace] = api;
  registerWithParent();
})(globalThis);
