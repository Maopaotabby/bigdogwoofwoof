(function attachDuelEndCondition(global) {
  "use strict";

  var namespace = "JJKDuelEndCondition";
  var version = "1.387H-combat-end-condition-hotfix";
  var fallbackRules = {
    version: "0.1.0",
    status: "CANDIDATE",
    primaryEndConditions: ["hp_depleted", "mutual_collapse", "special_rule"],
    safety: {
      normalSafetyRoundCap: 80,
      debugSafetyRoundCap: 120,
      endReason: "safety_cap_reached"
    },
    legacy: {
      maxRoundsWinRateResolution: false
    }
  };
  var expectedExports = [
    "getDuelEndRules",
    "checkDuelHpEndCondition",
    "checkDuelSpecialEndCondition",
    "checkDuelSafetyCap",
    "resolveDuelBattleEnd",
    "getDuelEndReasonLabel",
    "buildDuelFinalSnapshot"
  ];
  var bindings = Object.create(null);

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function assertExpected(name) {
    if (!expectedExports.includes(name)) {
      throw new Error(namespace + " cannot bind unexpected export: " + name);
    }
  }

  function bind(name, value) {
    assertExpected(name);
    if (typeof value !== "function") {
      throw new Error(namespace + "." + name + " must be a function.");
    }
    bindings[name] = value;
  }

  function register(map) {
    Object.keys(map || {}).forEach(function bindExport(name) {
      bind(name, map[name]);
    });
  }

  function hasBinding(name) {
    if (name === undefined) {
      return expectedExports.every(function hasExport(exportName) {
        return hasOwn(bindings, exportName);
      });
    }
    return hasOwn(bindings, name);
  }

  function get(name) {
    assertExpected(name);
    if (hasOwn(bindings, name)) return bindings[name];
    if (typeof api?.[name] === "function") return api[name];
    throw new Error(namespace + "." + name + " is not bound.");
  }

  function getBinding(name) {
    return get(name);
  }

  function listBindings() {
    return expectedExports.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = hasBinding(name);
      return snapshot;
    }, {});
  }

  function clearBindings() {
    expectedExports.forEach(function clearName(name) {
      delete bindings[name];
    });
  }

  function getDuelEndRules(candidateRules) {
    var source = candidateRules && typeof candidateRules === "object" ? candidateRules : {};
    var safety = source.safety || {};
    var legacy = source.legacy || {};
    return {
      version: source.version || fallbackRules.version,
      status: source.status || "CANDIDATE",
      primaryEndConditions: Array.isArray(source.primaryEndConditions)
        ? source.primaryEndConditions.slice()
        : fallbackRules.primaryEndConditions.slice(),
      safety: {
        normalSafetyRoundCap: positiveInteger(safety.normalSafetyRoundCap, fallbackRules.safety.normalSafetyRoundCap),
        debugSafetyRoundCap: positiveInteger(safety.debugSafetyRoundCap, fallbackRules.safety.debugSafetyRoundCap),
        endReason: String(safety.endReason || fallbackRules.safety.endReason)
      },
      legacy: {
        maxRoundsWinRateResolution: legacy.maxRoundsWinRateResolution === true
          ? true
          : false,
        maxRoundsUse: Array.isArray(legacy.maxRoundsUse)
          ? legacy.maxRoundsUse.slice()
          : ["legacy_mode", "ai_narrative_reference", "ui_estimated_battle_length", "debug_display"]
      },
      notes: String(source.notes || "")
    };
  }

  function positiveInteger(value, fallback) {
    var number = Math.round(Number(value));
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function numberOrZero(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function getBattlefieldUnitHp(unit) {
    return Math.max(0, numberOrZero(unit?.hp ?? unit?.currentHp ?? unit?.unitStats?.currentHp ?? unit?.unitStats?.maxHp));
  }

  function isMahoragaProxyProtectingSide(battle, side) {
    var proxy = battle?.mahoragaProxy?.[side];
    if (!proxy?.active || !proxy.unitId) return false;
    return (Array.isArray(battle?.battlefieldUnits) ? battle.battlefieldUnits : []).some(function findActiveProxyUnit(unit) {
      return unit?.id === proxy.unitId && unit.active !== false && unit.defeated !== true && getBattlefieldUnitHp(unit) > 0;
    });
  }

  function getSafetyCap(rules, options) {
    var normalized = getDuelEndRules(rules);
    return options?.debugMode
      ? normalized.safety.debugSafetyRoundCap
      : normalized.safety.normalSafetyRoundCap;
  }

  function checkDuelHpEndCondition(battle, options) {
    var p1 = battle?.resourceState?.p1;
    var p2 = battle?.resourceState?.p2;
    if (!p1 || !p2) return null;
    var survivalFloor = positiveInteger(options?.survivalFloor, 0);
    if (survivalFloor > 0 && numberOrZero(battle?.round) < survivalFloor) {
      return null;
    }
    var leftDown = numberOrZero(p1.hp) <= 0 && !isMahoragaProxyProtectingSide(battle, "left");
    var rightDown = numberOrZero(p2.hp) <= 0 && !isMahoragaProxyProtectingSide(battle, "right");
    if (leftDown && rightDown) {
      return {
        ended: true,
        winnerSide: "draw",
        loserSide: "both",
        endReason: "mutual_collapse",
        endReasonLabel: getDuelEndReasonLabel("mutual_collapse"),
        detail: "双方体势同时归零，战斗以共同崩溃收束。"
      };
    }
    if (leftDown) {
      return {
        ended: true,
        winnerSide: "right",
        loserSide: "left",
        endReason: "hp_depleted",
        endReasonLabel: getDuelEndReasonLabel("hp_depleted"),
        detail: "左侧体势归零，无法继续战斗。"
      };
    }
    if (rightDown) {
      return {
        ended: true,
        winnerSide: "left",
        loserSide: "right",
        endReason: "hp_depleted",
        endReasonLabel: getDuelEndReasonLabel("hp_depleted"),
        detail: "右侧体势归零，无法继续战斗。"
      };
    }
    return null;
  }

  function checkDuelSpecialEndCondition(battle) {
    var explicit = battle?.specialEndCondition || battle?.pendingSpecialEndCondition || null;
    if (!explicit || explicit.ended !== true) return null;
    return {
      ended: true,
      winnerSide: explicit.winnerSide || "draw",
      loserSide: explicit.loserSide || "",
      endReason: explicit.endReason || "special_rule",
      endReasonLabel: getDuelEndReasonLabel(explicit.endReason || "special_rule"),
      detail: explicit.detail || "特殊规则明确收束战斗。"
    };
  }

  function checkDuelSafetyCap(battle, rules, options) {
    var cap = getSafetyCap(rules, options);
    if (!battle || numberOrZero(battle.round) < cap) return null;
    return {
      ended: true,
      winnerSide: "draw",
      loserSide: "",
      endReason: getDuelEndRules(rules).safety.endReason || "safety_cap_reached",
      endReasonLabel: getDuelEndReasonLabel("safety_cap_reached"),
      safetyRoundCap: cap,
      detail: "战斗达到技术安全上限，未自然结束；系统判定为长期僵持。"
    };
  }

  function resolveDuelBattleEnd(battle, rules, options) {
    return checkDuelHpEndCondition(battle, options) ||
      checkDuelSpecialEndCondition(battle, options) ||
      checkDuelSafetyCap(battle, rules, options) ||
      { ended: false, endReason: "ongoing", endReasonLabel: getDuelEndReasonLabel("ongoing") };
  }

  function getDuelEndReasonLabel(reason) {
    switch (reason) {
      case "hp_depleted":
        return "体势崩溃";
      case "mutual_collapse":
        return "双方体势崩溃";
      case "safety_cap_reached":
        return "技术安全上限";
      case "technical_stalemate":
        return "长期僵持";
      case "trial_verdict_execution":
        return "审判判决执行";
      case "domain_meltdown_collapse":
        return "领域熔断崩溃";
      case "jackpot_overwhelming_sustain":
        return "jackpot 持续压制";
      case "manual_forfeit":
        return "手动认输";
      case "special_rule":
        return "特殊规则";
      case "ongoing":
        return "进行中";
      default:
        return reason ? String(reason) : "未记录";
    }
  }

  function buildDuelFinalSnapshot(battle) {
    return {
      battleEnded: Boolean(battle?.resolved || battle?.battleEnded),
      winner: normalizeWinner(battle?.winnerSide),
      endReason: battle?.endReason || battle?.resolutionReason || (battle?.resolved ? "special_rule" : "ongoing"),
      endingRound: numberOrZero(battle?.endingRound || battle?.round),
      leftHp: numberOrZero(battle?.resourceState?.p1?.hp),
      rightHp: numberOrZero(battle?.resourceState?.p2?.hp),
      leftCe: numberOrZero(battle?.resourceState?.p1?.ce),
      rightCe: numberOrZero(battle?.resourceState?.p2?.ce),
      finalResourceSnapshot: {
        left: summarizeResource(battle?.resourceState?.p1),
        right: summarizeResource(battle?.resourceState?.p2)
      },
      finalHandState: {
        actionRound: numberOrZero(battle?.actionRound),
        selectedHandActions: {
          left: summarizeSelected(battle?.selectedHandActions?.left),
          right: summarizeSelected(battle?.selectedHandActions?.right)
        },
        candidateCount: Array.isArray(battle?.actionChoices) ? battle.actionChoices.length : 0
      },
      finalDomainState: {
        subPhaseType: battle?.domainSubPhase?.type || "",
        subPhaseStatus: battle?.domainSubPhase?.status || battle?.domainSubPhase?.trialStatus || "",
        leftDomain: summarizeDomain(battle?.resourceState?.p1?.domain),
        rightDomain: summarizeDomain(battle?.resourceState?.p2?.domain)
      }
    };
  }

  function normalizeWinner(side) {
    if (side === "left" || side === "right" || side === "draw") return side;
    return side ? String(side) : "none";
  }

  function summarizeResource(resource) {
    if (!resource) return null;
    return {
      side: resource.side || "",
      name: resource.name || "",
      hp: numberOrZero(resource.hp),
      maxHp: numberOrZero(resource.maxHp),
      ce: numberOrZero(resource.ce),
      maxCe: numberOrZero(resource.maxCe),
      stability: numberOrZero(resource.stability),
      domain: summarizeDomain(resource.domain)
    };
  }

  function summarizeDomain(domain) {
    if (!domain) return null;
    return {
      active: Boolean(domain.active),
      load: numberOrZero(domain.load),
      threshold: numberOrZero(domain.threshold),
      meltdown: Boolean(domain.meltdown)
    };
  }

  function summarizeSelected(entries) {
    return (entries || []).map(function mapEntry(entry, index) {
      return {
        order: index + 1,
        actionId: entry?.actionId || entry?.id || entry?.action?.id || "",
        label: entry?.label || entry?.action?.label || entry?.id || "",
        apCost: numberOrZero(entry?.apCost),
        ceCost: numberOrZero(entry?.ceCost)
      };
    });
  }

  var api = {
    namespace: namespace,
    version: version,
    metadata: {
      version: version,
      behavior: "end-condition-audit",
      scriptType: "classic",
      ownsBehavior: false
    },
    expectedExports: expectedExports.slice(),
    getExpectedExports: function getExpectedExports() { return expectedExports.slice(); },
    register: register,
    bind: bind,
    hasBinding: hasBinding,
    get: get,
    getBinding: getBinding,
    listBindings: listBindings,
    clearBindings: clearBindings,
    getDuelEndRules: getDuelEndRules,
    checkDuelHpEndCondition: checkDuelHpEndCondition,
    checkDuelSpecialEndCondition: checkDuelSpecialEndCondition,
    checkDuelSafetyCap: checkDuelSafetyCap,
    resolveDuelBattleEnd: resolveDuelBattleEnd,
    getDuelEndReasonLabel: getDuelEndReasonLabel,
    buildDuelFinalSnapshot: buildDuelFinalSnapshot
  };

  global[namespace] = api;
})(globalThis);
