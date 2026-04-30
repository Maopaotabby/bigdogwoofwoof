(function attachJJKSchemaHelpers(global) {
  "use strict";

  var namespace = "JJKSchemaHelpers";
  var version = "0.1.0-candidate";
  var expectedExports = Object.freeze([
    "isPlainObject",
    "clonePlain",
    "requireFields",
    "validateSchemaEnvelope",
    "assertSchemaEnvelope",
    "pickKnownKeys"
  ]);

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function clonePlain(value) {
    if (Array.isArray(value)) return value.map(clonePlain);
    if (!isPlainObject(value)) return value;
    return Object.keys(value).reduce(function copy(result, key) {
      var item = value[key];
      if (typeof item !== "function") result[key] = clonePlain(item);
      return result;
    }, {});
  }

  function requireFields(value, fields) {
    var target = value || {};
    var required = Array.isArray(fields) ? fields : [];
    var missing = required.filter(function isMissing(field) {
      return !hasOwn(target, field);
    });

    return {
      ok: missing.length === 0,
      missing: missing,
      checked: required.slice()
    };
  }

  function validateSchemaEnvelope(value, options) {
    var config = options || {};
    var required = requireFields(value, config.required || ["schema", "version"]);
    var schemaOk = !config.schema || value?.schema === config.schema;
    var versionOk = !hasOwn(config, "version") || value?.version === config.version;
    var statusOk = !config.status || value?.status === config.status;

    return {
      ok: isPlainObject(value) && required.ok && schemaOk && versionOk && statusOk,
      isObject: isPlainObject(value),
      missing: required.missing,
      schemaOk: schemaOk,
      versionOk: versionOk,
      statusOk: statusOk,
      checked: required.checked
    };
  }

  function assertSchemaEnvelope(value, options) {
    var result = validateSchemaEnvelope(value, options);

    if (!result.ok) {
      throw new Error(namespace + ": schema envelope validation failed");
    }
    return true;
  }

  function pickKnownKeys(value, keys) {
    var target = value || {};
    return (Array.isArray(keys) ? keys : []).reduce(function pick(result, key) {
      if (hasOwn(target, key)) result[key] = clonePlain(target[key]);
      return result;
    }, {});
  }

  function getExpectedExports() {
    return expectedExports.slice();
  }

  function registerWithParent() {
    try {
      if (global.JJKTool && typeof global.JJKTool.registerSubmodule === "function") {
        global.JJKTool.registerSubmodule("schema", api);
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
      layer: "tool-schema-helpers",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "pure-helper",
      ownsBehavior: false,
      domBehavior: "none",
      status: "CANDIDATE"
    }),
    expectedExports: expectedExports,
    getExpectedExports: getExpectedExports,
    isPlainObject: isPlainObject,
    clonePlain: clonePlain,
    requireFields: requireFields,
    validateSchemaEnvelope: validateSchemaEnvelope,
    assertSchemaEnvelope: assertSchemaEnvelope,
    pickKnownKeys: pickKnownKeys
  };

  global[namespace] = api;
  registerWithParent();
})(globalThis);
