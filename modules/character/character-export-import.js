(function attachJJKCharacterExportImport(global) {
  "use strict";

  var namespace = "JJKCharacter";
  var moduleId = "character-export-import";
  var version = "0.1.0-helper-candidate";
  var defaultPrefix = "JJKCP1";
  var defaultKey = "site-1.386-combat-import-code-candidate";
  var defaultSchema = "jjk-combat-power-code";
  var defaultVersion = 1;
  var base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var base64Lookup = buildBase64Lookup();
  var metadata = Object.freeze({
    namespace: namespace,
    moduleId: moduleId,
    version: version,
    layer: "character-export-import",
    moduleFormat: "classic-script-iife",
    scriptType: "classic",
    behavior: "pure-helper",
    codecPrefix: defaultPrefix,
    touchesDom: false,
    touchesState: false,
    touchesStorage: false,
    status: "CANDIDATE"
  });

  function buildBase64Lookup() {
    var lookup = Object.create(null);
    for (var index = 0; index < base64Alphabet.length; index += 1) {
      lookup[base64Alphabet.charAt(index)] = index;
    }
    return lookup;
  }

  function normalizeCodecOptions(options) {
    return {
      prefix: String(options && options.prefix || defaultPrefix),
      key: String(options && options.key || defaultKey),
      schema: String(options && options.schema || defaultSchema),
      version: Number(options && options.version || defaultVersion),
      validateSchema: !(options && options.validateSchema === false)
    };
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function hashCombatPowerEnvelope(value) {
    var hash = 2166136261;
    var text = String(value || "duel-seed");
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function utf8Encode(value) {
    var text = String(value || "");
    var bytes = [];
    for (var index = 0; index < text.length; index += 1) {
      var codePoint = text.codePointAt(index);
      if (codePoint > 0xffff) index += 1;
      if (codePoint <= 0x7f) {
        bytes.push(codePoint);
      } else if (codePoint <= 0x7ff) {
        bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
      } else if (codePoint <= 0xffff) {
        bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
      } else {
        bytes.push(
          0xf0 | (codePoint >> 18),
          0x80 | ((codePoint >> 12) & 0x3f),
          0x80 | ((codePoint >> 6) & 0x3f),
          0x80 | (codePoint & 0x3f)
        );
      }
    }
    return new Uint8Array(bytes);
  }

  function utf8Decode(bytes) {
    var output = "";
    for (var index = 0; index < bytes.length;) {
      var first = bytes[index++];
      var codePoint;
      if (first < 0x80) {
        codePoint = first;
      } else if ((first & 0xe0) === 0xc0) {
        codePoint = ((first & 0x1f) << 6) | (bytes[index++] & 0x3f);
      } else if ((first & 0xf0) === 0xe0) {
        codePoint = ((first & 0x0f) << 12) | ((bytes[index++] & 0x3f) << 6) | (bytes[index++] & 0x3f);
      } else {
        codePoint = ((first & 0x07) << 18) | ((bytes[index++] & 0x3f) << 12) | ((bytes[index++] & 0x3f) << 6) | (bytes[index++] & 0x3f);
      }
      output += String.fromCodePoint(codePoint);
    }
    return output;
  }

  function mixCombatPowerEnvelopeBytes(bytes, options) {
    var opts = normalizeCodecOptions(options);
    var key = utf8Encode(opts.prefix + "|" + opts.key);
    var source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    var mixed = new Uint8Array(source.length);
    for (var index = 0; index < source.length; index += 1) {
      mixed[index] = source[index] ^ key[index % key.length] ^ ((index * 31 + 17) & 255);
    }
    return mixed;
  }

  function base64EncodeBytes(bytes) {
    var source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    var output = "";
    for (var index = 0; index < source.length; index += 3) {
      var first = source[index];
      var second = index + 1 < source.length ? source[index + 1] : 0;
      var third = index + 2 < source.length ? source[index + 2] : 0;
      var triplet = (first << 16) | (second << 8) | third;
      output += base64Alphabet[(triplet >> 18) & 63];
      output += base64Alphabet[(triplet >> 12) & 63];
      output += index + 1 < source.length ? base64Alphabet[(triplet >> 6) & 63] : "=";
      output += index + 2 < source.length ? base64Alphabet[triplet & 63] : "=";
    }
    return output;
  }

  function base64DecodeToBytes(value) {
    var normalized = String(value || "").replace(/\s+/g, "");
    if (normalized.length % 4 === 1) throw new Error("base64 payload length is invalid.");
    while (normalized.length % 4) normalized += "=";
    var bytes = [];
    for (var index = 0; index < normalized.length; index += 4) {
      var chars = normalized.slice(index, index + 4);
      var first = base64Lookup[chars.charAt(0)];
      var second = base64Lookup[chars.charAt(1)];
      var third = chars.charAt(2) === "=" ? 0 : base64Lookup[chars.charAt(2)];
      var fourth = chars.charAt(3) === "=" ? 0 : base64Lookup[chars.charAt(3)];
      if (first == null || second == null || third == null || fourth == null) throw new Error("base64 payload contains invalid characters.");
      var triplet = (first << 18) | (second << 12) | (third << 6) | fourth;
      bytes.push((triplet >> 16) & 255);
      if (chars.charAt(2) !== "=") bytes.push((triplet >> 8) & 255);
      if (chars.charAt(3) !== "=") bytes.push(triplet & 255);
    }
    return new Uint8Array(bytes);
  }

  function base64UrlEncodeBytes(bytes) {
    return base64EncodeBytes(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlDecodeToBytes(value) {
    return base64DecodeToBytes(String(value || "").replace(/-/g, "+").replace(/_/g, "/"));
  }

  function buildCombatPowerEnvelope(payload, options) {
    var opts = normalizeCodecOptions(options);
    var json = JSON.stringify(payload);
    var checksum = hashCombatPowerEnvelope(json).toString(36);
    var bytes = utf8Encode(json);
    var mixed = mixCombatPowerEnvelopeBytes(bytes, opts);
    var body = base64UrlEncodeBytes(mixed);
    return {
      schema: "jjk-combat-power-envelope",
      version: 1,
      prefix: opts.prefix,
      checksum: checksum,
      body: body,
      code: opts.prefix + "." + checksum + "." + body
    };
  }

  function encodeCombatPowerEnvelope(payload, options) {
    return buildCombatPowerEnvelope(payload, options).code;
  }

  function extractCombatPowerCode(value, options) {
    var opts = normalizeCodecOptions(options);
    var pattern = new RegExp(escapeRegExp(opts.prefix) + "\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+");
    var match = String(value || "").match(pattern);
    return match ? match[0] : "";
  }

  function validateCombatPowerEnvelopePayload(payload, options) {
    var opts = normalizeCodecOptions(options);
    var errors = [];
    if (!payload || typeof payload !== "object") errors.push("payload is not an object");
    if (payload && payload.schema !== opts.schema) errors.push("schema must be " + opts.schema);
    if (payload && payload.version !== opts.version) errors.push("version must be " + opts.version);
    return {
      ok: errors.length === 0,
      errors: errors
    };
  }

  function decodeCombatPowerEnvelope(value, options) {
    var opts = normalizeCodecOptions(options);
    var code = extractCombatPowerCode(value, opts);
    if (!code) throw new Error("没有找到 " + opts.prefix + " 战力编码。");
    var parts = code.split(".");
    var checksum = parts[1];
    var body = parts[2];
    var bytes = mixCombatPowerEnvelopeBytes(base64UrlDecodeToBytes(body), opts);
    var json = utf8Decode(bytes);
    if (hashCombatPowerEnvelope(json).toString(36) !== checksum) {
      throw new Error("战力编码校验失败，可能被截断或改写。");
    }
    var payload = JSON.parse(json);
    if (opts.validateSchema) {
      var validation = validateCombatPowerEnvelopePayload(payload, opts);
      if (!validation.ok) throw new Error("战力编码格式不兼容。");
    }
    return payload;
  }

  function getCharacterExportImportMetadata() {
    return metadata;
  }

  var api = {
    getCharacterExportImportMetadata: getCharacterExportImportMetadata,
    hashCombatPowerEnvelope: hashCombatPowerEnvelope,
    mixCombatPowerEnvelopeBytes: mixCombatPowerEnvelopeBytes,
    buildCombatPowerEnvelope: buildCombatPowerEnvelope,
    encodeCombatPowerEnvelope: encodeCombatPowerEnvelope,
    decodeCombatPowerEnvelope: decodeCombatPowerEnvelope,
    validateCombatPowerEnvelopePayload: validateCombatPowerEnvelopePayload,
    extractCombatPowerCode: extractCombatPowerCode,
    base64UrlEncodeBytes: base64UrlEncodeBytes,
    base64UrlDecodeToBytes: base64UrlDecodeToBytes,
    encodeCombatPowerPayload: encodeCombatPowerEnvelope,
    decodeCombatPowerImportCode: decodeCombatPowerEnvelope
  };

  function registerCharacterHelpers(exportsMap) {
    var root = global[namespace] || (global[namespace] = {});
    if (typeof root.registerHelperModule === "function") {
      root.registerHelperModule(moduleId, exportsMap, metadata);
      return;
    }
    root.__pendingHelperModules = root.__pendingHelperModules || [];
    root.__pendingHelperModules.push({ id: moduleId, exports: exportsMap, metadata: metadata });
  }

  registerCharacterHelpers(api);
})(globalThis);
