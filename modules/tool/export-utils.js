(function attachJJKExportUtils(global) {
  "use strict";

  var namespace = "JJKExportUtils";
  var version = "0.1.0-candidate";
  var expectedExports = Object.freeze([
    "formatDateForFilename",
    "formatDateTime",
    "formatNumber",
    "formatPercent",
    "markdownInline",
    "markdownTableCell",
    "sanitizeFilenamePart",
    "serializeJson",
    "createTextFileDescriptor",
    "createJsonFileDescriptor",
    "base64UrlEncodeBytes",
    "base64UrlDecodeToBytes"
  ]);

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatDateForFilename(date) {
    var value = date && typeof date.getFullYear === "function" ? date : new Date(date || Date.now());
    return [
      value.getFullYear(),
      pad(value.getMonth() + 1),
      pad(value.getDate()),
      pad(value.getHours()),
      pad(value.getMinutes()),
      pad(value.getSeconds())
    ].join("");
  }

  function formatDateTime(date) {
    var value = date && typeof date.getFullYear === "function" ? date : new Date(date || Date.now());
    return value.getFullYear() + "-" + pad(value.getMonth() + 1) + "-" + pad(value.getDate()) + " " +
      pad(value.getHours()) + ":" + pad(value.getMinutes()) + ":" + pad(value.getSeconds());
  }

  function formatNumber(value) {
    if (!Number.isFinite(Number(value))) return "0";
    return Number(value).toFixed(4).replace(/\.?0+$/, "");
  }

  function formatPercent(value) {
    if (!Number.isFinite(Number(value))) return "0%";
    return String((Number(value) * 100).toFixed(2)).replace(/\.?0+$/, "") + "%";
  }

  function markdownInline(value) {
    return String(value ?? "")
      .replaceAll("\\", "\\\\")
      .replaceAll("`", "\\`")
      .replaceAll("*", "\\*")
      .replaceAll("_", "\\_")
      .replaceAll("[", "\\[")
      .replaceAll("]", "\\]");
  }

  function markdownTableCell(value) {
    return markdownInline(value).replaceAll("|", "\\|").replace(/\r?\n/g, "<br>");
  }

  function sanitizeFilenamePart(value, fallback) {
    var text = String(value || "").trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    return text || fallback || "export";
  }

  function serializeJson(value, options) {
    var spaces = Object.prototype.hasOwnProperty.call(options || {}, "spaces") ? options.spaces : 2;
    return JSON.stringify(value ?? {}, null, spaces);
  }

  function createTextFileDescriptor(text, filename, type) {
    var value = String(text ?? "");
    return {
      filename: sanitizeFilenamePart(filename || "export.txt", "export.txt"),
      type: type || "text/plain;charset=utf-8",
      text: value,
      textLength: value.length
    };
  }

  function createJsonFileDescriptor(value, filename, options) {
    return createTextFileDescriptor(
      serializeJson(value, options),
      filename || "export-" + formatDateForFilename(new Date()) + ".json",
      options?.type || "application/json;charset=utf-8"
    );
  }

  function binaryToBase64(binary) {
    if (typeof global.btoa === "function") return global.btoa(binary);
    if (global.Buffer && typeof global.Buffer.from === "function") {
      return global.Buffer.from(binary, "binary").toString("base64");
    }
    throw new Error(namespace + ": base64 encoder is unavailable");
  }

  function base64ToBinary(value) {
    if (typeof global.atob === "function") return global.atob(value);
    if (global.Buffer && typeof global.Buffer.from === "function") {
      return global.Buffer.from(value, "base64").toString("binary");
    }
    throw new Error(namespace + ": base64 decoder is unavailable");
  }

  function base64UrlEncodeBytes(bytes) {
    var array = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []);
    var binary = "";
    var chunkSize = 0x8000;

    for (var index = 0; index < array.length; index += chunkSize) {
      binary += String.fromCharCode.apply(null, array.slice(index, index + chunkSize));
    }
    return binaryToBase64(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlDecodeToBytes(value) {
    var normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    var padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    var binary = base64ToBinary(padded);

    return Uint8Array.from(binary, function mapChar(char) {
      return char.charCodeAt(0);
    });
  }

  function getExpectedExports() {
    return expectedExports.slice();
  }

  function registerWithParent() {
    try {
      if (global.JJKTool && typeof global.JJKTool.registerSubmodule === "function") {
        global.JJKTool.registerSubmodule("export", api);
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
      layer: "tool-export-utils",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "export-helper",
      ownsBehavior: false,
      domBehavior: "none",
      status: "CANDIDATE"
    }),
    expectedExports: expectedExports,
    getExpectedExports: getExpectedExports,
    formatDateForFilename: formatDateForFilename,
    formatDateTime: formatDateTime,
    formatNumber: formatNumber,
    formatPercent: formatPercent,
    markdownInline: markdownInline,
    markdownTableCell: markdownTableCell,
    sanitizeFilenamePart: sanitizeFilenamePart,
    serializeJson: serializeJson,
    createTextFileDescriptor: createTextFileDescriptor,
    createJsonFileDescriptor: createJsonFileDescriptor,
    base64UrlEncodeBytes: base64UrlEncodeBytes,
    base64UrlDecodeToBytes: base64UrlDecodeToBytes
  };

  global[namespace] = api;
  registerWithParent();
})(globalThis);
