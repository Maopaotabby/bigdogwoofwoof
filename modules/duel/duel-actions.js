(function attachDuelActions(global) {
  "use strict";

  var namespace = "JJKDuelActions";
  var version = "1.395-defeat-heal-lock";
  var expectedExports = [
    "getDuelActionTemplates",
    "buildDuelActionPool",
    "pickDuelActionChoices",
    "getDuelActionCost",
    "getDuelActionAvailability",
    "applyDuelActionEffect",
    "getDuelCpuAction",
    "buildDuelDomainSpecificActions",
    "invalidateDuelActionChoices"
  ];
  var expectedDependencyNames = [
    "state",
    "getDuelActionRules",
    "getDuelMechanicTemplateRules",
    "getDuelCardTemplateIndex",
    "getDuelBattle",
    "getDuelActionCost",
    "getDuelProfileForSide",
    "getDuelDomainResponseProfile",
    "isDuelOpponentDomainThreat",
    "hasDuelDomainCounterAccess",
    "getDuelStatusEffectValue",
    "hashDuelSeed",
    "clamp",
    "syncDuelTrialSubPhaseLifecycle",
    "updateDuelDomainTrialContext",
    "normalizeDuelDomainSpecificAction",
    "applyDuelDomainSpecificAction",
    "applyDuelTrialAction",
    "applyDuelJackpotAction",
    "getDuelTrialOwnerActionTemplates",
    "getDuelTrialDefenderActionTemplates",
    "getDuelResourcePair",
    "clampDuelResource",
    "appendDuelActionLog",
    "recordDuelResourceChange",
    "getDuelResourceSideLabel",
    "formatSignedDuelDelta",
    "DUEL_DOMAIN_RESPONSE_ACTION_IDS"
  ];
  var dependencySources = {
    getDuelDomainResponseProfile: ["JJKDuelDomainResponse", "getDuelDomainResponseProfile"],
    isDuelOpponentDomainThreat: ["JJKDuelDomainResponse", "isDuelOpponentDomainThreat"],
    hasDuelDomainCounterAccess: ["JJKDuelDomainResponse", "hasDuelDomainCounterAccess"],
    getDuelCardTemplateIndex: ["JJKDuelCardTemplate", "getDuelCardTemplateIndex"],
    getDuelResourcePair: ["JJKDuelResource", "getDuelResourcePair"],
    clampDuelResource: ["JJKDuelResource", "clampDuelResource"],
    syncDuelTrialSubPhaseLifecycle: ["JJKDuelRuleSubphase", "syncDuelTrialSubPhaseLifecycle"],
    updateDuelDomainTrialContext: ["JJKDuelRuleSubphase", "updateDuelDomainTrialContext"],
    applyDuelTrialAction: ["JJKDuelRuleSubphase", "applyDuelTrialAction"],
    applyDuelJackpotAction: ["JJKDuelRuleSubphase", "applyDuelJackpotAction"],
    DUEL_DOMAIN_RESPONSE_ACTION_IDS: ["JJKDuelDomainResponse", "DUEL_DOMAIN_RESPONSE_ACTION_IDS"]
  };
  var domainResponseActionIds = new Set([
    "domain_clash",
    "simple_domain_guard",
    "hollow_wicker_basket_guard",
    "falling_blossom_emotion",
    "zero_ce_domain_bypass",
    "domain_survival_guard"
  ]);
  var domainControlActionIds = new Set([
    "domain_expand",
    "domain_compress",
    "domain_force_sustain",
    "domain_release",
    "domain_clash",
    "simple_domain_guard",
    "hollow_wicker_basket_guard",
    "falling_blossom_emotion",
    "zero_ce_domain_bypass",
    "domain_survival_guard"
  ]);
  var bindings = Object.create(null);
  var dependencies = Object.create(null);
  var actionTemplateIndexCache = null;
  var mechanicTemplateIndexCache = null;
  var performanceCacheStats = {
    actionLastInvalidatedAt: "",
    mechanicLastInvalidatedAt: ""
  };
  var FEATURE_TECHNIQUE_ALIASES = Object.freeze({
    ten_shadows: ["十种影法术", "十种影", "十影", "伏黑惠", "megumi", "嵌合暗翳庭", "魔虚罗", "魔须罗", "mahoraga"],
    limitless: ["无下限术式", "无下限", "五条悟", "五条", "无量空处", "limitless"],
    blood_manipulation: ["赤血操术", "胀相", "加茂宪纪", "虎杖悠仁", "blood"],
    curse_spirit_manipulation: ["咒灵操术", "夏油杰", "夏油", "羂索", "咒灵群"],
    idle_transfiguration: ["无为转变", "真人", "自闭圆顿裹", "灵魂"],
    higuruma_trial_owner: ["诛伏赐死", "日车", "日车宽见", "审判", "裁判", "证据", "罪状", "判决", "没收", "处刑人之剑", "judgeman", "higuruma", "trial"],
    yuji_soul_melee: ["灵魂打击", "虎杖", "虎杖悠仁", "逕庭拳", "径庭拳", "黑闪", "半人半咒", "itadori", "yuji", "soul"],
    recontract_icon: ["再契象", "雷吉", "收据", "契约再现", "实物具现", "服务收据", "reggie", "receipt", "recontract"],
    gojo_limitless: ["无下限术式", "无下限", "五条悟", "五条", "无量空处", "limitless", "gojo"],
    ratio_technique: ["十划咒法", "七海建人", "七海", "七三"],
    cursed_speech: ["咒言", "狗卷棘", "狗卷"],
    boogie_woogie: ["不义游戏", "东堂葵", "东堂"],
    black_bird_manipulation: ["黑鸟操术", "冥冥"],
    projection_sorcery: ["投射咒法", "禅院直哉", "直哉", "直毘人", "时胞月宫殿"],
    construction: ["构筑术式", "万", "真依", "真球", "三重疾苦"],
    puppet_manipulation: ["傀儡操术", "机械丸", "与幸吉", "究极机械丸", "傀儡"],
    tool_manipulation: ["付丧操术", "西宫桃", "扫帚", "咒具操控", "器物牵引"],
    seance_technique: ["降灵术", "参拜婆", "降灵", "肉体降灵", "依代"],
    straw_doll_technique: ["刍灵咒法", "钉崎野蔷薇", "钉崎", "共鸣"],
    star_rage: ["星之怒", "九十九由基", "九十九", "凰轮"],
    ice_formation: ["冰凝咒法", "里梅"],
    immortality_tengen: ["不死", "天元", "星浆体", "同化", "结界"],
    miracles: ["奇迹", "重面春太", "命数", "幸运"],
    disaster_flames: ["漏瑚", "盖棺铁围山", "火山", "熔灾"],
    disaster_plants: ["花御", "朶颐光海", "咒植"],
    disaster_tides: ["陀艮", "荡蕴平线", "潮灾"],
    gakuganji_music: ["乐岩寺", "咒力音波", "电吉他", "音波"],
    solo_forbidden_area: ["单独禁区", "庵歌姬", "神乐", "祝词", "奉纳"],
    solo_solo_forbidden_area: ["单独禁区", "庵歌姬", "神乐", "祝词", "奉纳"],
    heart_catch: ["心身掌握", "拉鲁", "可爱蜜糖", "巨手", "注意牵引"],
    prayer_song: ["祈祷之歌", "米格尔", "黑绳"],
    cockroach_swarm: ["黑沐死", "蟑螂", "腐蠊胎巢", "烂生刀", "虫群"],
    rot_technique: ["蚀烂术式", "坏相", "血涂", "朽血", "翅王"],
    ganesh_obstacle_removal: ["伽尼萨", "伽内什", "障碍移除", "象神", "移障"],
    ganesha_obstacle_removal: ["伽尼萨", "伽内什", "障碍移除", "象神", "移障"],
    body_hopping: ["夺舍", "羂索", "脑核转移", "身体交换", "brain transplant"],
    idle_death_gamble: ["赌运显法", "秤金次", "秤", "坐杀搏徒", "jackpot"],
    comedian: ["超人", "高羽史彦", "高羽"],
    copy: ["模仿", "乙骨忧太", "乙骨", "里香", "真赝相爱"],
    sky_manipulation: ["天空术式", "乌鹭亨子", "乌鹭"],
    granite_blast: ["龙髓炮", "石流龙", "石流", "咒力大炮", "花岗岩"],
    anti_gravity_system: ["反重力机构", "羂索", "虎杖香织", "重力"],
    mythical_beast_amber: ["幻兽琥珀", "鹿紫云一", "鹿紫云"],
    kashimo_mythical_beast: ["幻兽琥珀", "鹿紫云一", "鹿紫云"],
    shrine: ["御厨子", "伏魔御厨子", "两面宿傩", "宿傩", "虎杖悠仁", "解", "捌", "斩击"],
    embodied_killing_intent_light: ["光", "具象化杀意", "达布拉", "达布拉卡拉巴"],
    chaos_and_harmony: ["混沌与调和", "玛鲁", "马鲁", "克罗斯"],
    explosive_body: ["黄栌折", "爆炸肉体", "断齿", "眼球投爆", "hazel"],
    hazel: ["黄栌折", "爆炸肉体", "断齿", "眼球投爆", "hazel"],
    inverse: ["强弱颠倒", "inverse", "粟坂二良", "强攻击变弱", "弱攻击"],
    star_travel: ["星间飞行", "南十字", "星序", "love rendezvous", "标记"],
    spatial_transference: ["忧忧", "空间转移", "箱门", "魂位训练", "传送"],
    ui_ui: ["忧忧", "空间转移", "箱门", "魂位训练", "传送"],
    nitta: ["新田新", "痛苦杀手", "创口暂停", "伤势保留"],
    pain_killer: ["新田新", "痛苦杀手", "创口暂停", "伤势保留"],
    hanyu_jet_hair: ["羽生", "喷气背包头发", "喷翼", "飞行"],
    haba_helicopter_hair: ["羽场", "直升机头发", "旋翼", "飞行"],
    jinichi_fist: ["禅院甚一", "甚一", "巨大咒力拳", "铁拳", "咒像"],
    zenin_jinichi: ["禅院甚一", "甚一", "巨大咒力拳", "铁拳", "咒像"],
    ranta_eye_bind: ["禅院兰太", "兰太", "视线拘束", "睨视", "瞳压"],
    zenin_ranta: ["禅院兰太", "兰太", "视线拘束", "睨视", "瞳压"],
    chojuro_earth_hand: ["禅院长寿郎", "长寿郎", "土掌术式", "岩掌", "地裂"],
    zenin_chojuro_earth_hand: ["禅院长寿郎", "长寿郎", "土掌术式", "岩掌", "地裂"],
    auspicious_beasts: ["来访瑞兽", "猪野琢真", "猪野", "獬豸", "灵龟", "麒麟"],
    remi_hair: ["丽美", "蝎尾头发", "尾刺", "头发扎人"],
    remi_scorpion_hair: ["丽美", "蝎尾头发", "尾刺", "头发扎人"],
    photo_manipulation: ["照片操控", "枷场菜菜子", "菜菜子", "影像", "底片"],
    mimiko_doll: ["美美子", "玩偶术式", "枷场美美子", "玩偶", "缢线"],
    dhruv_shikigami: ["杜鲁布", "式神轨迹领域", "轨迹领土", "巡行"],
    moon_dregs: ["淀月", "吉野顺平", "顺平"],
    clone_technique: ["分身", "神秘纸袋男", "五影散身", "伪身"],
    manga_artist: ["漫画家", "查理", "贝尔纳"]
  });
  var FEATURE_TECHNIQUE_ARCHETYPE_REQUIREMENTS = Object.freeze({
    limitless: ["gojo_limitless"],
    gojo_limitless: ["gojo_limitless"],
    shrine: ["sukuna_slash"],
    ten_shadows: ["ten_shadows"],
    higuruma_trial_owner: ["higuruma_trial_owner"],
    yuji_soul_melee: ["yuji_soul_melee"],
    recontract_icon: ["recontract_icon"],
    idle_death_gamble: ["hakari_jackpot_owner"],
    copy: ["okkotsu_rika_copy"],
    idle_transfiguration: ["mahito_soul_transfiguration"]
  });
  var RCT_CHARACTER_IDS = new Set([
    "gojo_satoru_shinjuku",
    "sukuna_heian_or_shinjuku",
    "yuta_okkotsu_volume0_true_rika",
    "yuta_okkotsu_shinjuku",
    "shoko_ieiri_support_candidate",
    "kenjaku_geto_body",
    "yuki_tsukumo_culling",
    "yuji_itadori_shinjuku",
    "yuji_itadori_after68",
    "higuruma_hiromi_culling",
    "hazel"
  ]);
  var RCT_OUTPUT_CHARACTER_IDS = new Set([
    "sukuna_heian_or_shinjuku",
    "yuta_okkotsu_volume0_true_rika",
    "yuta_okkotsu_shinjuku",
    "shoko_ieiri_support_candidate"
  ]);

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function isExpected(name) {
    return expectedExports.indexOf(name) !== -1;
  }

  function isExpectedDependency(name) {
    return expectedDependencyNames.indexOf(name) !== -1;
  }

  function assertExpected(name) {
    if (!isExpected(name)) {
      throw new Error(namespace + ": unexpected export '" + name + "'");
    }
  }

  function assertExpectedDependency(name) {
    if (!isExpectedDependency(name)) {
      throw new Error(namespace + ": unexpected dependency '" + name + "'");
    }
  }

  function assertFunction(name, value) {
    if (typeof value !== "function") {
      throw new TypeError(namespace + ": binding '" + name + "' must be a function");
    }
  }

  function bind(name, value) {
    assertExpected(name);
    assertFunction(name, value);
    bindings[name] = value;
    return api;
  }

  function register(map) {
    if (!map || typeof map !== "object") return api;
    expectedExports.forEach(function bindExport(name) {
      if (hasOwn(map, name) && map[name] != null) {
        bind(name, map[name]);
      }
    });
    return api;
  }

  function bindDependency(name, value) {
    assertExpectedDependency(name);
    if (name === "state") {
      dependencies[name] = value;
      return api;
    }
    if (name === "DUEL_DOMAIN_RESPONSE_ACTION_IDS") {
      dependencies[name] = normalizeActionIdSet(value);
      return api;
    }
    assertFunction(name, value);
    dependencies[name] = value;
    return api;
  }

  function configure(map) {
    if (!map || typeof map !== "object") return api;
    Object.keys(map).forEach(function bindEntry(name) {
      if (isExpectedDependency(name) && map[name] != null) {
        bindDependency(name, map[name]);
      }
    });
    return api;
  }

  function registerDependencies(map) {
    return configure(map);
  }

  function hasBinding(name) {
    if (typeof name === "undefined") {
      return expectedExports.every(function hasExport(exportName) {
        return typeof get(exportName) === "function";
      });
    }
    return isExpected(name) && typeof get(name) === "function";
  }

  function get(name) {
    assertExpected(name);
    return bindings[name] || implementations[name];
  }

  function getBinding(name) {
    assertExpected(name);
    return bindings[name] || null;
  }

  function listBindings() {
    return expectedExports.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = typeof get(name) === "function";
      return snapshot;
    }, {});
  }

  function clearBindings() {
    expectedExports.forEach(function clearName(name) {
      delete bindings[name];
    });
    return api;
  }

  function hasDependency(name) {
    return isExpectedDependency(name) && Boolean(getOptionalDependency(name));
  }

  function listDependencies() {
    return expectedDependencyNames.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = Boolean(getOptionalDependency(name));
      return snapshot;
    }, {});
  }

  function clearDependencies() {
    expectedDependencyNames.forEach(function clearName(name) {
      delete dependencies[name];
    });
    return api;
  }

  function getNamespaceBinding(namespaceName, exportName) {
    var target = global[namespaceName];
    if (!target) return null;
    if (typeof target.getBinding === "function") {
      var binding = target.getBinding(exportName);
      if (binding != null) return binding;
    }
    if (typeof target.get === "function") {
      try {
        var value = target.get(exportName);
        if (value != null) return value;
      } catch (error) {
        return null;
      }
    }
    if (hasOwn(target, exportName) && target[exportName] != null) return target[exportName];
    return null;
  }

  function getOptionalDependency(name) {
    if (hasOwn(dependencies, name)) return dependencies[name];
    var source = dependencySources[name];
    if (!source) return null;
    return getNamespaceBinding(source[0], source[1]);
  }

  function requireDependency(name) {
    var dependency = getOptionalDependency(name);
    if (dependency == null) {
      throw new Error(namespace + ": missing dependency '" + name + "'");
    }
    return dependency;
  }

  function callDependency(name, args) {
    return requireDependency(name).apply(null, args || []);
  }

  function getDefaultBattle() {
    var getter = getOptionalDependency("getDuelBattle");
    if (typeof getter === "function") return getter();
    var appState = getOptionalDependency("state");
    return appState?.duelBattle || null;
  }

  function getBattle(duelState) {
    return duelState || getDefaultBattle();
  }

  function getDuelActionRules() {
    return callDependency("getDuelActionRules", []);
  }

  function getDuelActionTemplates() {
    return getDuelActionRules().templates || [];
  }

  function getDuelDomainControlActionTemplates() {
    return [
      {
        id: "domain_expand",
        label: "领域展开",
        status: "CONFIRMED",
        description: "展开领域进入高压结界。",
        cardType: "domain",
        domainHand: true,
        tags: ["领域操控", "domain_access", "领域", "领域展开", "domain_activation", "展开"],
        cost: { ceRatio: 0.18, minCe: 34 },
        requirements: { requiresDomainAccess: true, domainActive: false, blocksOnTechniqueImbalance: true },
        effects: { activateDomain: true, domainLoadDelta: 18, weightDeltas: { domain: 2.4, technique: 0.7 }, outgoingScale: 1.12, stabilityDelta: -0.018 },
        baseDamage: 12,
        baseDomainLoadDelta: 18,
        baseDomainPressure: 24,
        baseCeCost: 34,
        durationRounds: 1,
        damageType: "domain",
        scalingProfile: "domain_pressure",
        risk: "high",
        weight: 0.7,
        selectionWeight: 8.4,
        logTemplate: "你展开领域，结界压制启动，领域负荷同步上升。"
      },
      {
        id: "domain_compress",
        label: "压缩领域",
        status: "CONFIRMED",
        description: "主动收束领域边界。",
        cardType: "domain_maintenance",
        domainHand: true,
        tags: ["领域操控", "domain_access", "领域", "domain_maintenance", "收束", "稳定"],
        cost: { ceRatio: 0.045, minCe: 10 },
        requirements: { domainActive: true },
        effects: { domainLoadDelta: -10, domainLoadScale: 0.45, outgoingScale: 0.88, stabilityDelta: 0.03, weightDeltas: { domain: -0.5, sustain: 1 } },
        baseStabilityRestore: 30,
        baseDomainLoadDelta: -10,
        baseDomainPressure: 16,
        baseDefensePressure: 5,
        baseCeCost: 10,
        durationRounds: 1,
        damageType: "domain",
        scalingProfile: "domain_pressure",
        risk: "low",
        weight: 1,
        selectionWeight: 7.2,
        logTemplate: "你主动收束领域边界，换取负荷回落。"
      },
      {
        id: "domain_force_sustain",
        label: "强行维持领域",
        status: "CONFIRMED",
        description: "不顾负荷继续扩大领域压制。",
        cardType: "domain_maintenance",
        domainHand: true,
        tags: ["领域操控", "domain_access", "领域", "domain_maintenance", "维持", "领域崩解风险"],
        cost: { ceRatio: 0.13, minCe: 24 },
        requirements: { domainActive: true },
        effects: { domainLoadDelta: 16, domainLoadScale: 1.45, outgoingScale: 1.2, stabilityDelta: -0.038, weightDeltas: { domain: 1.8, finisher: 0.6 } },
        baseDamage: 20,
        baseDomainLoadDelta: 16,
        baseDomainPressure: 16,
        baseCeCost: 24,
        durationRounds: 1,
        damageType: "domain",
        scalingProfile: "domain_pressure",
        risk: "critical",
        weight: 0.55,
        selectionWeight: 6.4,
        logTemplate: "你强行维持领域压制，领域收益提高，但负荷逼近熔断线。"
      },
      {
        id: "domain_release",
        label: "主动解除领域",
        status: "CONFIRMED",
        description: "主动撤去领域避免熔断。",
        cardType: "domain_maintenance",
        domainHand: true,
        tags: ["领域操控", "domain_access", "领域", "domain_maintenance", "解除", "回稳"],
        cost: { ceRatio: 0, minCe: 0 },
        requirements: { domainActive: true },
        effects: { releaseDomain: true, stabilityDelta: 0.035, domainLoadDelta: -8, weightDeltas: { sustain: 0.75, domain: -1.4 } },
        baseStabilityRestore: 35,
        baseDomainLoadDelta: -8,
        baseDomainPressure: 16,
        baseDefensePressure: 4,
        baseCeCost: 0,
        durationRounds: 1,
        damageType: "domain",
        scalingProfile: "domain_pressure",
        risk: "low",
        weight: 1,
        selectionWeight: 7.2,
        logTemplate: "你主动解除领域，避免领域熔断。"
      },
      {
        id: "domain_clash",
        label: "领域对抗",
        status: "CONFIRMED",
        description: "以真正领域展开或高阶领域干涉正面对撞对方领域。",
        cardType: "domain_response",
        domainHand: true,
        tags: ["领域操控", "domain_access", "领域", "domain_response", "领域对抗", "domain_activation", "领域应对"],
        cost: { ceRatio: 0.14, minCe: 28 },
        requirements: { opponentDomainActive: true, requiresDomainClash: true },
        effects: { weightDeltas: { counter: 1.1, domain: 1.05 }, opponentWeightDeltas: { domain: -1.35, technique: -0.35 }, opponentDomainLoadDelta: 16, domainLoadDelta: 8, sureHitScale: 0.46, domainPressureScale: 0.72, manualAttackScale: 0.92, stabilityDelta: -0.024, lowStabilityHpRecoil: 5 },
        baseShield: 54,
        baseDomainLoadDelta: 8,
        baseDomainPressure: 16,
        baseDefensePressure: 6,
        baseCeCost: 28,
        durationRounds: 1,
        damageType: "domain",
        scalingProfile: "domain_pressure",
        risk: "high",
        weight: 0.75,
        selectionWeight: 6.8,
        logTemplate: "你以领域或高阶结界干涉正面对抗对方领域，推高对方领域负荷，但自身也承受领域负担。"
      },
      {
        id: "simple_domain_guard",
        label: "简易领域防御",
        status: "CONFIRMED",
        description: "以简易领域削弱必中，拖住对方领域压制。",
        cardType: "domain_response",
        domainHand: true,
        tags: ["领域操控", "simple_domain", "简易领域", "领域应对", "必中削弱", "防御"],
        cost: { ceRatio: 0.065, minCe: 12 },
        requirements: { opponentDomainActive: true, requiresSimpleDomain: true },
        effects: { sureHitScale: 0.35, domainPressureScale: 0.72, manualAttackScale: 0.95, incomingHpScale: 0.82, incomingCeScale: 0.9, opponentWeightDeltas: { domain: -0.35 }, opponentDomainLoadDelta: 2, stabilityDelta: -0.006, selfStatus: { id: "simpleDomainWearing", label: "简易领域磨损", rounds: 1, value: 1 } },
        baseBlock: 18,
        baseShield: 65,
        baseDomainPressure: 2,
        baseCeCost: 12,
        durationRounds: 1,
        damageType: "domain",
        scalingProfile: "domain_pressure",
        risk: "medium",
        weight: 1,
        selectionWeight: 6.2,
        logTemplate: "你展开简易领域削弱必中，结界边界被对方领域持续压缩并开始磨损。"
      },
      {
        id: "hollow_wicker_basket_guard",
        label: "弥虚葛笼",
        status: "CONFIRMED",
        description: "以弥虚葛笼抵消必中，但行动和输出受到明显限制。",
        cardType: "domain_response",
        domainHand: true,
        tags: ["领域操控", "hollow_wicker_basket", "弥虚葛笼", "领域应对", "必中抵消", "架势限制"],
        cost: { ceRatio: 0.055, minCe: 10 },
        requirements: { opponentDomainActive: true, requiresHollowWickerBasket: true },
        effects: { sureHitScale: 0.28, domainPressureScale: 0.78, manualAttackScale: 1, incomingHpScale: 0.86, outgoingScale: 0.68, weightDeltas: { technique: -0.7, finisher: -0.8, melee: -0.35 }, opponentDomainLoadDelta: 1, selfStatus: { id: "hollowWickerBasketPosture", label: "弥虚葛笼架势受限", rounds: 1, value: 1 } },
        baseBlock: 14,
        baseShield: 72,
        baseDomainPressure: 1,
        baseCeCost: 10,
        durationRounds: 1,
        damageType: "domain",
        scalingProfile: "domain_pressure",
        risk: "medium",
        weight: 1,
        selectionWeight: 6.1,
        logTemplate: "你维持弥虚葛笼抵消必中，架势被迫固定，输出和机动同步受限。"
      },
      {
        id: "falling_blossom_emotion",
        label: "落花之情",
        status: "CONFIRMED",
        description: "以自动迎击削弱必中，是预留的反必中防线而非领域对撞。",
        cardType: "domain_response",
        domainHand: true,
        tags: ["领域操控", "falling_blossom_emotion", "落花之情", "领域应对", "自动迎击"],
        cost: { ceRatio: 0.05, minCe: 10 },
        requirements: { opponentDomainActive: true, requiresFallingBlossomEmotion: true },
        effects: { sureHitScale: 0.48, domainPressureScale: 0.82, manualAttackScale: 0.95, incomingHpScale: 0.88, weightDeltas: { counter: 0.4 }, stabilityDelta: -0.004 },
        baseBlock: 12,
        baseShield: 48,
        baseDomainPressure: 1,
        baseCeCost: 10,
        durationRounds: 1,
        damageType: "domain",
        scalingProfile: "domain_pressure",
        risk: "medium",
        weight: 1,
        selectionWeight: 5.8,
        logTemplate: "你以落花之情自动迎击必中，削弱命中伤害，但这不是领域对撞。"
      },
      {
        id: "zero_ce_domain_bypass",
        label: "零咒力必中规避",
        status: "CONFIRMED",
        description: "零咒力个体不被领域必中正常捕捉，但仍会承受领域压制和手动攻击。",
        cardType: "domain_response",
        domainHand: true,
        tags: ["领域操控", "zero_ce", "零咒力", "领域应对", "必中规避", "天与咒缚"],
        cost: { ceRatio: 0, minCe: 0 },
        requirements: { opponentDomainActive: true, requiresZeroCeBypass: true },
        effects: { sureHitScale: 0.08, domainPressureScale: 0.82, manualAttackScale: 1, incomingHpScale: 0.88, outgoingScale: 1.02, weightDeltas: { melee: 0.9, initiative: 0.55, counter: 0.35 } },
        baseBlock: 10,
        baseShield: 58,
        baseDomainPressure: 1,
        baseCeCost: 0,
        durationRounds: 1,
        damageType: "domain",
        scalingProfile: "domain_pressure",
        risk: "low",
        weight: 1,
        selectionWeight: 5.9,
        logTemplate: "零咒力个体不被领域必中正常捕捉，转而寻找近身突入、破坏结界锚点或脱出的机会。"
      }
    ];
  }

  function mergeDuelDomainControlActionTemplates(templates) {
    var merged = Array.isArray(templates) ? templates.slice() : [];
    var existingIds = new Set(merged.map(function collectId(template) {
      return String(template?.id || template?.sourceActionId || "").trim();
    }).filter(Boolean));
    getDuelDomainControlActionTemplates().forEach(function addFallbackDomainControl(template) {
      var id = String(template?.id || "").trim();
      if (!id || existingIds.has(id)) return;
      merged.push(template);
      existingIds.add(id);
    });
    return merged;
  }

  function getDuelMechanicTemplateRules() {
    var getter = getOptionalDependency("getDuelMechanicTemplateRules");
    if (typeof getter === "function" && getter !== getDuelMechanicTemplateRules) return getter();
    var appState = getOptionalDependency("state");
    return appState?.duelMechanicRules || {
      schema: "jjk-duel-mechanic-templates",
      version: "0.1.0-candidate",
      status: "CANDIDATE",
      mechanics: []
    };
  }

  function getDuelMechanicTemplates() {
    var rules = getDuelMechanicTemplateRules();
    return Array.isArray(rules?.mechanics) ? rules.mechanics : [];
  }

  function addIndexedItem(index, key, value) {
    if (!key) return;
    index[key] ||= [];
    index[key].push(value);
  }

  function readActionContexts(action) {
    var contexts = []
      .concat(action?.allowedContexts || [])
      .concat(action?.availability?.contexts || []);
    if (action?.requirements?.domainActive === true) contexts.push("domain_active");
    if (action?.requirements?.opponentDomainActive) contexts.push("opponent_domain");
    if (!contexts.length) contexts.push("normal");
    return Array.from(new Set(contexts.filter(Boolean)));
  }

  function buildDuelActionTemplateIndexes(rules) {
    var activeRules = rules || getDuelActionRules();
    var templates = Array.isArray(activeRules?.templates) ? activeRules.templates : [];
    var index = {
      schema: "jjk-duel-action-template-index",
      version: activeRules?.version || "",
      templateCount: templates.length,
      templates: templates,
      actionById: Object.create(null),
      actionsByTag: Object.create(null),
      actionsByContext: Object.create(null)
    };
    templates.forEach(function indexAction(action) {
      if (!action?.id) return;
      index.actionById[action.id] = action;
      (action.tags || []).forEach(function indexTag(tag) {
        addIndexedItem(index.actionsByTag, tag, action);
      });
      readActionContexts(action).forEach(function indexContext(context) {
        addIndexedItem(index.actionsByContext, context, action);
      });
    });
    return index;
  }

  function getActionRulesStamp(rules) {
    var activeRules = rules || getDuelActionRules();
    return [
      activeRules?.version || "",
      Array.isArray(activeRules?.templates) ? activeRules.templates.length : 0
    ].join("|");
  }

  function getDuelActionTemplateIndex() {
    var rules = getDuelActionRules();
    var stamp = getActionRulesStamp(rules);
    if (!actionTemplateIndexCache || actionTemplateIndexCache.stamp !== stamp) {
      actionTemplateIndexCache = buildDuelActionTemplateIndexes(rules);
      actionTemplateIndexCache.stamp = stamp;
    }
    return actionTemplateIndexCache;
  }

  function warmDuelActionTemplateCache() {
    return getDuelActionTemplateIndex();
  }

  function invalidateDuelActionTemplateCache() {
    actionTemplateIndexCache = null;
    performanceCacheStats.actionLastInvalidatedAt = new Date().toISOString();
  }

  function collectStatusEffectIds(effectPatch) {
    var statuses = []
      .concat(effectPatch?.selfStatus ? [effectPatch.selfStatus] : [])
      .concat(effectPatch?.opponentStatus ? [effectPatch.opponentStatus] : [])
      .concat(effectPatch?.selfStatuses || [])
      .concat(effectPatch?.opponentStatuses || []);
    return statuses.map(function mapStatus(status) { return status?.id || ""; }).filter(Boolean);
  }

  function buildDuelMechanicTemplateIndexes(rules) {
    var activeRules = rules || getDuelMechanicTemplateRules();
    var mechanics = Array.isArray(activeRules?.mechanics) ? activeRules.mechanics : [];
    var index = {
      schema: "jjk-duel-mechanic-template-index",
      version: activeRules?.version || "",
      mechanicCount: mechanics.length,
      mechanics: mechanics,
      mechanicById: Object.create(null),
      mechanicsByTrigger: Object.create(null),
      mechanicsBySourceActionId: Object.create(null),
      mechanicsByStatusEffect: Object.create(null)
    };
    mechanics.forEach(function indexMechanic(mechanic) {
      if (!mechanic?.id) return;
      index.mechanicById[mechanic.id] = mechanic;
      addIndexedItem(index.mechanicsByTrigger, mechanic.trigger, mechanic);
      (mechanic.sourceActionIds || []).forEach(function indexSourceAction(sourceActionId) {
        addIndexedItem(index.mechanicsBySourceActionId, sourceActionId, mechanic);
      });
      collectStatusEffectIds(mechanic.effectPatch || {}).forEach(function indexStatus(statusId) {
        addIndexedItem(index.mechanicsByStatusEffect, statusId, mechanic);
      });
    });
    return index;
  }

  function getMechanicRulesStamp(rules) {
    var activeRules = rules || getDuelMechanicTemplateRules();
    return [
      activeRules?.version || "",
      Array.isArray(activeRules?.mechanics) ? activeRules.mechanics.length : 0
    ].join("|");
  }

  function getDuelMechanicTemplateIndex() {
    var rules = getDuelMechanicTemplateRules();
    var stamp = getMechanicRulesStamp(rules);
    if (!mechanicTemplateIndexCache || mechanicTemplateIndexCache.stamp !== stamp) {
      mechanicTemplateIndexCache = buildDuelMechanicTemplateIndexes(rules);
      mechanicTemplateIndexCache.stamp = stamp;
    }
    return mechanicTemplateIndexCache;
  }

  function warmDuelMechanicTemplateCache() {
    return getDuelMechanicTemplateIndex();
  }

  function invalidateDuelMechanicTemplateCache() {
    mechanicTemplateIndexCache = null;
    performanceCacheStats.mechanicLastInvalidatedAt = new Date().toISOString();
  }

  function getDuelMechanicTemplateById(mechanicId) {
    return getDuelMechanicTemplateIndex().mechanicById[mechanicId] || null;
  }

  function collectDuelMechanicsForAction(action) {
    if (!action?.id) return [];
    var index = getDuelMechanicTemplateIndex();
    var collected = [];
    var seen = new Set();
    function pushMechanic(mechanic) {
      if (!mechanic?.id || seen.has(mechanic.id)) return;
      seen.add(mechanic.id);
      collected.push(mechanic);
    }
    (action.mechanicIds || []).forEach(function addExplicit(id) {
      pushMechanic(index.mechanicById[id]);
    });
    (index.mechanicsBySourceActionId[action.id] || []).forEach(pushMechanic);
    return collected;
  }

  function addEffectMap(target, source) {
    Object.entries(source || {}).forEach(function addEntry(entry) {
      var key = entry[0];
      var value = entry[1];
      target[key] = Number((Number(target[key] || 0) + Number(value || 0)).toFixed(3));
    });
  }

  function pushStatusEffects(target, value) {
    if (!value) return;
    [].concat(value || []).forEach(function pushStatus(status) {
      if (status?.id) target.push({ ...status });
    });
  }

  function mergeDuelMechanicEffects(baseEffects, mechanics) {
    var effects = { ...(baseEffects || {}) };
    var scaleKeys = [
      "outgoingScale",
      "incomingHpScale",
      "incomingCeScale",
      "sureHitScale",
      "domainPressureScale",
      "manualAttackScale",
      "domainLoadScale",
      "damageScale"
    ];
    var additiveKeys = [
      "stabilityDelta",
      "domainLoadDelta",
      "opponentDomainLoadDelta",
      "opponentStabilityDelta",
      "opponentRegenInterference",
      "lowStabilityHpRecoil",
      "selfHpCostFlat",
      "selfHpCostRatio",
      "evasionBonus"
    ];
    effects.weightDeltas = { ...(effects.weightDeltas || {}) };
    effects.opponentWeightDeltas = { ...(effects.opponentWeightDeltas || {}) };
    effects.selfStatuses = [].concat(effects.selfStatus ? [effects.selfStatus] : [], effects.selfStatuses || []);
    effects.opponentStatuses = [].concat(effects.opponentStatus ? [effects.opponentStatus] : [], effects.opponentStatuses || []);
    mechanics.forEach(function mergeMechanic(mechanic) {
      var patch = mechanic?.effectPatch || {};
      scaleKeys.forEach(function mergeScale(key) {
        if (patch[key] !== undefined) effects[key] = Number((Number(effects[key] || 1) * Number(patch[key] || 1)).toFixed(4));
      });
      additiveKeys.forEach(function mergeAdditive(key) {
        if (patch[key] !== undefined) effects[key] = Number((Number(effects[key] || 0) + Number(patch[key] || 0)).toFixed(4));
      });
      if (patch.activateDomain) effects.activateDomain = true;
      if (patch.releaseDomain) effects.releaseDomain = true;
      addEffectMap(effects.weightDeltas, patch.weightDeltas);
      addEffectMap(effects.opponentWeightDeltas, patch.opponentWeightDeltas);
      pushStatusEffects(effects.selfStatuses, patch.selfStatus);
      pushStatusEffects(effects.selfStatuses, patch.selfStatuses);
      pushStatusEffects(effects.opponentStatuses, patch.opponentStatus);
      pushStatusEffects(effects.opponentStatuses, patch.opponentStatuses);
    });
    return effects;
  }

  function getDuelProfileForSide(battle, side) {
    var dependency = getOptionalDependency("getDuelProfileForSide");
    if (dependency && dependency !== getDuelProfileForSide) return dependency(battle, side);
    if (side === "left") return battle?.left || null;
    if (side === "right") return battle?.right || null;
    return null;
  }

  function getDuelActionCost(action, actor) {
    var dependency = getOptionalDependency("getDuelActionCost");
    if (dependency && dependency !== getDuelActionCost) return dependency(action, actor);
    var bloodRuntime = getBloodManipulationRuntimeConfig(action, actor, getBattle());
    if (bloodRuntime?.active && Number.isFinite(Number(bloodRuntime.ceCost))) return Math.max(0, Number(bloodRuntime.ceCost));
    var costPreview = global.JJKDuelCardTemplate?.calculateDuelCardCeCost;
    if (typeof costPreview === "function") {
      var preview = costPreview(action, actor || {});
      if (Number.isFinite(Number(preview?.finalCost))) return Number(preview.finalCost);
    }
    if (action?.costType === "zero_ce" || action?.zeroCeCostOverride) return 0;
    if (Number.isFinite(Number(action?.baseCeCost))) return Math.max(0, Number(action.baseCeCost));
    if (Number.isFinite(Number(action?.ceCost))) return Math.max(0, Number(action.ceCost));
    if (Number.isFinite(Number(action?.costCe))) return Math.max(0, Number(action.costCe));
    var cost = action?.cost || {};
    var ratioCost = Number(actor?.maxCe || 0) * Number(cost.ceRatio || 0);
    return Number(Math.max(Number(cost.flatCe || 0), Number(cost.minCe || 0), ratioCost).toFixed(1));
  }

  function getDuelDomainResponseProfile(profile, actor, opponent, battle) {
    return callDependency("getDuelDomainResponseProfile", [profile, actor, opponent, battle]);
  }

  function isDuelOpponentDomainThreat(opponent, actor, battle) {
    return callDependency("isDuelOpponentDomainThreat", [opponent, actor, battle]);
  }

  function hasDuelDomainCounterAccess(profile) {
    return callDependency("hasDuelDomainCounterAccess", [profile]);
  }

  function syncDuelTrialSubPhaseLifecycle(battle) {
    return callDependency("syncDuelTrialSubPhaseLifecycle", [battle]);
  }

  function updateDuelDomainTrialContext(battle, patch) {
    return callDependency("updateDuelDomainTrialContext", [battle, patch]);
  }

  function getDuelResourcePair(battle, side) {
    return callDependency("getDuelResourcePair", [battle, side]);
  }

  function clampDuelResource(resource) {
    return callDependency("clampDuelResource", [resource]);
  }

  function getDuelActionTemporaryResourceCap(resource, valueKey, maxKey, overCapKey) {
    var max = Math.max(0, Number(resource?.[maxKey] || 0));
    var overCap = Math.max(0, Number(resource?.[overCapKey] || 0));
    var current = Math.max(0, Number(resource?.[valueKey] || 0));
    return Math.max(max, current, max + overCap);
  }

  function getDuelStatusEffectValue(resource, id) {
    var dependency = getOptionalDependency("getDuelStatusEffectValue");
    if (dependency) return dependency(resource, id);
    if (!resource?.statusEffects?.length) return 0;
    return Math.max(0, ...resource.statusEffects
      .filter(function filterEffect(effect) {
        return effect.id === id;
      })
      .map(function mapEffect(effect) {
        return Number(effect.value || 1);
      }));
  }

  function getDuelActionTurnNumber(battle) {
    return Number(battle?.round || 0) + 1;
  }

  function isDuelStatusEffectActive(effect, battle) {
    var triggerRound = Number(effect?.triggerRound || 0);
    return !triggerRound || getDuelActionTurnNumber(battle) >= triggerRound;
  }

  function getActiveDuelOutgoingStatusScale(resource, battle) {
    return (Array.isArray(resource?.statusEffects) ? resource.statusEffects : []).reduce(function multiplyScale(total, effect) {
      if (!isDuelStatusEffectActive(effect, battle)) return total;
      var scale = Number(effect.outgoingScale ?? (effect.id === "loaned_shot_debt" ? effect.value : 1));
      return Number.isFinite(scale) && scale > 0 ? total * scale : total;
    }, 1);
  }

  function isDuelResourceDefeated(resource, battle) {
    if (!resource) return true;
    if (Number(resource.hp || 0) > 0) return false;
    return !isMahoragaProxyProtectingSide(battle, resource.side || "");
  }

  function getDuelActionHpCost(action, actor) {
    var bloodRuntime = getBloodManipulationRuntimeConfig(action, actor, getBattle());
    if (bloodRuntime?.active && Number.isFinite(Number(bloodRuntime.hpCost))) return Math.max(0, Number(bloodRuntime.hpCost));
    var effects = action?.effects || {};
    var flat = Math.max(0, Number(effects.selfHpCostFlat ?? action?.selfHpCostFlat ?? 0));
    var ratio = Math.max(0, Number(effects.selfHpCostRatio ?? action?.selfHpCostRatio ?? 0));
    var maxHp = Math.max(0, Number(actor?.maxHp || 0));
    return Number((flat + maxHp * ratio).toFixed(1));
  }

  function applyDuelActionHpCost(action, actor) {
    var cost = getDuelActionHpCost(action, actor);
    if (!cost || !actor) return 0;
    var effects = action?.effects || {};
    var minimumHp = effects.selfHpCostNonlethal === false || action?.selfHpCostNonlethal === false ? 0 : 1;
    var beforeHp = Number(actor.hp || 0);
    actor.hp = Number(Math.max(minimumHp, beforeHp - cost).toFixed(1));
    return Number(Math.max(0, beforeHp - Number(actor.hp || 0)).toFixed(1));
  }

  function recordDuelResourceChange(battle, entry) {
    return callDependency("recordDuelResourceChange", [battle, entry]);
  }

  function getDuelResourceSideLabel(side) {
    var dependency = getOptionalDependency("getDuelResourceSideLabel");
    return dependency ? dependency(side) : (side === "left" ? "我方" : side === "right" ? "对方" : "战场");
  }

  function formatSignedDuelDelta(value) {
    var dependency = getOptionalDependency("formatSignedDuelDelta");
    if (dependency) return dependency(value);
    var number = Number(value || 0);
    return number >= 0 ? "+" + number : String(number);
  }

  function clamp(value, min, max) {
    var dependency = getOptionalDependency("clamp");
    if (dependency && dependency !== clamp) return dependency(value, min, max);
    return Math.max(min, Math.min(max, value));
  }

  function hashDuelSeed(value) {
    var dependency = getOptionalDependency("hashDuelSeed");
    if (dependency && dependency !== hashDuelSeed) return dependency(value);
    var hash = 2166136261;
    var text = String(value || "duel-seed");
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function normalizeActionIdSet(value) {
    if (value instanceof Set) return value;
    if (Array.isArray(value)) return new Set(value);
    if (value && typeof value.has === "function") return value;
    return domainResponseActionIds;
  }

  function getDomainResponseActionIds() {
    return normalizeActionIdSet(getOptionalDependency("DUEL_DOMAIN_RESPONSE_ACTION_IDS"));
  }

  function buildDuelDomainSpecificActions(actor, opponent, duelState) {
    var battle = getBattle(duelState);
    if (!battle?.resourceState || !actor || !opponent) return [];
    var states = battle.domainProfileStates || {};
    var actions = [];
    var subPhase = syncDuelTrialSubPhaseLifecycle(battle) || battle.domainSubPhase;
    if (subPhase?.type === "trial" && !subPhase.verdictResolved) {
      var trialStateEntry = states[subPhase.owner];
      var trialProfile = trialStateEntry?.profile;
      var templates = actor.side === subPhase.owner
        ? callDependency("getDuelTrialOwnerActionTemplates", [trialProfile, subPhase])
        : callDependency("getDuelTrialDefenderActionTemplates", [trialProfile, subPhase]);
      actions.push(...templates.map(function normalizeTemplate(template) {
        return normalizeDuelDomainSpecificAction(template, trialProfile, actor, opponent, trialStateEntry, battle);
      }));
    }
    if (subPhase?.type === "jackpot" && !subPhase.jackpotResolved && actor.side === subPhase.owner) {
      var jackpotStateEntry = states[subPhase.owner];
      var jackpotProfile = jackpotStateEntry?.profile;
      actions.push(...(jackpotProfile?.domainActions || []).map(function normalizeTemplate(template) {
        return normalizeDuelDomainSpecificAction(template, jackpotProfile, actor, opponent, jackpotStateEntry, battle);
      }));
    }
    Object.values(states).forEach(function addStateActions(stateEntry) {
      if (!stateEntry?.profile || stateEntry.domainId === subPhase?.domainId || stateEntry.ownerSide !== actor.side) return;
      if (!getDuelResourcePair(battle, actor.side)?.domain?.active) return;
      actions.push(...(stateEntry.profile.domainActions || []).map(function normalizeTemplate(template) {
        return normalizeDuelDomainSpecificAction(template, stateEntry.profile, actor, opponent, stateEntry, battle);
      }));
    });
    return actions;
  }

  function normalizeDuelDomainSpecificAction(template, profile, actor, opponent, stateEntry, duelState) {
    return callDependency("normalizeDuelDomainSpecificAction", [template, profile, actor, opponent, stateEntry, duelState]);
  }

  function invalidateDuelActionChoices(battle) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return;
    activeBattle.actionChoices = [];
    activeBattle.actionRound = 0;
  }

  function getDuelActionAvailability(action, actor, opponent, duelState) {
    var battle = getBattle(duelState);
    var side = actor?.side || "";
    var profile = getDuelProfileForSide(battle, side);
    var domainResponse = getDuelDomainResponseProfile(profile || {}, actor, opponent, battle);
    var requirements = action.requirements || {};
    var costCe = getDuelActionCost(action, actor);
    var hpCost = getDuelActionHpCost(action, actor);
    if (!actor || !opponent) return { available: false, reason: "资源状态缺失", costCe: costCe };
    if (isDuelResourceDefeated(actor, battle)) return { available: false, reason: "体势已归零，无法行动", costCe: costCe };
    if (actor.ce < costCe) return { available: false, reason: "咒力不足", costCe: costCe };
    if (hpCost > 0 && Number(actor.hp || 0) <= 1) return { available: false, reason: "体势不足以支付代价", costCe: costCe };
    if (isTenShadowsUniqueShikigamiAction(action) && hasTenShadowsShikigamiBeenSummoned(battle, side, action)) {
      return { available: false, reason: "该十种影式神本场已经召唤过", costCe: costCe };
    }
    var starRageAvailability = getStarRageActionAvailability(action, actor, battle);
    if (!starRageAvailability.available) return { available: false, reason: starRageAvailability.reason, costCe: costCe };
    var projectionAvailability = getProjectionActionAvailability(action, actor, battle);
    if (!projectionAvailability.available) return { available: false, reason: projectionAvailability.reason, costCe: costCe };
    if (requirements.requiresMissingHp && actor.maxHp && Number(actor.hp || 0) >= Number(actor.maxHp || 0) - 0.5) {
      return { available: false, reason: "当前没有需要反转治疗的伤势", costCe: costCe };
    }
    if (requirements.domainActive === true && !actor.domain?.active) return { available: false, reason: "当前未展开领域", costCe: costCe };
    if (requirements.domainActive === false && actor.domain?.active) return { available: false, reason: "领域已展开", costCe: costCe };
    if (requirements.requiresDomainAccess && !domainResponse.canExpandDomain) return { available: false, reason: "当前角色不具备领域条件", costCe: costCe };
    if (requirements.opponentDomainActive && !isDuelOpponentDomainThreat(opponent, actor, battle)) {
      if (!getDomainResponseActionIds().has(action.id)) return { available: false, reason: "对方未展开领域", costCe: costCe };
    }
    if (requirements.requiresDomainClash && !domainResponse.allowedDomainResponseActions.includes("domain_clash")) return { available: false, reason: "缺少真正领域对抗条件", costCe: costCe };
    if (requirements.requiresSimpleDomain && !domainResponse.allowedDomainResponseActions.includes("simple_domain_guard")) return { available: false, reason: "缺少简易领域防线", costCe: costCe };
    if (requirements.requiresHollowWickerBasket && !domainResponse.allowedDomainResponseActions.includes("hollow_wicker_basket_guard")) return { available: false, reason: "缺少弥虚葛笼", costCe: costCe };
    if (requirements.requiresFallingBlossomEmotion && !domainResponse.allowedDomainResponseActions.includes("falling_blossom_emotion")) return { available: false, reason: "缺少落花之情", costCe: costCe };
    if (requirements.requiresZeroCeBypass && !domainResponse.allowedDomainResponseActions.includes("zero_ce_domain_bypass")) return { available: false, reason: "不具备零咒力必中规避", costCe: costCe };
    if (requirements.requiresNoDomainResponse && !domainResponse.allowedDomainResponseActions.includes("domain_survival_guard")) return { available: false, reason: "已有更合适的领域应对", costCe: costCe };
    if (requirements.requiresDomainCounter && !hasDuelDomainCounterAccess(profile || {})) return { available: false, reason: "缺少领域对抗手段", costCe: costCe };
    if (requirements.blocksOnTechniqueImbalance && (getDuelStatusEffectValue(actor, "techniqueImbalance") > 0 || getDuelStatusEffectValue(actor, "techniqueBurnout") > 0)) return { available: false, reason: "术式烧断中", costCe: costCe };
    var subPhase = battle?.domainSubPhase;
    if (subPhase?.type === "trial" && subPhase.violenceRestricted && !subPhase.verdictResolved && action.id === "forced_output") {
      return { available: false, reason: "审判规则限制暴力输出", costCe: costCe };
    }
    if (subPhase?.type === "trial" && actor?.side === subPhase.defender && !subPhase.verdictResolved) {
      if (["defend", "challenge_evidence", "deny_charge", "delay_trial"].includes(action.id) && subPhase.canDefend === false) {
        return { available: false, reason: "当前审判目标类型不能有效辩护", costCe: costCe };
      }
      if (action.id === "remain_silent" && subPhase.canRemainSilent === false) {
        return { available: false, reason: "当前审判目标类型不能主张沉默", costCe: costCe };
      }
    }
    if (action.id === "request_verdict" && subPhase?.type === "trial" && !subPhase.verdictResolved) {
      var selfIncriminationScale = subPhase.hasSelfAwareness === false ? 0.12 : 0.25;
      var targetPressureScale = {
        full: 1,
        partial: 0.92,
        exorcism_ruling: 0.88,
        redirect_to_controller: 0.82,
        object_confiscation: 0.78
      }[subPhase.trialEligibility] ?? 0.9;
      var adjustedPressure = (
        Number(subPhase.evidencePressure || 0) -
        Number(subPhase.defensePressure || 0) * 0.35 +
        Number(subPhase.heavyVerdictRisk || 0) * 0.45 -
        Number(subPhase.selfIncriminationRisk || 0) * selfIncriminationScale
      ) * targetPressureScale;
      if (!subPhase.verdictReady && adjustedPressure < 4.2) return { available: false, reason: "判决尚未成熟", costCe: costCe };
    }
    if (action.id === "claim_jackpot" && subPhase?.type === "jackpot" && !subPhase.jackpotResolved) {
      if (!subPhase.jackpotReady && Number(subPhase.jackpotGauge || 0) < 100) return { available: false, reason: "jackpot 期待度不足", costCe: costCe };
    }
    if ((getDuelStatusEffectValue(actor, "techniqueConfiscated") > 0 || getDuelStatusEffectValue(actor, "curseTechniqueBound") > 0 || getDuelStatusEffectValue(actor, "techniqueBurnout") > 0) &&
      (action.requiresInnateTechnique || action.techniqueFeatureHand || ["technique_interference", "forced_output", "domain_expand", "domain_force_sustain"].includes(action.id))) {
      return { available: false, reason: "术式被没收或烧断中", costCe: costCe };
    }
    if ((getDuelStatusEffectValue(actor, "cursedToolConfiscated") > 0 || getDuelStatusEffectValue(actor, "toolFunctionLocked") > 0) &&
      ["forced_output", "ce_reinforcement"].includes(action.id)) {
      return { available: false, reason: "咒具没收/封锁候选生效", costCe: costCe };
    }
    return { available: true, reason: "", costCe: costCe };
  }

  function collectDuelActionSearchText(action) {
    if (!action) return "";
    var parts = [
      action.id,
      action.actionId,
      action.sourceActionId,
      action.cardId,
      action.name,
      action.label,
      action.displayName,
      action.description,
      action.effectSummary
    ];
    if (Array.isArray(action.tags)) parts = parts.concat(action.tags);
    if (Array.isArray(action.specialHandTags)) parts = parts.concat(action.specialHandTags);
    return parts.filter(Boolean).join(" ").toLowerCase();
  }

  function isTenShadowsRabbitAction(action) {
    var text = collectDuelActionSearchText(action);
    return text.indexOf("rabbit") !== -1 || text.indexOf("脱兔") !== -1;
  }

  function isTenShadowsUniqueShikigamiAction(action) {
    var text = collectDuelActionSearchText(action);
    var isTenShadows = text.indexOf("ten_shadows") !== -1 || text.indexOf("十种影") !== -1;
    return Boolean(action && action.summonSpec && action.summonSpec.unitCardId && isTenShadows && !isTenShadowsRabbitAction(action));
  }

  function getTenShadowsSummonKey(action) {
    if (!action) return "";
    return String(
      (action.summonSpec && action.summonSpec.unitCardId) ||
      action.cardId ||
      action.sourceActionId ||
      action.actionId ||
      action.id ||
      ""
    );
  }

  function hasTenShadowsShikigamiBeenSummoned(battle, side, action) {
    var key = getTenShadowsSummonKey(action);
    if (!battle || !side || !key) return false;
    var state = battle.tenShadowsSummonState && battle.tenShadowsSummonState[side];
    if (state && state[key]) return true;
    var logs = Array.isArray(battle.summonLog) ? battle.summonLog : [];
    return logs.some(function matchSummon(entry) {
      if (!entry || entry.actorSide !== side) return false;
      return entry.unitCardId === key || entry.cardId === key || entry.sourceActionId === key || entry.actionId === key;
    });
  }

  function markTenShadowsShikigamiSummoned(battle, side, action, unit) {
    var key = getTenShadowsSummonKey(action);
    if (!battle || !side || !key || !isTenShadowsUniqueShikigamiAction(action)) return;
    if (!battle.tenShadowsSummonState || typeof battle.tenShadowsSummonState !== "object") battle.tenShadowsSummonState = {};
    if (!battle.tenShadowsSummonState[side] || typeof battle.tenShadowsSummonState[side] !== "object") battle.tenShadowsSummonState[side] = {};
    battle.tenShadowsSummonState[side][key] = {
      unitId: unit && unit.id ? unit.id : "",
      unitName: unit && unit.name ? unit.name : "",
      actionId: action && action.id ? action.id : "",
      cardId: action && action.cardId ? action.cardId : "",
      sourceActionId: action && action.sourceActionId ? action.sourceActionId : "",
      round: battle.round || 0
    };
  }

  function toFeatureList(value) {
    if (Array.isArray(value)) return value.filter(function keepValue(item) { return item !== undefined && item !== null && item !== ""; });
    if (value === undefined || value === null || value === "") return [];
    return [value];
  }

  function uniqueFeatureList(values) {
    var seen = new Set();
    var output = [];
    (values || []).forEach(function addValue(value) {
      var text = String(value || "").trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      output.push(text);
    });
    return output;
  }

  function normalizeFeatureText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[\s"'`.,，。；;：:、/／\\|!?！？()（）\[\]【】{}《》<>·・_\-—~]+/g, "");
  }

  function normalizeFeatureTag(value) {
    return String(value || "").trim();
  }

  function getTechniqueFeatureHandCards() {
    var appState = getOptionalDependency("state");
    var source = appState?.duelSpecialCards;
    var cards = Array.isArray(source?.cards) ? source.cards : (Array.isArray(source) ? source : []);
    return cards.filter(function keepFeatureCard(card) {
      return card?.playableInHandBeta !== false &&
        card?.importableFromMergedPackage !== false &&
        card?.reviewStatus !== "needs_merge" &&
        card?.duplicateStatus !== "exact_duplicate" &&
        card?.draftRole !== "conflict_only";
    });
  }

  function getRawDuelSpecialCards() {
    var appState = getOptionalDependency("state");
    var source = appState?.duelSpecialCards;
    return Array.isArray(source?.cards) ? source.cards : (Array.isArray(source) ? source : []);
  }

  function getDuelSpecialCardByCardId(cardId) {
    var normalized = String(cardId || "").trim();
    if (!normalized) return null;
    return getRawDuelSpecialCards().find(function findSpecialCard(card) {
      return card?.cardId === normalized || card?.sourceActionId === normalized || card?.id === normalized;
    }) || null;
  }

  function getTechniqueFeatureHandSourceActionIds() {
    var ids = new Set();
    getTechniqueFeatureHandCards().forEach(function collectSpecialSourceId(card) {
      [
        card?.sourceActionId,
        card?.id,
        card?.draftCardId
      ].forEach(function addId(value) {
        var id = String(value || "").trim();
        if (domainControlActionIds.has(id)) return;
        if (id) ids.add(id);
      });
    });
    return ids;
  }

  function isActionTemplateShadowedBySpecialHand(template, specialSourceActionIds) {
    if (!template || !specialSourceActionIds?.size) return false;
    var id = String(template.id || template.sourceActionId || "").trim();
    return Boolean(id && specialSourceActionIds.has(id));
  }

  function pushFeatureTextParts(parts, source) {
    if (!source || typeof source !== "object") return;
    [
      "id",
      "characterId",
      "profileId",
      "name",
      "displayName",
      "stage",
      "technique",
      "techniqueName",
      "techniqueText",
      "techniqueDescription",
      "domainProfile",
      "notes",
      "sourceLayer",
      "officialGrade",
      "visibleGrade",
      "powerTier",
      "externalResource"
    ].forEach(function pushField(field) {
      if (source[field]) parts.push(source[field]);
    });
    if (source.domainScript) {
      parts.push(source.domainScript.id, source.domainScript.domainName, source.domainScript.effectSummary, source.domainScript.scriptType);
      parts.push(...toFeatureList(source.domainScript.effectTags));
    }
    [
      "traits",
      "innateTraits",
      "advancedTechniques",
      "loadout",
      "flags",
      "specialHandTags",
      "特殊手札",
      "techniqueFamilies",
      "archetypes"
    ].forEach(function pushList(field) {
      parts.push(...toFeatureList(source[field]));
    });
  }

  function getExplicitFeatureHandTags(source) {
    var explicit = toFeatureList(source?.explicitSpecialHandTags);
    if (explicit.length) return explicit;
    return [].concat(toFeatureList(source?.specialHandTags), toFeatureList(source?.["特殊手札"]));
  }

  function pushFeatureTechniqueEvidenceParts(parts, source) {
    if (!source || typeof source !== "object") return;
    [
      "id",
      "characterId",
      "profileId",
      "name",
      "displayName",
      "technique",
      "techniqueName",
      "techniqueText",
      "techniqueDescription",
      "domainProfile",
      "notes",
      "externalResource"
    ].forEach(function pushField(field) {
      if (source[field]) parts.push(source[field]);
    });
    if (source.domainScript) {
      parts.push(source.domainScript.id, source.domainScript.domainName, source.domainScript.effectSummary);
    }
    [
      "traits",
      "innateTraits",
      "advancedTechniques",
      "loadout",
      "flags",
      "selectedMechanisms",
      "selectedToolTags"
    ].forEach(function pushList(field) {
      parts.push(...toFeatureList(source[field]));
    });
    var selectedLibrary = source.selectedLibrary || {};
    parts.push(...toFeatureList(selectedLibrary.techniques));
    parts.push(...toFeatureList(selectedLibrary.domains));
    parts.push(...toFeatureList(selectedLibrary.advanced));
    parts.push(...toFeatureList(selectedLibrary.resources));
  }

  function hasFeatureConstructionTechniqueEvidence(text) {
    var value = String(text || "");
    return /构筑术式|真球|液态金属|昆虫铠甲|三重疾苦|禅院真依|真依|yorozu|construction\s+sorcery/i.test(value) ||
      /(^|[\s、，,;；|/／])万($|[\s、，,;；|/／])/i.test(value);
  }

  function hasFeatureBloodTechniqueEvidence(text) {
    return /赤血操术|穿血|血刃|赤鳞跃动|超新星|苅祓|百敛|胀相|脹相|加茂宪纪|加茂憲紀|blood\s+manipulation/i.test(String(text || ""));
  }

  function sanitizeFeatureSpecialHandTags(tags, evidenceText) {
    var normalized = uniqueFeatureList(tags);
    return normalized.filter(function keepTag(tag) {
      if (tag === "construction") return hasFeatureConstructionTechniqueEvidence(evidenceText);
      if (tag === "blood_manipulation") return hasFeatureBloodTechniqueEvidence(evidenceText);
      if (tag === "ten_shadows") return /伏黑惠|megumi|十种影法术|十种影|十影|ten[_\s-]?shadows|嵌合暗翳庭|魔虚罗|魔须罗|mahoraga/i.test(String(evidenceText || ""));
      if (tag === "projection_sorcery") return /投射术式|投射咒法|二十四帧|帧率|直哉|直毘人|projection\s+sorcery/i.test(String(evidenceText || ""));
      if (tag === "star_rage") return /星之怒|虚拟质量|凰轮|黑洞|九十九由基|star\s+rage/i.test(String(evidenceText || ""));
      if (tag === "limitless") return /无下限|五条|六眼|苍|赫|茈|limitless|infinity/i.test(String(evidenceText || ""));
      if (tag === "shrine") return /御厨子|伏魔御厨子|宿傩|捌|解|斩击|shrine|cleave|dismantle/i.test(String(evidenceText || ""));
      return true;
    });
  }

  function getActorFeatureSnapshot(actor, battle) {
    var appState = getOptionalDependency("state");
    var actorId = actor?.profileId || actor?.characterId || actor?.id || "";
    var profile = getDuelProfileForSide(battle, actor?.side || "") || actor?.characterCardProfile || actor?.profile || {};
    var customCard = Array.isArray(appState?.customDuelCards)
      ? appState.customDuelCards.find(function findCustomCard(card) {
        return card?.characterId === actorId || card?.id === actorId;
      })
      : null;
    var handProfile = null;
    try {
      var handProfileGetter = global.JJKDuelHand?.get?.("buildDuelCharacterCardProfile");
      if (typeof handProfileGetter === "function") handProfile = handProfileGetter(actor) || null;
    } catch (error) {
      handProfile = null;
    }
    var parts = [];
    pushFeatureTextParts(parts, actor);
    pushFeatureTextParts(parts, actor?.profile);
    pushFeatureTextParts(parts, actor?.characterCardProfile);
    pushFeatureTextParts(parts, profile);
    pushFeatureTextParts(parts, handProfile);
    pushFeatureTextParts(parts, customCard);
    var techniqueEvidenceParts = [];
    pushFeatureTechniqueEvidenceParts(techniqueEvidenceParts, actor);
    pushFeatureTechniqueEvidenceParts(techniqueEvidenceParts, actor?.profile);
    pushFeatureTechniqueEvidenceParts(techniqueEvidenceParts, actor?.characterCardProfile);
    pushFeatureTechniqueEvidenceParts(techniqueEvidenceParts, profile);
    pushFeatureTechniqueEvidenceParts(techniqueEvidenceParts, handProfile);
    pushFeatureTechniqueEvidenceParts(techniqueEvidenceParts, customCard);
    var techniqueEvidenceText = uniqueFeatureList(techniqueEvidenceParts).join(" ");
    var specialHandTags = uniqueFeatureList([]
      .concat(toFeatureList(actor?.specialHandTags), toFeatureList(actor?.["特殊手札"]))
      .concat(toFeatureList(actor?.profile?.specialHandTags), toFeatureList(actor?.profile?.["特殊手札"]))
      .concat(toFeatureList(actor?.characterCardProfile?.specialHandTags), toFeatureList(actor?.characterCardProfile?.["特殊手札"]))
      .concat(toFeatureList(profile?.specialHandTags), toFeatureList(profile?.["特殊手札"]))
      .concat(toFeatureList(handProfile?.specialHandTags), toFeatureList(handProfile?.["特殊手札"]))
      .concat(toFeatureList(customCard?.specialHandTags), toFeatureList(customCard?.["特殊手札"])));
    var explicitSpecialHandTags = uniqueFeatureList([]
      .concat(getExplicitFeatureHandTags(actor))
      .concat(getExplicitFeatureHandTags(actor?.profile))
      .concat(getExplicitFeatureHandTags(actor?.characterCardProfile))
      .concat(getExplicitFeatureHandTags(profile))
      .concat(getExplicitFeatureHandTags(handProfile))
      .concat(getExplicitFeatureHandTags(customCard)));
    specialHandTags = sanitizeFeatureSpecialHandTags(specialHandTags, techniqueEvidenceText);
    explicitSpecialHandTags = sanitizeFeatureSpecialHandTags(explicitSpecialHandTags, techniqueEvidenceText);
    parts.push(...specialHandTags);
    var ids = uniqueFeatureList([
      actorId,
      actor?.characterId,
      actor?.profileId,
      actor?.id,
      actor?.name,
      actor?.displayName,
      actor?.profile?.characterId,
      actor?.profile?.id,
      actor?.profile?.displayName,
      profile?.characterId,
      profile?.id,
      profile?.displayName,
      handProfile?.characterId,
      handProfile?.ruleId,
      handProfile?.displayName,
      customCard?.characterId,
      customCard?.id,
      customCard?.displayName
    ]);
    var rawText = uniqueFeatureList(parts).join(" ");
    return {
      ids: ids,
      specialHandTags: specialHandTags,
      explicitSpecialHandTags: explicitSpecialHandTags,
      text: rawText,
      normalizedText: normalizeFeatureText(rawText),
      hasInnateTechnique: handProfile?.hasInnateTechnique !== false && !/零咒力|无术式|no_innate_technique/i.test(rawText)
    };
  }

  function splitFeatureOwnerAliases(value) {
    return uniqueFeatureList(String(value || "")
      .split(/[;；、,/／|和与及]+/g)
      .map(function trimAlias(alias) { return alias.replace(/后也使用|继承使用|占据.*后使用|夺取.*后也使用/g, "").trim(); })
      .filter(Boolean));
  }

  function getFeatureCardAliases(card) {
    var family = getFeatureCardFamily(card);
    var configuredAliases = uniqueFeatureList([]
      .concat(toFeatureList(FEATURE_TECHNIQUE_ALIASES[card?.techniqueId]))
      .concat(toFeatureList(FEATURE_TECHNIQUE_ALIASES[family])));
    var techniqueNameAliases = toFeatureList(card?.techniqueName).filter(function keepTechniqueNameAlias(alias) {
      return normalizeFeatureText(alias).length >= 3 || configuredAliases.includes(alias);
    });
    return uniqueFeatureList([]
      .concat(toFeatureList(family))
      .concat(toFeatureList(card?.techniqueId))
      .concat(toFeatureList(card?.sourceTechniqueFamily))
      .concat(toFeatureList(card?.specialHandTags))
      .concat(toFeatureList(card?.["特殊手札"]))
      .concat(techniqueNameAliases)
      .concat(toFeatureList(card?.domainName))
      .concat(splitFeatureOwnerAliases(card?.ownerOrRepresentative))
      .concat(configuredAliases));
  }

  function getFeatureCardFamily(card) {
    return toFeatureList(card?.specialHandTags)[0] ||
      toFeatureList(card?.["特殊手札"])[0] ||
      card?.sourceTechniqueFamily ||
      card?.techniqueFamily ||
      card?.techniqueId ||
      "";
  }

  function getFeatureCardSpecialHandTags(card) {
    return uniqueFeatureList([]
      .concat(toFeatureList(card?.specialHandTags))
      .concat(toFeatureList(card?.["特殊手札"])));
  }

  function getFeatureCardArchetypeRequirements() {
    return [];
  }

  function isFeatureAliasMatch(snapshot, alias) {
    var normalized = normalizeFeatureText(alias);
    if (!normalized) return false;
    var isAscii = /^[a-z0-9]+$/i.test(normalized);
    if (isAscii && normalized.length < 4) return false;
    if (!isAscii && normalized.length < 2 && !["万"].includes(alias)) return false;
    return snapshot.normalizedText.includes(normalized);
  }

  function doesFeatureCardMatchActor(card, snapshot) {
    var cardSpecialHandTags = getFeatureCardSpecialHandTags(card);
    if (!cardSpecialHandTags.length) return false;
    var actorSpecialHandTags = uniqueFeatureList(toFeatureList(snapshot?.explicitSpecialHandTags));
    if (!actorSpecialHandTags.length) return false;
    var actorTagSet = new Set(actorSpecialHandTags.map(normalizeFeatureTag).filter(Boolean));
    return cardSpecialHandTags.some(function hasStrictSpecialHandTag(tag) {
      var normalized = normalizeFeatureTag(tag);
      return normalized && actorTagSet.has(normalized);
    });
  }

  function mapFeatureCardType(intent) {
    var key = String(intent || "").toLowerCase();
    if ([
      "technique",
      "defense",
      "resource",
      "support",
      "summon",
      "domain",
      "rule",
      "basic",
      "special",
      "rule_trial",
      "rule_defense",
      "domain_maintenance",
      "domain_response",
      "curse_tool",
      "jackpot",
      "healing"
    ].includes(key)) return key;
    if (key === "defense") return "defense";
    if (key === "resource") return "resource";
    if (key === "support") return "support";
    if (key === "mobility") return "technique";
    if (key === "summon") return "technique";
    if (key === "soul") return "technique";
    if (key === "control" || key === "rule" || key === "domain") return "technique";
    return "technique";
  }

  function mapFeatureScalingProfile(card, stats) {
    var text = [
      card?.scalingProfile,
      card?.cardIntent,
      card?.cardType,
      card?.mechanicSubtype,
      card?.futureCardType,
      card?.techniqueId,
      card?.techniqueName
    ].concat(toFeatureList(card?.mechanicTags)).join(" ").toLowerCase();
    if (/咒具|cursed_tool|tool/.test(text)) return "cursed_tool";
    if (/体术|physical|melee|strike/.test(text)) return "physical";
    if (/防御|defense|guard|block/.test(text)) return "defense";
    if (/jackpot|赌|坐杀|概率|中奖/.test(text)) return "jackpot_rule";
    if (/审判|trial|verdict|evidence/.test(text)) return "trial_rule";
    if (/领域|domain|barrier/.test(text) && Number(stats?.baseDamage || 0) <= 0) return "domain";
    if (/burst|最大输出|炮|blast/.test(text)) return "ce_burst";
    return "technique";
  }

  function addFeatureNumericDelta(effects, key, delta) {
    var value = Number(delta || 0);
    if (!Number.isFinite(value) || value === 0) return;
    effects[key] = Number((Number(effects[key] || 0) + value).toFixed(4));
  }

  function buildFeatureCardEffects(card, stats) {
    var effects = {
      ...(stats?.proposedEffectFields || {}),
      ...(card?.effects || {})
    };
    var baseBlock = Number(stats?.baseBlock ?? card?.baseBlock ?? 0);
    var controlValue = Number(stats?.controlValue ?? card?.controlValue ?? card?.baseStabilityDamage ?? 0);
    var soulDamage = Number(stats?.soulDamage ?? card?.soulDamage ?? card?.baseCeDamage ?? 0);
    var domainLoadDelta = Number(stats?.domainLoadDelta ?? card?.baseDomainLoadDelta ?? card?.domainLoadDelta ?? 0);
    var durationRounds = Math.max(0, Number(stats?.durationRounds ?? card?.durationRounds ?? 0));
    if (baseBlock > 0) {
      effects.incomingHpScale = Math.min(
        Number(effects.incomingHpScale || 1),
        Number(clamp(1 - baseBlock / 120, 0.62, 0.94).toFixed(4))
      );
      addFeatureNumericDelta(effects, "stabilityDelta", clamp(baseBlock / 950, 0.012, 0.052));
    }
    if (controlValue > 0) {
      addFeatureNumericDelta(effects, "opponentStabilityDelta", -clamp(controlValue / 950, 0.008, 0.072));
      effects.opponentStatuses ||= [];
      effects.opponentStatuses.push({
        id: "featureControlPressure",
        label: "特色术式压制",
        rounds: Math.max(1, durationRounds || 1),
        value: controlValue
      });
    }
    if (soulDamage > 0) {
      effects.opponentStatuses ||= [];
      effects.opponentStatuses.push({
        id: "soulPressure",
        label: "灵魂受扰",
        rounds: Math.max(1, durationRounds || 1),
        value: soulDamage
      });
    }
    if (domainLoadDelta) addFeatureNumericDelta(effects, "domainLoadDelta", domainLoadDelta);
    if (durationRounds > 0 && !effects.durationRounds) effects.durationRounds = durationRounds;
    if (!effects.weightDeltas && (card?.cardIntent === "resource" || card?.cardIntent === "support" || card?.cardType === "resource" || card?.cardType === "support")) {
      effects.weightDeltas = { ce_compression: 0.35, defensive_frame: 0.2 };
    }
    return effects;
  }

  function toFeatureNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : Number(fallback || 0);
  }

  function buildTechniqueFeatureHandAction(card, actor, snapshot) {
    var stats = card?.balancedRuntimeStats || card?.originalCandidateRuntimeStats || {};
    var family = getFeatureCardFamily(card);
    var displayName = card?.name || card?.cardName || card?.sourceActionId || card?.cardId || "特色手札";
    var sourceActionId = card?.sourceActionId || card?.draftCardId || card?.cardId || ("feature_" + family + "_" + displayName);
    var baseDamage = toFeatureNumber(stats.baseDamage ?? card?.baseDamage, 0);
    var baseBlock = toFeatureNumber(stats.baseBlock ?? card?.baseBlock, 0);
    var controlValue = toFeatureNumber(stats.controlValue ?? card?.controlValue ?? card?.baseStabilityDamage, 0);
    var soulDamage = toFeatureNumber(stats.soulDamage ?? card?.soulDamage ?? card?.baseCeDamage, 0);
    var domainLoadDelta = toFeatureNumber(stats.domainLoadDelta ?? card?.baseDomainLoadDelta ?? card?.domainLoadDelta, 0);
    var baseDomainPressure = toFeatureNumber(stats.baseDomainPressure ?? card?.baseDomainPressure, 0);
    var specialHandTags = getFeatureCardSpecialHandTags(card);
    var tags = uniqueFeatureList([
      "特色手札",
      "术式",
      "technique_feature",
      family,
      card?.techniqueId,
      card?.techniqueName,
      card?.cardIntent,
      card?.cardType,
      card?.mechanicSubtype
    ].concat(toFeatureList(card?.tags), toFeatureList(card?.mechanicTags)));
    if (card?.soulRelated || soulDamage > 0) tags.push("灵魂");
    if (card?.summonRelated) tags.push("式神");
    if (card?.antiDomainRelated) tags.push("领域应对");
    var summonSpec = card?.summonSpec ? { ...card.summonSpec } : undefined;
    if (summonSpec?.unitCardId && !summonSpec.unitName) {
      var unitCard = getDuelSpecialCardByCardId(summonSpec.unitCardId);
      summonSpec.unitName = unitCard?.name || card?.unitName || displayName;
    }
    var action = {
      id: sourceActionId,
      sourceActionId: sourceActionId,
      cardId: card?.cardId || ("card_" + sourceActionId),
      label: displayName,
      name: displayName,
      description: card?.effectSummary || card?.shortEffect || card?.effectDraft || card?.longEffect || "按特色术式手札规则结算。",
      cardType: mapFeatureCardType(card?.cardType || card?.cardIntent),
      type: "feature_technique",
      techniqueFeatureHand: true,
      specialHandCard: true,
      normalHandOnly: true,
      draftCardId: card?.draftCardId || "",
      sourceTechniqueFamily: family,
      techniqueName: card?.techniqueName || "",
      ownerOrRepresentative: card?.ownerOrRepresentative || "",
      tags: tags,
      specialHandTags: specialHandTags,
      "特殊手札": specialHandTags,
      exclusiveToArchetypes: [],
      exclusiveToCharacters: uniqueFeatureList([].concat(toFeatureList(card?.exclusiveToCharacters))),
      exclusiveToVariants: uniqueFeatureList([].concat(toFeatureList(card?.exclusiveToVariants))),
      requiresCe: true,
      requiresInnateTechnique: true,
      requirements: {
        domainActive: "any",
        ...(card?.requirements || {}),
        blocksOnTechniqueImbalance: true
      },
      allowedContexts: Array.isArray(card?.allowedContexts) ? card.allowedContexts.slice() : ["normal"],
      apCost: Math.max(1, toFeatureNumber(stats.apCost ?? card?.apCost, 1)),
      baseCeCost: Math.max(0, toFeatureNumber(stats.baseCeCost ?? card?.baseCeCost ?? card?.ceCost ?? card?.costCe, 0)),
      baseDamage: Math.max(0, baseDamage),
      baseBlock: Math.max(0, baseBlock),
      baseStabilityDamage: controlValue > 0 ? Math.max(1, Math.round(controlValue)) : 0,
      baseCeDamage: soulDamage > 0 ? Math.max(1, Math.round(soulDamage)) : 0,
      baseShield: Math.max(0, toFeatureNumber(card?.baseShield, 0)),
      baseDefensePressure: Math.max(0, toFeatureNumber(card?.baseDefensePressure, 0)),
      baseEvidencePressure: Math.max(0, toFeatureNumber(card?.baseEvidencePressure, 0)),
      baseStabilityRestore: Math.max(0, toFeatureNumber(card?.baseStabilityRestore, 0)),
      baseCeRestore: Math.max(0, toFeatureNumber(card?.baseCeRestore, 0)),
      baseHpRestore: Math.max(0, toFeatureNumber(card?.baseHpRestore, 0)),
      baseDomainLoadDelta: domainLoadDelta,
      baseDomainPressure: Math.max(0, baseDomainPressure),
      durationRounds: Math.max(0, toFeatureNumber(stats.durationRounds ?? card?.durationRounds, 0)),
      damageType: card?.damageType || "none",
      scalingProfile: card?.scalingProfile || mapFeatureScalingProfile(card, stats),
      accuracyProfile: stats.accuracyProfile || card?.accuracyProfile || (baseDamage > 0 ? "technique_projectile" : "none"),
      evasionAllowed: card?.evasionAllowed ?? (stats.evasionAllowed !== false && baseDamage > 0),
      hitRateModifier: toFeatureNumber(stats.hitRateModifier ?? card?.hitRateModifier, 0),
      effects: buildFeatureCardEffects(card, stats),
      risk: card?.risk || (card?.riskTags?.includes("high") || card?.powerHint === "extreme" ? "high" : (card?.suggestedRarity === "rare" ? "medium" : "low")),
      rarity: card?.rarity || card?.suggestedRarity || "uncommon",
      weight: Number(card?.weight || (card?.cardIntent === "finisher" ? 4.5 : 5.25)),
      selectionWeight: Number(card?.selectionWeight || card?.weight || (card?.cardIntent === "finisher" ? 5.1 : 5.8)),
      characterHints: [],
      effectSummary: card?.effectSummary || card?.shortEffect || card?.effectDraft || "",
      costType: card?.costType || "",
      ceCostMode: card?.ceCostMode || "",
      mechanicId: card?.mechanicId || "",
      summonSpec: summonSpec,
      mechanismSpec: card?.mechanismSpec ? { ...card.mechanismSpec } : undefined,
      resourceSpec: card?.resourceSpec ? { ...card.resourceSpec } : undefined,
      serviceReceiptRules: card?.serviceReceiptRules ? { ...card.serviceReceiptRules } : undefined,
      massiveObjectRules: card?.massiveObjectRules ? { ...card.massiveObjectRules } : undefined,
      objectRules: card?.objectRules ? { ...card.objectRules } : undefined,
      unitStats: card?.unitStats ? { ...card.unitStats } : undefined,
      blockIgnoreRatio: Math.max(0, Math.min(0.9, Number(card?.blockIgnoreRatio || 0))),
      starRageEffect: card?.starRageEffect,
      starRageMassCost: card?.starRageMassCost,
      starRageSummonMassCost: card?.starRageSummonMassCost,
      starRageRecallMassCost: card?.starRageRecallMassCost,
      starRageRecallMassGain: card?.starRageRecallMassGain,
      starRageMassGain: card?.starRageMassGain,
      starRageOutgoingScale: card?.starRageOutgoingScale,
      starRageIncomingScale: card?.starRageIncomingScale,
      starRageIncomingReductionCap: card?.starRageIncomingReductionCap,
      starRageDamageReductionCap: card?.starRageDamageReductionCap,
      starRageConsumeAllMass: card?.starRageConsumeAllMass,
      starRageBlackHoleBaseDamagePerMass: card?.starRageBlackHoleBaseDamagePerMass,
      starRageBlackHoleBlockIgnorePerMass: card?.starRageBlackHoleBlockIgnorePerMass,
      starRageBlackHoleBlockIgnoreOffset: card?.starRageBlackHoleBlockIgnoreOffset,
      starRageBlackHoleSelfHpCostBaseRatio: card?.starRageBlackHoleSelfHpCostBaseRatio,
      starRageBlackHoleSelfHpCostPerMassRatio: card?.starRageBlackHoleSelfHpCostPerMassRatio,
      starRageCeControlDamageScale: card?.starRageCeControlDamageScale,
      starRageCeControlDamageScaleLimit: card?.starRageCeControlDamageScaleLimit,
      starRageCeControlMaxMultiplier: card?.starRageCeControlMaxMultiplier,
      bloodCeCostRatio: card?.bloodCeCostRatio,
      bloodHpCostRatio: card?.bloodHpCostRatio,
      bloodCeCostReduction: card?.bloodCeCostReduction,
      bloodCeControlDamageScale: card?.bloodCeControlDamageScale,
      bloodCeToBaseDamageScale: card?.bloodCeToBaseDamageScale,
      bloodHpToBaseDamageScale: card?.bloodHpToBaseDamageScale,
      bloodHpCostContributesDamage: card?.bloodHpCostContributesDamage,
      bloodOriginalBaseDamageScale: card?.bloodOriginalBaseDamageScale,
      bloodBoostDamageScale: card?.bloodBoostDamageScale,
      starRageGarudaUnit: card?.starRageGarudaUnit ? { ...card.starRageGarudaUnit } : undefined,
      projectionSorcery: card?.projectionSorcery ? { ...card.projectionSorcery } : undefined,
      specialResolution: card?.specialResolution ? { ...card.specialResolution } : undefined,
      mahoragaProxySpec: card?.mahoragaProxySpec ? { ...card.mahoragaProxySpec } : undefined,
      status: card?.status || "CANDIDATE_RUNTIME_IMPORT"
    };
    if (card?.cardIntent === "finisher") action.risk = action.risk === "high" ? "critical" : "high";
    return action;
  }

  function getFeatureCardRuntimeNumber(card, stats, statKey, fieldKey) {
    return toFeatureNumber(stats?.[statKey] ?? card?.[fieldKey], 0);
  }

  function getFeatureCardSemanticDedupeKey(card) {
    var stats = card?.balancedRuntimeStats || card?.originalCandidateRuntimeStats || {};
    var displayName = card?.name || card?.cardName || card?.sourceActionId || card?.cardId || "";
    var normalizedName = normalizeFeatureText(displayName);
    if (!normalizedName) return "";
    return [
      normalizedName,
      mapFeatureCardType(card?.cardType || card?.cardIntent),
      getFeatureCardRuntimeNumber(card, stats, "baseDamage", "baseDamage"),
      getFeatureCardRuntimeNumber(card, stats, "baseBlock", "baseBlock"),
      getFeatureCardRuntimeNumber(card, stats, "baseCeCost", "baseCeCost"),
      getFeatureCardRuntimeNumber(card, stats, "controlValue", "baseStabilityDamage"),
      getFeatureCardRuntimeNumber(card, stats, "soulDamage", "baseCeDamage"),
      getFeatureCardRuntimeNumber(card, stats, "domainLoadDelta", "baseDomainLoadDelta"),
      getFeatureCardRuntimeNumber(card, stats, "domainPressure", "baseDomainPressure"),
      getFeatureCardRuntimeNumber(card, stats, "durationRounds", "durationRounds"),
      card?.damageType || "",
      card?.scalingProfile || "",
      card?.accuracyProfile || "",
      normalizeFeatureText(card?.effectSummary || card?.shortEffect || card?.effectDraft || card?.longEffect || "")
    ].join("|");
  }

  function buildTechniqueFeatureHandActions(actor, opponent, duelState) {
    var battle = getBattle(duelState);
    var snapshot = getActorFeatureSnapshot(actor, battle);
    if (!snapshot?.normalizedText) return [];
    var matched = [];
    var seen = new Set();
    getTechniqueFeatureHandCards().forEach(function collectFeatureCard(card) {
      var family = getFeatureCardFamily(card);
      if (!family || !doesFeatureCardMatchActor(card, snapshot)) return;
      var sourceActionId = card.sourceActionId || card.draftCardId || card.cardId || "";
      var semanticKey = getFeatureCardSemanticDedupeKey(card);
      if (!sourceActionId || seen.has("id:" + sourceActionId) || (semanticKey && seen.has("semantic:" + semanticKey))) return;
      seen.add("id:" + sourceActionId);
      if (semanticKey) seen.add("semantic:" + semanticKey);
      matched.push(buildTechniqueFeatureHandAction(card, actor, snapshot));
    });
    return matched;
  }

  function isCursedSpiritActor(actor, battle, snapshot) {
    var profile = getDuelProfileForSide(battle, actor?.side || "") || actor?.characterCardProfile || actor?.profile || {};
    var text = [
      snapshot?.text,
      actor?.name,
      actor?.displayName,
      actor?.characterId,
      actor?.officialGrade,
      actor?.powerTier,
      actor?.notes,
      actor?.profile?.officialGrade,
      actor?.profile?.powerTier,
      actor?.profile?.notes,
      actor?.characterCardProfile?.officialGrade,
      actor?.characterCardProfile?.powerTier,
      actor?.characterCardProfile?.notes,
      profile?.officialGrade,
      profile?.powerTier,
      profile?.notes
    ].concat(
      toFeatureList(actor?.specialHandTags),
      toFeatureList(actor?.["特殊手札"]),
      toFeatureList(actor?.profile?.specialHandTags),
      toFeatureList(actor?.profile?.["特殊手札"]),
      toFeatureList(actor?.characterCardProfile?.specialHandTags),
      toFeatureList(actor?.characterCardProfile?.["特殊手札"]),
      toFeatureList(profile?.specialHandTags),
      toFeatureList(profile?.["特殊手札"])
    ).join(" ");
    return /特级咒灵|低级咒灵|咒灵之躯|咒灵，|咒灵\)|咒灵）|（咒灵|\(咒灵|cursed_spirit|cursedspirit|disaster_curse|disastercurse|low_grade_curse|lowgradecurse/i.test(text);
  }

  function getDuelActionIdentityText(action) {
    return [
      action?.id,
      action?.sourceActionId,
      action?.label,
      action?.name,
      action?.description,
      action?.cardType,
      action?.type,
      action?.scalingProfile
    ].concat(
      toFeatureList(action?.tags),
      toFeatureList(action?.mechanicIds)
    ).join(" ");
  }

  function isReverseCursedTechniqueAction(action) {
    if (action?.rctHealing) return true;
    var text = getDuelActionIdentityText(action).toLowerCase();
    if (/curse_regen|咒灵再生/.test(text)) return false;
    return /反转术式|rct|reverse_output|reverse_cursed_technique|正能量|疗伤|治疗/.test(text);
  }

  function isReverseCursedTechniqueOutputAction(action) {
    var text = getDuelActionIdentityText(action).toLowerCase();
    return /reverse_output|rct_output|反转输出|正能量外放|输出反转/.test(text);
  }

  function isCurseRegenerationAction(action) {
    var text = getDuelActionIdentityText(action).toLowerCase();
    return /curse_regen|咒灵再生/.test(text) || (/咒灵/.test(text) && /再生/.test(text));
  }

  function isDuelActionAllowedByActorIdentity(action, actor, battle) {
    if (!actor || !action) return true;
    if (action.specialHandCard || action.techniqueFeatureHand) return true;
    if (!isReverseCursedTechniqueAction(action) && !isCurseRegenerationAction(action)) return true;
    var snapshot = getActorFeatureSnapshot(actor, battle);
    var cursedSpirit = isCursedSpiritActor(actor, battle, snapshot);
    if (isReverseCursedTechniqueAction(action)) {
      if (cursedSpirit) return false;
      if (isReverseCursedTechniqueOutputAction(action)) return hasReverseCursedTechniqueOutputAccess(actor, battle, snapshot);
      return hasReverseCursedTechniqueAccess(actor, battle, snapshot);
    }
    if (isCurseRegenerationAction(action)) return cursedSpirit;
    return true;
  }

  function hasReverseCursedTechniqueAccess(actor, battle, snapshot) {
    var ids = snapshot?.ids || [];
    if (ids.some(function hasKnownRctId(id) { return RCT_CHARACTER_IDS.has(String(id || "")); })) return true;
    var text = snapshot?.text || "";
    return /反转术式|反转输出|正能量外放|rct_user|rct_output|reverse_output|reverse_cursed_technique|healer|self_repair|反转恢复|疗伤/i.test(text);
  }

  function hasReverseCursedTechniqueOutputAccess(actor, battle, snapshot) {
    var ids = snapshot?.ids || [];
    if (ids.some(function hasKnownRctOutputId(id) { return RCT_OUTPUT_CHARACTER_IDS.has(String(id || "")); })) return true;
    var text = snapshot?.text || "";
    return /反转输出|正能量外放|rct_output|reverse_output|healer/i.test(text);
  }

  function buildReverseCursedTechniqueActions(actor, opponent, duelState) {
    var battle = getBattle(duelState);
    var snapshot = getActorFeatureSnapshot(actor, battle);
    if (!snapshot?.normalizedText || isCursedSpiritActor(actor, battle, snapshot)) return [];
    if (!hasReverseCursedTechniqueAccess(actor, battle, snapshot)) return [];
    var hpRatio = actor?.maxHp ? Number(actor.hp || 0) / Number(actor.maxHp || 1) : 1;
    if (hpRatio >= 0.985) return [];
    var missingHp = Math.max(0, Number(actor?.maxHp || 0) - Number(actor?.hp || 0));
    var baseHealing = missingHp > 90 ? 24 : (missingHp > 45 ? 20 : 16);
    return [{
      id: "reverse_cursed_technique_heal",
      sourceActionId: "reverse_cursed_technique_heal",
      label: "反转术式疗伤",
      description: "将咒力反转为正向能量修复自身伤势，治疗量按角色咒力操控、效率、术式能力和输出修正。",
      cardType: "healing",
      type: "rct_healing",
      rctHealing: true,
      normalHandOnly: true,
      tags: ["反转术式", "rct", "正能量", "疗伤", "治疗", "支援", "resource"],
      exclusiveToCharacters: snapshot.ids || [],
      requiresCe: true,
      requirements: {
        domainActive: "any",
        requiresMissingHp: true
      },
      apCost: 1,
      baseCeCost: 20,
      baseHealing: baseHealing,
      baseBlock: 8,
      baseStabilityRestore: 20,
      durationRounds: 1,
      damageType: "none",
      scalingProfile: "healing",
      accuracyProfile: "none",
      evasionAllowed: false,
      effects: {
        incomingHpScale: 0.9,
        stabilityDelta: 0.024,
        weightDeltas: {
          sustain: 0.8,
          support: 0.65,
          resource: 0.35
        },
        selfStatus: {
          id: "rctRecovery",
          label: "反转治疗",
          rounds: 1,
          value: 1
        }
      },
      risk: "medium",
      rarity: "uncommon",
      weight: hpRatio < 0.45 ? 7.2 : 5.4,
      selectionWeight: hpRatio < 0.45 ? 8.4 : 6.1,
      effectSummary: "按基础治疗值与角色属性修正恢复体势。",
      logTemplate: "你使用反转术式疗伤，把咒力转为正向能量修复伤势。"
    }];
  }

  function hasBloodManipulationAccess(actor, battle, snapshot) {
    var activeSnapshot = snapshot || getActorFeatureSnapshot(actor, battle);
    return /blood_manipulation|赤血操术|穿血|血刃|百敛|超新星|赤鳞跃动|胀相|脹相|加茂宪纪|加茂憲紀/i.test(activeSnapshot?.text || "");
  }

  function isBloodManipulationAction(action) {
    var text = [
      action?.id,
      action?.sourceActionId,
      action?.label,
      action?.name,
      action?.description,
      action?.effectSummary,
      action?.cardType,
      action?.scalingProfile
    ].concat(
      toFeatureList(action?.tags),
      toFeatureList(action?.specialHandTags)
    ).join(" ");
    return /blood_manipulation|赤血操术|穿血|血刃|百敛|超新星|赤鳞跃动|胀相|脹相|加茂宪纪|加茂憲紀/i.test(text);
  }

  function buildBloodManipulationCoreActions(actor, duelState) {
    var battle = getBattle(duelState);
    var snapshot = getActorFeatureSnapshot(actor, battle);
    if (!hasBloodManipulationAccess(actor, battle, snapshot)) return [];
    return [{
      id: "blood_ce_to_hp",
      sourceActionId: "blood_ce_to_hp",
      label: "咒力化血",
      name: "咒力化血",
      description: "消耗固定比例咒力，按实际消耗咒力转化为体势；体势可超过上限，并为本回合穿系数蓄势。",
      cardType: "resource",
      type: "blood_manipulation_conversion",
      normalHandOnly: true,
      guaranteedPerTurn: true,
      retainedPermanent: true,
      tags: ["赤血操术", "blood_manipulation", "咒力化血", "resource"],
      specialHandTags: ["blood_manipulation"],
      exclusiveToCharacters: snapshot.ids || [],
      apCost: 1,
      baseCeCost: 0,
      baseDamage: 0,
      baseBlock: 0,
      damageType: "none",
      scalingProfile: "blood_conversion",
      bloodConversion: "ce_to_hp",
      bloodCeCostRatio: 0.26,
      bloodCeToHpEfficiency: 0.82,
      accuracyProfile: "none",
      evasionAllowed: false,
      risk: "medium",
      rarity: "special",
      weight: 99,
      selectionWeight: 999,
      effects: { weightDeltas: { resource: 0.8, sustain: 0.35 } },
      effectSummary: "消耗26%咒力，按实际消耗咒力的82%回复体势；体势可超过上限。"
    }, {
      id: "blood_hp_to_ce",
      sourceActionId: "blood_hp_to_ce",
      label: "血铸咒力",
      name: "血铸咒力",
      description: "消耗固定比例当前体势，按实际消耗体势转化为咒力；咒力可超过上限，并为本回合血系数蓄势。",
      cardType: "resource",
      type: "blood_manipulation_conversion",
      normalHandOnly: true,
      guaranteedPerTurn: true,
      retainedPermanent: true,
      tags: ["赤血操术", "blood_manipulation", "血铸咒力", "resource"],
      specialHandTags: ["blood_manipulation"],
      exclusiveToCharacters: snapshot.ids || [],
      apCost: 1,
      baseCeCost: 0,
      baseDamage: 0,
      baseBlock: 0,
      damageType: "none",
      scalingProfile: "blood_conversion",
      bloodConversion: "hp_to_ce",
      bloodHpCostRatio: 0.12,
      bloodHpToCeEfficiency: 0.96,
      selfHpCostNonlethal: true,
      accuracyProfile: "none",
      evasionAllowed: false,
      risk: "medium",
      rarity: "special",
      weight: 99,
      selectionWeight: 999,
      effects: { selfHpCostNonlethal: true, weightDeltas: { resource: 0.8, attack: 0.3 } },
      effectSummary: "消耗12%当前体势，按实际消耗体势的96%回复咒力；咒力可超过上限。"
    }];
  }

  function getBloodManipulationRoundState(battle, side) {
    if (!battle || !side) return { pierce: 0, blood: 0, round: 0 };
    battle.bloodManipulationState ||= {};
    var round = getDuelActionTurnNumber(battle);
    var state = battle.bloodManipulationState[side];
    if (!state || Number(state.round || 0) !== round) {
      state = { round: round, pierce: 0, blood: 0 };
      battle.bloodManipulationState[side] = state;
    }
    return state;
  }

  function resetBloodManipulationRoundState(battle, side) {
    if (!battle || !side) return;
    battle.bloodManipulationState ||= {};
    battle.bloodManipulationState[side] = { round: getDuelActionTurnNumber(battle), pierce: 0, blood: 0 };
    clearDuelSpecialCounterEntries(battle, side, "blood_manipulation");
  }

  function setDuelSpecialCounterEntries(battle, side, namespace, entries) {
    if (!battle || !side || !namespace) return;
    battle.duelSpecialCounterState ||= {};
    battle.duelSpecialCounterState[side] ||= {};
    var visibleEntries = (Array.isArray(entries) ? entries : []).filter(function filterCounterEntry(entry) {
      return entry && entry.label && Number.isFinite(Number(entry.value)) && Math.abs(Number(entry.value)) > 0.0001;
    });
    if (!visibleEntries.length) {
      clearDuelSpecialCounterEntries(battle, side, namespace);
      return;
    }
    battle.duelSpecialCounterState[side][namespace] = {
      namespace: namespace,
      round: getDuelActionTurnNumber(battle),
      entries: visibleEntries.map(function mapCounterEntry(entry) {
        return {
          id: entry.id || entry.label,
          label: entry.label,
          value: Number(entry.value),
          format: entry.format || "percent"
        };
      })
    };
  }

  function clearDuelSpecialCounterEntries(battle, side, namespace) {
    if (!battle?.duelSpecialCounterState?.[side] || !namespace) return;
    delete battle.duelSpecialCounterState[side][namespace];
  }

  function getBloodManipulationRuntimeConfig(action, actor, battle, overrides) {
    if (!action || !actor) return null;
    var isBlood = isBloodManipulationAction(action);
    if (!isBlood) return null;
    if (!action.bloodConversion && !hasBloodManipulationAccess(actor, battle)) return null;
    var maxCe = Math.max(0, Number(actor.maxCe || 0));
    var maxHp = Math.max(0, Number(actor.maxHp || 0));
    var currentCe = Math.max(0, Number(actor.ce || 0));
    var currentHp = Math.max(0, Number(actor.hp || 0));
    var ceCostBase = Math.max(maxCe, currentCe);
    var ceRatio = Number(action.bloodCeCostRatio ?? (action.bloodConversion === "hp_to_ce" ? 0 : 0.08));
    var hpRatio = Number(action.bloodHpCostRatio ?? (action.bloodConversion === "ce_to_hp" ? 0 : 0.055));
    var ceReduction = Math.max(0, Number(action.bloodCeCostReduction ?? 0));
    var ceCost = ceCostBase > 0 && ceRatio > 0 ? Math.max(1, Math.round(ceCostBase * ceRatio - ceReduction)) : 0;
    var hpCost = currentHp > 0 && hpRatio > 0 ? Math.max(1, Number((currentHp * hpRatio).toFixed(1))) : 0;
    if (overrides && Number.isFinite(Number(overrides.actualCeCost))) ceCost = Math.max(0, Number(overrides.actualCeCost));
    if (overrides && Number.isFinite(Number(overrides.actualHpCost))) hpCost = Math.max(0, Number(overrides.actualHpCost));
    var hpCostForDamage = action.bloodHpCostContributesDamage === false ? 0 : hpCost;
    var pierceGain = maxCe > 0 ? Math.min(0.28, (ceCost / maxCe) * 0.68) : 0;
    var bloodGain = maxHp > 0 ? Math.min(0.45, (hpCostForDamage / maxHp) * 1.25) : 0;
    var state = getBloodManipulationRoundState(battle, actor.side || "");
    var bloodPierceRatio = Math.min(0.35, Number(state.pierce || 0) + pierceGain);
    var bloodBoostRatio = Math.min(0.65, Number(state.blood || 0) + bloodGain);
    var ceToBaseDamageScale = Math.max(0, Number(action.bloodCeToBaseDamageScale ?? 0.56));
    var hpToBaseDamageScale = Math.max(0, Number(action.bloodHpToBaseDamageScale ?? 1.3));
    var originalBaseDamageScale = Math.max(0, Number(action.bloodOriginalBaseDamageScale ?? 0.55));
    var bloodBoostDamageScale = Math.max(0, Number(action.bloodBoostDamageScale ?? 1.35));
    var baseFromCost = Math.max(0, ceCost * ceToBaseDamageScale + hpCostForDamage * hpToBaseDamageScale);
    var originalBase = Math.max(0, Number(action.baseDamage || 0));
    var dynamicBaseDamage = Math.max(1, baseFromCost + originalBase * originalBaseDamageScale) * (1 + bloodBoostRatio * bloodBoostDamageScale);
    return {
      active: true,
      ceCost: ceCost,
      hpCost: hpCost,
      hpCostForDamage: Number(hpCostForDamage.toFixed(1)),
      ceCostBase: Number(ceCostBase.toFixed(1)),
      hpCostBase: Number(currentHp.toFixed(1)),
      temporaryCeOverCap: Math.max(0, Number((currentCe - maxCe).toFixed(1))),
      temporaryHpOverCap: Math.max(0, Number((currentHp - maxHp).toFixed(1))),
      bloodCeToBaseDamageScale: Number(ceToBaseDamageScale.toFixed(4)),
      bloodHpToBaseDamageScale: Number(hpToBaseDamageScale.toFixed(4)),
      pierceGain: Number(pierceGain.toFixed(4)),
      bloodGain: Number(bloodGain.toFixed(4)),
      bloodPierceRatio: Number(bloodPierceRatio.toFixed(4)),
      bloodBoostRatio: Number(bloodBoostRatio.toFixed(4)),
      dynamicBaseDamage: action.bloodConversion ? 0 : Number(dynamicBaseDamage.toFixed(1)),
      blockIgnoreRatio: Number(Math.min(0.35, bloodPierceRatio).toFixed(4))
    };
  }

  function getBloodManipulationRuntimeAction(action, actor, battle, overrides) {
    var runtime = getBloodManipulationRuntimeConfig(action, actor, battle, overrides);
    if (!runtime?.active) return action;
    return {
      ...action,
      baseCeCost: runtime.ceCost,
      costCe: runtime.ceCost,
      ceCost: runtime.ceCost,
      baseDamage: runtime.dynamicBaseDamage,
      bloodCeControlDamageScale: Number(action.bloodCeControlDamageScale ?? 0.32),
      bloodRuntime: runtime,
      bloodPierceRatio: runtime.bloodPierceRatio,
      bloodBoostRatio: runtime.bloodBoostRatio,
      blockIgnoreRatio: runtime.blockIgnoreRatio,
      effects: {
        ...(action.effects || {}),
        selfHpCostRatio: 0,
        selfHpCostFlat: runtime.hpCost,
        selfHpCostNonlethal: action.selfHpCostNonlethal !== false
      }
    };
  }

  function applyBloodManipulationConversion(action, actor, costCe, hpCost) {
    if (!action?.bloodConversion || !actor) return null;
    var beforeHp = Number(actor.hp || 0);
    var beforeCe = Number(actor.ce || 0);
    if (action.bloodConversion === "ce_to_hp") {
      var hpGain = Number((Number(costCe || 0) * Number(action.bloodCeToHpEfficiency || 0.82)).toFixed(1));
      actor.hp = Number((Number(actor.hp || 0) + hpGain).toFixed(1));
      actor.temporaryHpOverCap = Math.max(0, Number((Number(actor.hp || 0) - Number(actor.maxHp || 0)).toFixed(1)));
      if (!actor.temporaryHpOverCap) delete actor.temporaryHpOverCap;
      return { type: "ce_to_hp", hpGain: hpGain, ceGain: 0, ceSpent: Number(costCe || 0), hpSpent: 0, beforeHp: beforeHp, beforeCe: beforeCe, afterHp: actor.hp, afterCe: actor.ce, allowOverCap: true };
    }
    if (action.bloodConversion === "hp_to_ce") {
      var ceGain = Number((Number(hpCost || 0) * Number(action.bloodHpToCeEfficiency || 0.76)).toFixed(1));
      actor.ce = Number((Number(actor.ce || 0) + ceGain).toFixed(1));
      actor.temporaryCeOverCap = Math.max(0, Number((Number(actor.ce || 0) - Number(actor.maxCe || 0)).toFixed(1)));
      if (!actor.temporaryCeOverCap) delete actor.temporaryCeOverCap;
      return { type: "hp_to_ce", hpGain: 0, ceGain: ceGain, ceSpent: 0, hpSpent: Number(hpCost || 0), beforeHp: beforeHp, beforeCe: beforeCe, afterHp: actor.hp, afterCe: actor.ce, allowOverCap: true };
    }
    return null;
  }

  function syncBloodManipulationTemporaryOverCap(actor) {
    if (!actor) return;
    var hpOverCap = Math.max(0, Number((Number(actor.hp || 0) - Number(actor.maxHp || 0)).toFixed(1)));
    var ceOverCap = Math.max(0, Number((Number(actor.ce || 0) - Number(actor.maxCe || 0)).toFixed(1)));
    if (hpOverCap > 0) actor.temporaryHpOverCap = hpOverCap;
    else delete actor.temporaryHpOverCap;
    if (ceOverCap > 0) actor.temporaryCeOverCap = ceOverCap;
    else delete actor.temporaryCeOverCap;
  }

  function recordBloodManipulationConversionChange(battle, side, actor, conversion) {
    if (!battle || !actor || !conversion?.type) return;
    var sideLabel = getDuelResourceSideLabel(side);
    if (conversion.type === "ce_to_hp") {
      recordDuelResourceChange(battle, {
        side: side,
        title: "咒力化血",
        detail: sideLabel + actor.name + " 将咒力转化为体势，咒力 " + formatSignedDuelDelta(-Number(conversion.ceSpent || 0)) + "，体势 +" + Number(conversion.hpGain || 0).toFixed(1) + "；当前 " + Number(conversion.afterHp || 0).toFixed(1) + " / " + Number(actor.maxHp || 0).toFixed(1) + "。",
        type: "resource",
        delta: { ce: -Number(conversion.ceSpent || 0), hp: Number(conversion.hpGain || 0), bloodConversion: "ce_to_hp", allowOverCap: true }
      });
      return;
    }
    if (conversion.type === "hp_to_ce") {
      recordDuelResourceChange(battle, {
        side: side,
        title: "血铸咒力",
        detail: sideLabel + actor.name + " 将体势转化为咒力，体势 " + formatSignedDuelDelta(-Number(conversion.hpSpent || 0)) + "，咒力 +" + Number(conversion.ceGain || 0).toFixed(1) + "；当前 " + Number(conversion.afterCe || 0).toFixed(1) + " / " + Number(actor.maxCe || 0).toFixed(1) + "。",
        type: "resource",
        delta: { hp: -Number(conversion.hpSpent || 0), ce: Number(conversion.ceGain || 0), bloodConversion: "hp_to_ce", allowOverCap: true }
      });
    }
  }

  function addBloodManipulationRoundSpend(battle, side, runtime, costCe, hpCost) {
    if (!runtime?.active || !battle || !side) return null;
    var state = getBloodManipulationRoundState(battle, side);
    var ceScale = runtime.ceCost > 0 ? Number(costCe || 0) / runtime.ceCost : 0;
    var hpScale = runtime.hpCost > 0 ? Number(hpCost || 0) / runtime.hpCost : 0;
    state.pierce = Number(Math.min(0.35, Number(state.pierce || 0) + runtime.pierceGain * ceScale).toFixed(4));
    state.blood = Number(Math.min(0.65, Number(state.blood || 0) + runtime.bloodGain * hpScale).toFixed(4));
    setDuelSpecialCounterEntries(battle, side, "blood_manipulation", [
      { id: "blood_pierce", label: "穿", value: state.pierce, format: "percent" },
      { id: "blood_boost", label: "血", value: state.blood, format: "percent" }
    ]);
    return { pierce: state.pierce, blood: state.blood };
  }

  function isStarRageAction(action) {
    var text = collectDuelActionSearchText(action);
    return text.indexOf("star_rage") !== -1 || text.indexOf("星之怒") !== -1 || Boolean(action?.starRageEffect);
  }

  function hasStarRageAccess(actor, battle) {
    if (!actor) return false;
    var profile = getDuelProfileForSide(battle, actor.side || "") || actor.characterCardProfile || {};
    var tags = uniqueFeatureList([]
      .concat(toFeatureList(actor.specialHandTags))
      .concat(toFeatureList(actor.specialhandTags))
      .concat(toFeatureList(actor["特殊手札"]))
      .concat(toFeatureList(actor.techniqueFamilies))
      .concat(toFeatureList(actor.traits))
      .concat(toFeatureList(actor.innateTraits))
      .concat(toFeatureList(profile.specialHandTags))
      .concat(toFeatureList(profile.specialhandTags))
      .concat(toFeatureList(profile["特殊手札"]))
      .concat(toFeatureList(profile.techniqueFamilies))
      .concat(toFeatureList(profile.traits))
      .concat(toFeatureList(profile.innateTraits)));
    return tags.some(function hasTag(tag) {
      return String(tag || "").trim().toLowerCase() === "star_rage" || String(tag || "").includes("星之怒");
    });
  }

  function getStarRageMassState(battle, side) {
    if (!battle || !side) return { mass: 1, round: 0, base: 1, autoProgress: 0 };
    battle.starRageState ||= {};
    var starRageRound = getDuelActionTurnNumber(battle);
    var round = starRageRound;
    var state = battle.starRageState[side];
    if (!state) {
      state = { round: round, mass: 1, base: 1, autoProgress: 0 };
      battle.starRageState[side] = state;
    } else if (Number(state.round || 0) !== round) {
      var delta = Math.max(0, round - Number(state.round || 0));
      var autoProgress = Math.max(0, Number(state.autoProgress || 0)) + delta;
      var autoGain = Math.floor(autoProgress / 2);
      var garudaUpkeep = findStarRageGarudaUnit(battle, side) ? delta : 0;
      var massAfterUpkeep = Math.max(0, Math.max(0, Number(state.mass || 0)) - garudaUpkeep);
      state.round = round;
      state.autoProgress = autoProgress % 2;
      state.mass = Math.min(7, massAfterUpkeep + autoGain);
    } else if (state.autoProgress === undefined) {
      state.autoProgress = 0;
    }
    setDuelSpecialCounterEntries(battle, side, "star_rage", [
      { id: "star_rage_virtual_mass", label: "虚拟质量", value: state.mass, format: "number" }
    ]);
    return state;
  }

  function updateStarRageMassCounter(battle, side, state) {
    if (!battle || !side || !state) return;
    setDuelSpecialCounterEntries(battle, side, "star_rage", [
      { id: "star_rage_virtual_mass", label: "虚拟质量", value: state.mass, format: "number" }
    ]);
  }

  function grantStarRageSingleCardTurnBonus(battle, side, state) {
    if (!battle || !side || !state) return 0;
    var round = getDuelActionTurnNumber(battle);
    if (Number(state.singleCardBonusRound || 0) === round) return 0;
    state.singleCardBonusRound = round;
    var before = Number(state.mass || 0);
    state.mass = Math.min(7, before + 1);
    return Number(Math.max(0, state.mass - before).toFixed(1));
  }

  function getStarRageActionAvailability(action, actor, battle) {
    if (!isStarRageAction(action)) return { available: true, reason: "" };
    if (!hasStarRageAccess(actor, battle)) return { available: false, reason: "需要星之怒特殊手札" };
    var state = getStarRageMassState(battle, actor?.side || "");
    var mass = Number(state.mass || 0);
    var isGarudaRecall = action.starRageEffect === "garuda" && Boolean(findStarRageGarudaUnit(battle, actor?.side || ""));
    if (action.starRageEffect === "black_hole" && mass < 5) return { available: false, reason: "黑洞终局需要虚拟质量至少 5" };
    var selectedForSide = battle?.selectedHandActions?.[actor?.side || ""] || [];
    var selectedIds = selectedForSide.map(function mapSelected(entry) { return entry?.actionId || entry?.id || entry?.action?.id || ""; });
    if (action.starRageEffect === "black_hole" && selectedForSide.length > 0 && !(selectedForSide.length === 1 && selectedIds.includes(action.id))) {
      return { available: false, reason: "黑洞终局本回合不能与其他手札并用" };
    }
    var required = Math.max(0, Number(
      isGarudaRecall
        ? (action.requirements?.minRecallVirtualMass ?? action.starRageRecallMassCost ?? 0)
        : (action.requirements?.minVirtualMass ?? action.starRageSummonMassCost ?? action.starRageMassCost ?? 0)
    ));
    if (required > 0 && mass < required) return { available: false, reason: "虚拟质量不足" };
    return { available: true, reason: "" };
  }

  function getStarRageRuntimeAction(action, actor, battle) {
    if (!isStarRageAction(action) || !hasStarRageAccess(actor, battle)) return action;
    var state = getStarRageMassState(battle, actor?.side || "");
    var mass = Math.max(0, Number(state.mass || 0));
    var isGarudaRecall = action.starRageEffect === "garuda" && Boolean(findStarRageGarudaUnit(battle, actor?.side || ""));
    var runtime = {
      active: true,
      massBefore: mass,
      massCost: Math.max(0, Number(
        isGarudaRecall
          ? (action.starRageRecallMassCost ?? 0)
          : (action.starRageSummonMassCost ?? action.starRageMassCost ?? 0)
      )),
      massGain: Math.max(0, Number(
        isGarudaRecall
          ? (action.starRageRecallMassGain ?? action.starRageMassGain ?? 0)
          : (action.starRageMassGain ?? 0)
      )),
      garudaRecall: isGarudaRecall,
      consumeAllMass: Boolean(action.starRageConsumeAllMass),
      blackHoleN: action.starRageEffect === "black_hole" ? mass : 0
    };
    var next = {
      ...action,
      starRageRuntime: runtime,
      starRageCeControlDamageScale: Number(action.starRageCeControlDamageScale ?? 0.26),
      starRageCeControlDamageScaleLimit: Number(action.starRageCeControlDamageScaleLimit ?? 1),
      starRageCeControlMaxMultiplier: Number(action.starRageCeControlMaxMultiplier ?? 1.55),
      effects: { ...(action.effects || {}) }
    };
    if (action.starRageEffect === "black_hole") {
      var damagePerMass = Math.max(0, Number(action.starRageBlackHoleBaseDamagePerMass ?? 7));
      var ignorePerMass = Math.max(0, Number(action.starRageBlackHoleBlockIgnorePerMass ?? 0.1));
      var ignoreOffset = Math.max(0, Number(action.starRageBlackHoleBlockIgnoreOffset ?? 0.2));
      var selfCostBase = Math.max(0, Number(action.starRageBlackHoleSelfHpCostBaseRatio ?? 0.1));
      var selfCostPerMass = Math.max(0, Number(action.starRageBlackHoleSelfHpCostPerMassRatio ?? 0.1));
      next.baseDamage = Math.max(0, damagePerMass * runtime.blackHoleN);
      next.blockIgnoreRatio = Number(Math.max(0, runtime.blackHoleN * ignorePerMass - ignoreOffset).toFixed(4));
      next.effects.selfHpCostRatio = Number((selfCostBase + runtime.blackHoleN * selfCostPerMass).toFixed(4));
      next.effects.selfHpCostNonlethal = action.selfHpCostNonlethal !== false;
    }
    return next;
  }

  function findStarRageGarudaUnit(battle, side) {
    return getDuelBattlefieldUnits(battle).find(function findGaruda(unit) {
      return unit?.active !== false && unit.ownerSide === side && (unit.starRageGaruda || unit.name === "凰轮" || unit.cardId === "star_rage_garuda_unit");
    }) || null;
  }

  function summonStarRageGaruda(battle, side, action) {
    var round = Number(battle?.round || 0) + 1;
    var spec = action?.starRageGarudaUnit || {};
    var maxHp = Math.max(1, Number(spec.maxHp ?? 150));
    var baseDamage = Math.max(0, Number(spec.baseDamage ?? 100));
    var baseBlock = Math.max(0, Number(spec.baseBlock ?? 50));
    var damageReductionRatio = Number(clamp(Number(spec.damageReductionRatio ?? 0.5), 0, 0.95).toFixed(4));
    var blockIgnoreRatio = Number(clamp(Number(spec.blockIgnoreRatio ?? 0), 0, 0.9).toFixed(4));
    battle.starRageGarudaSeq = Math.max(0, Number(battle.starRageGarudaSeq || 0)) + 1;
    var unit = {
      id: ["star_rage_garuda_unit", side || "neutral", round, battle.starRageGarudaSeq].join("_"),
      cardId: spec.cardId || "star_rage_garuda_unit",
      sourceActionId: action?.id || action?.sourceActionId || "star_rage_garuda_unit",
      name: spec.name || "凰轮",
      label: spec.label || spec.name || "凰轮",
      side: side,
      ownerSide: side,
      controllerSide: side,
      control: spec.control || "player_controlled",
      placement: spec.placement || "shikigami_zone",
      tags: Array.isArray(spec.tags) && spec.tags.length ? spec.tags.slice() : ["星之怒", "凰轮", "式神", "star_rage", "shikigami"],
      unitStats: { maxHp: maxHp, currentHp: maxHp, baseDamage: baseDamage, baseBlock: baseBlock, damageReductionRatio: damageReductionRatio, blockIgnoreRatio: blockIgnoreRatio, damageType: spec.damageType || "shikigami_melee", accuracyProfile: spec.accuracyProfile || "melee" },
      hp: maxHp,
      maxHp: maxHp,
      baseDamage: baseDamage,
      baseBlock: baseBlock,
      damageReductionRatio: damageReductionRatio,
      blockIgnoreRatio: blockIgnoreRatio,
      damageType: spec.damageType || "shikigami_melee",
      guardRules: spec.guardRules || { protectOwner: true, interceptsOpponentAttacks: true, priority: 24 },
      targetingRules: spec.targetingRules || {},
      maintenanceCeCost: Math.max(0, Number(spec.maintenanceCeCost ?? 1)),
      active: true,
      starRageGaruda: true,
      spawnedBy: action?.id || action?.sourceActionId || "",
      spawnedRound: round,
      durationRounds: 0,
      expiresAfterRound: 0
    };
    getDuelBattlefieldUnits(battle).push(unit);
    battle.summonLog ||= [];
    battle.summonLog.unshift({ round: round, actorSide: side, actionId: action?.id || "", cardId: action?.cardId || "", unitCardId: unit.cardId, unitId: unit.id, unitName: unit.name, control: unit.control, reason: "star-rage-garuda-summon" });
    return { unit: unit, recalled: false };
  }

  function recallStarRageGaruda(battle, side, actor, action) {
    var unit = findStarRageGarudaUnit(battle, side);
    if (!unit) return null;
    unit.active = false;
    unit.recalledRound = Number(battle?.round || 0) + 1;
    battle.summonLog ||= [];
    battle.summonLog.unshift({ round: unit.recalledRound, actorSide: side, actionId: action?.id || "", unitId: unit.id, unitName: unit.name, reason: "star-rage-garuda-recall" });
    return { unit: unit, recalled: true };
  }

  function applyStarRageResolution(action, actor, battle, actorContext) {
    var runtime = action?.starRageRuntime;
    if (!runtime?.active || !battle || !actor) return null;
    var side = actor.side || "";
    var state = getStarRageMassState(battle, side);
    var beforeMass = Number(state.mass || 0);
    var consumed = runtime.consumeAllMass ? beforeMass : Math.min(beforeMass, Number(runtime.massCost || 0));
    state.mass = Math.max(0, beforeMass - consumed);
    var garuda = null;
    if (action.starRageEffect === "mass_attack") actorContext.outgoingScale *= Number(action.starRageOutgoingScale || 1.18);
    if (action.starRageEffect === "mass_defense") {
      actorContext.incomingHpScale *= Number(action.starRageIncomingScale || 0.8);
      actorContext.incomingHpReductionCap += Math.max(0, Number(action.starRageIncomingReductionCap || action.starRageDamageReductionCap || 100));
    }
    if (action.starRageEffect === "garuda") {
      var existing = findStarRageGarudaUnit(battle, side);
      if (existing) {
        garuda = recallStarRageGaruda(battle, side, actor, action);
        actorContext.incomingHpScale *= 0.8;
      } else {
        garuda = summonStarRageGaruda(battle, side, action);
      }
    }
    state.mass = Math.min(7, state.mass + Number(runtime.massGain || 0));
    var singleCardBonus = Number(action.selectedCount || 0) === 1 && !runtime.consumeAllMass && action.starRageEffect !== "garuda"
      ? grantStarRageSingleCardTurnBonus(battle, side, state)
      : 0;
    updateStarRageMassCounter(battle, side, state);
    return {
      massBefore: beforeMass,
      massAfter: state.mass,
      consumed: consumed,
      gained: Number(runtime.massGain || 0),
      singleCardBonus: singleCardBonus,
      garuda: garuda ? { recalled: Boolean(garuda.recalled), unitId: garuda.unit?.id || "", unitName: garuda.unit?.name || "凰轮" } : undefined
    };
  }

  function isProjectionSorceryAction(action) {
    var text = collectDuelActionSearchText(action);
    return text.indexOf("projection_sorcery") !== -1 || text.indexOf("投射术式") !== -1 || text.indexOf("投射咒法") !== -1 || Boolean(action?.projectionSorcery);
  }

  function hasProjectionSorceryAccess(actor, battle) {
    if (!actor) return false;
    var profile = getDuelProfileForSide(battle, actor.side || "") || actor.characterCardProfile || {};
    var tags = uniqueFeatureList([])
      .concat(toFeatureList(profile.specialHandTags))
      .concat(toFeatureList(profile["特殊手札"]))
      .concat(toFeatureList(profile.techniqueFamilies))
      .concat(toFeatureList(profile.traits));
    return tags.some(function hasTag(tag) {
      var value = String(tag || "").trim().toLowerCase();
      return value === "projection_sorcery" || value.includes("投射术式") || value.includes("投射咒法");
    });
  }

  function getProjectionSpec(action) {
    return action?.projectionSorcery || {};
  }

  function getProjectionFrameState(battle, side) {
    if (!battle || !side) return { frame: 10, min: 0, base: 10, max: 24, round: 0, turnDamage: 0 };
    battle.projectionSorceryState ||= {};
    var round = getDuelActionTurnNumber(battle);
    var state = battle.projectionSorceryState[side];
    if (!state) {
      state = { frame: 10, min: 0, base: 10, max: 24, round: round, turnDamage: 0 };
      battle.projectionSorceryState[side] = state;
    }
    state.round = round;
    state.min = Math.max(0, Number(state.min ?? 0));
    state.base = Math.max(0, Number(state.base ?? 10));
    state.max = Math.max(state.base, Number(state.max ?? 24));
    state.frame = Math.max(state.min, Math.min(state.max, Number(state.frame ?? state.base)));
    updateProjectionFrameCounter(battle, side, state);
    return state;
  }

  function updateProjectionFrameCounter(battle, side, state) {
    if (!battle || !side || !state) return;
    setDuelSpecialCounterEntries(battle, side, "projection_sorcery", [
      { id: "projection_frame_rate", label: "帧率", value: state.frame, format: "number" }
    ]);
  }

  function upsertProjectionOutOfFrameStatus(actor, scale, rounds) {
    if (!actor) return;
    actor.statusEffects ||= [];
    actor.statusEffects = actor.statusEffects.filter(function keepStatus(effect) {
      return effect?.id !== "projectionOutOfFrameMoment";
    });
    actor.statusEffects.push({
      id: "projectionOutOfFrameMoment",
      label: "出框时刻",
      category: "异常状态",
      statusType: "abnormal",
      rounds: Math.max(1, Number(rounds || 1)),
      value: Number(scale || 1.5),
      source: "projection_sorcery"
    });
  }

  function clampProjectionFrameForLock(state, round) {
    var locked = Number(state.lockoutUntilRound || 0) >= Number(round || 0);
    var maxFrame = locked ? Math.max(0, Number(state.max || 24) - 1) : Number(state.max || 24);
    state.frame = Math.max(Number(state.min || 0), Math.min(maxFrame, Number(state.frame || 0)));
    return state.frame;
  }

  function addProjectionFrames(battle, side, amount) {
    if (!battle || !side) return null;
    var state = getProjectionFrameState(battle, side);
    var round = getDuelActionTurnNumber(battle);
    state.frame = Number((Number(state.frame || 0) + Number(amount || 0)).toFixed(3));
    clampProjectionFrameForLock(state, round);
    updateProjectionFrameCounter(battle, side, state);
    return { frame: state.frame, delta: Number(amount || 0), lockoutUntilRound: state.lockoutUntilRound || 0 };
  }

  function getProjectionActionId(action) {
    return String(action?.id || action?.actionId || action?.sourceActionId || action?.cardId || "");
  }

  function getProjectionHandSealForAction(battle, side, action) {
    var id = getProjectionActionId(action);
    if (!battle || !side || !id) return null;
    var seal = battle.projectionSorcerySeals?.[side]?.[id];
    if (!seal) return null;
    if (Number(seal.expiresRound || 0) && Number(seal.expiresRound || 0) < getDuelActionTurnNumber(battle)) return null;
    return seal;
  }

  function applyProjectionRandomHandSeal(battle, sourceSide, targetSide) {
    if (!battle || !targetSide) return null;
    var handCards = (battle.handState?.[targetSide]?.cards || []).filter(function keepSealTarget(card) {
      var id = getProjectionActionId(card?.action || card);
      return id && !getProjectionHandSealForAction(battle, targetSide, card?.action || card);
    });
    if (!handCards.length) return null;
    var round = getDuelActionTurnNumber(battle);
    var sequence = Math.max(0, Number(battle.projectionSealSequence || 0)) + 1;
    battle.projectionSealSequence = sequence;
    var seed = hashDuelSeed([battle.seed || "projection", round, sourceSide, targetSide, sequence].join(":"));
    var picked = handCards[Math.abs(seed) % handCards.length];
    var action = picked?.action || picked;
    var id = getProjectionActionId(action);
    var seal = {
      actionId: id,
      label: action?.label || action?.name || id,
      sourceSide: sourceSide,
      round: round,
      expiresRound: round,
      message: "本手牌被对方效果封锁"
    };
    battle.projectionSorcerySeals ||= {};
    battle.projectionSorcerySeals[targetSide] ||= {};
    battle.projectionSorcerySeals[targetSide][id] = seal;
    picked.projectionSeal = { ...seal };
    return seal;
  }

  function isProjectionAttackAction(action) {
    var type = String(action?.cardType || action?.type || "").toLowerCase();
    return Number(action?.baseDamage || 0) > 0 || ["attack", "technique", "strike"].includes(type);
  }

  function getSelectedProjectionActions(battle, side) {
    return (battle?.selectedHandActions?.[side] || []).map(function unwrap(entry) {
      return entry?.action || entry;
    }).filter(Boolean);
  }

  function getProjectionActionAvailability(action, actor, battle) {
    var seal = getProjectionHandSealForAction(battle, actor?.side || "", action);
    if (seal) return { available: false, reason: seal.message || "本手牌被对方效果封锁" };
    if (!isProjectionSorceryAction(action)) return { available: true, reason: "" };
    if (!hasProjectionSorceryAccess(actor, battle)) return { available: false, reason: "需要投射术式特殊手札" };
    var side = actor?.side || "";
    var state = getProjectionFrameState(battle, side);
    var spec = getProjectionSpec(action);
    var selected = getSelectedProjectionActions(battle, side);
    var selectedHasSelfBind = selected.some(function hasSelfBind(entry) { return getProjectionSpec(entry).effect === "self_bind"; });
    var selectedHasAttack = selected.some(isProjectionAttackAction);
    if (spec.effect === "self_bind" && selectedHasAttack) return { available: false, reason: "自缚帧本回合不能与攻击牌并用" };
    if (spec.effect !== "self_bind" && isProjectionAttackAction(action) && selectedHasSelfBind) return { available: false, reason: "自缚帧已限制本回合攻击牌" };
    var minFrame = Math.max(0, Number(spec.minFrame ?? action.requirements?.minFrame ?? 0));
    if (minFrame > 0 && Number(state.frame || 0) < minFrame) return { available: false, reason: "帧率不足" };
    if (spec.requiresAnotherCard && selected.length < 1) return { available: false, reason: "过帧驱动需要本回合一起打出另一张牌" };
    return { available: true, reason: "" };
  }

  function getProjectionRuntimeAction(action, actor, battle) {
    if (!isProjectionSorceryAction(action) || !hasProjectionSorceryAccess(actor, battle)) return action;
    var state = getProjectionFrameState(battle, actor?.side || "");
    var selected = getSelectedProjectionActions(battle, actor?.side || "");
    var spec = getProjectionSpec(action);
    var selectedCount = Number(action.selectedCount || 0);
    if (!selectedCount) {
      selectedCount = selected.length ? Math.max(1, selected.some(function sameSelected(entry) { return getProjectionActionId(entry) === getProjectionActionId(action); }) ? selected.length : selected.length + 1) : 1;
    }
    var next = {
      ...action,
      projectionRuntime: {
        active: true,
        frameBefore: Number(state.frame || 0),
        selectedCount: selectedCount,
        effect: spec.effect || ""
      },
      effects: { ...(action.effects || {}) }
    };
    if (spec.uniqueOnlyBaseDamageBonus && selectedCount === 1) {
      next.baseDamage = Math.max(0, Number(next.baseDamage || 0) + Number(spec.uniqueOnlyBaseDamageBonus || 0));
    }
    if (spec.nonUniqueBaseDamageBonus && selectedCount > 1) {
      next.baseDamage = Math.max(0, Number(next.baseDamage || 0) + Number(spec.nonUniqueBaseDamageBonus || 0));
    }
    if (spec.blockIgnoreRatio != null) next.blockIgnoreRatio = Math.max(0, Math.min(0.9, Number(spec.blockIgnoreRatio || 0)));
    return next;
  }

  function triggerProjectionOutOfFrameIfReady(action, actor, opponent, battle, actorContext) {
    if (!hasProjectionSorceryAccess(actor, battle)) return null;
    var state = getProjectionFrameState(battle, actor?.side || "");
    var round = getDuelActionTurnNumber(battle);
    if (Number(state.frame || 0) < Number(state.max || 24)) return null;
    if (Number(state.lockoutUntilRound || 0) >= round) {
      clampProjectionFrameForLock(state, round);
      updateProjectionFrameCounter(battle, actor.side || "", state);
      return null;
    }
    var spec = getProjectionSpec(action);
    var scale = Math.max(0, Number(spec.outOfFrameDamageScale ?? 1.5));
    actorContext.outgoingScale *= scale;
    var seal = applyProjectionRandomHandSeal(battle, actor.side || "", opponent?.side || "");
    upsertProjectionOutOfFrameStatus(actor, scale, 1);
    state.frame = Number(spec.outOfFrameResetFrame ?? 10);
    state.lockoutUntilRound = round + Math.max(0, Number(spec.outOfFrameLockRounds ?? 2));
    state.lastOutOfFrameRound = round;
    updateProjectionFrameCounter(battle, actor.side || "", state);
    return { triggered: true, damageScale: scale, statusLabel: "出框时刻", frameAfter: state.frame, lockoutUntilRound: state.lockoutUntilRound, sealed: seal || undefined };
  }

  function applyProjectionImmediateEffects(action, actor, battle, actorContext) {
    if (!action?.projectionRuntime?.active || !battle || !actor) return null;
    var side = actor.side || "";
    var spec = getProjectionSpec(action);
    var result = { effect: spec.effect || "", frameBefore: getProjectionFrameState(battle, side).frame };
    if (Number(spec.frameCost || 0)) result.frameCost = addProjectionFrames(battle, side, -Math.max(0, Number(spec.frameCost))).delta;
    if (Number(spec.frameGain || 0)) result.frameGain = addProjectionFrames(battle, side, Math.max(0, Number(spec.frameGain))).delta;
    if (Number(spec.damageScale || 0)) {
      actorContext.outgoingScale *= Math.max(0, Number(spec.damageScale));
      result.damageScale = Number(spec.damageScale);
    }
    if (spec.effect === "self_bind") {
      actorContext.incomingHpScale *= Math.max(0, Number(spec.incomingHpScale ?? 0.65));
      actorContext.incomingHpReductionCap += Math.max(0, Number(spec.incomingHpReductionCap ?? 150));
      actor.statusEffects ||= [];
      actor.statusEffects.push({
        id: "projectionSelfBindFrame",
        label: "自缚帧",
        rounds: 1,
        value: 1,
        frameGainPerDamage: Number(spec.frameGainPerDamage ?? 100),
        maxFrameGain: Number(spec.maxFrameGainOnDamage ?? 3),
        gainedFrame: 0
      });
    }
    if (spec.effect === "frame_shield") {
      actor.statusEffects ||= [];
      actor.statusEffects.push({
        id: "projectionFrameShield",
        label: "帧盾",
        rounds: Math.max(1, Number(spec.shieldRounds ?? 2)),
        value: Math.max(0, Number(actor.maxHp || 0) * Number(spec.shieldMaxHpRatio ?? 0.15)),
        reflectTrueDamageRatio: Number(spec.reflectTrueDamageRatio ?? 0.1)
      });
      result.shield = Number((Math.max(0, Number(actor.maxHp || 0) * Number(spec.shieldMaxHpRatio ?? 0.15))).toFixed(1));
    }
    if (spec.effect === "overdrive") {
      var state = getProjectionFrameState(battle, side);
      state.overdriveRound = getDuelActionTurnNumber(battle);
      state.overdriveDamageThreshold = Number(spec.extraFrameIfTurnDamageOver ?? 200);
      state.overdriveFrameGain = Number(spec.extraFrameGain ?? 1);
    }
    result.frameAfter = getProjectionFrameState(battle, side).frame;
    return result;
  }

  function recordProjectionTurnDamage(battle, side, amount) {
    if (!battle || !side || Number(amount || 0) <= 0) return;
    var state = getProjectionFrameState(battle, side);
    state.turnDamageRound = getDuelActionTurnNumber(battle);
    state.turnDamage = Number((Number(state.turnDamage || 0) + Number(amount || 0)).toFixed(1));
  }

  function settleProjectionTurnFrameGain(actor, battle) {
    if (!hasProjectionSorceryAccess(actor, battle)) return null;
    var side = actor.side || "";
    var state = getProjectionFrameState(battle, side);
    var round = getDuelActionTurnNumber(battle);
    if (Number(state.settledRound || 0) === round) return null;
    var damage = Number(state.turnDamageRound || 0) === round ? Math.max(0, Number(state.turnDamage || 0)) : 0;
    var delta = damage <= 0 ? -1 : (damage <= 100 ? 2 : (damage <= 300 ? 3 : (damage <= 600 ? 6 : 8)));
    if (Number(state.overdriveRound || 0) === round && damage > Number(state.overdriveDamageThreshold || 200)) {
      delta += Number(state.overdriveFrameGain || 1);
    }
    var before = Number(state.frame || 0);
    addProjectionFrames(battle, side, delta);
    if (Number(state.frame || 0) >= Number(state.max || 24) && Number(state.lockoutUntilRound || 0) < round) {
      upsertProjectionOutOfFrameStatus(actor, 1.5, 2);
    }
    state.settledRound = round;
    state.turnDamage = 0;
    state.turnDamageRound = 0;
    state.overdriveRound = 0;
    updateProjectionFrameCounter(battle, side, state);
    return { frameBefore: before, frameAfter: state.frame, damage: damage, delta: delta, lockoutUntilRound: state.lockoutUntilRound || 0 };
  }

  function applyProjectionDamageTakenFrameGain(target, battle, appliedDamage) {
    var resource = target?.resource;
    var side = resource?.side || target?.side || "";
    if (!battle || !resource || !side || Number(appliedDamage || 0) <= 0) return null;
    var status = (resource.statusEffects || []).find(function findStatus(effect) {
      return effect?.id === "projectionSelfBindFrame";
    });
    if (!status) return null;
    var already = Math.max(0, Number(status.gainedFrame || 0));
    var maxGain = Math.max(0, Number(status.maxFrameGain ?? 3));
    var unit = Math.max(1, Number(status.frameGainPerDamage ?? 100));
    var gain = Math.min(maxGain - already, Math.floor(Number(appliedDamage || 0) / unit));
    if (gain <= 0) return null;
    status.gainedFrame = already + gain;
    return addProjectionFrames(battle, side, gain);
  }

  function applyProjectionFrameShieldReflect(defender, attacker, battle, appliedDamage) {
    if (!battle || !defender || !attacker || Number(appliedDamage || 0) <= 0) return null;
    var status = (defender.statusEffects || []).find(function findShield(effect) {
      return effect?.id === "projectionFrameShield" && Number(effect.reflectTrueDamageRatio || 0) > 0;
    });
    if (!status) return null;
    var reflected = Math.max(0, Math.round(Number(appliedDamage || 0) * Number(status.reflectTrueDamageRatio || 0)));
    if (!reflected) return null;
    var beforeHp = Number(attacker.hp || 0);
    attacker.hp = Number((beforeHp - reflected).toFixed(1));
    recordProjectionTurnDamage(battle, defender.side || "", reflected);
    return { reflected: reflected, beforeHp: beforeHp, afterHp: Number(attacker.hp || 0), source: "projection_frame_shield" };
  }

  function buildDuelActionPool(actor, opponent, duelState) {
    var battle = getBattle(duelState);
    var specialSourceActionIds = getTechniqueFeatureHandSourceActionIds();
    var baseActionTemplates = mergeDuelDomainControlActionTemplates(getDuelActionTemplateIndex().templates).filter(function removeSpecialShadowedTemplate(template) {
      return !isActionTemplateShadowedBySpecialHand(template, specialSourceActionIds);
    });
    var templates = [
      ...baseActionTemplates,
      ...buildCustomDuelSpecialActions(actor),
      ...buildBloodManipulationCoreActions(actor, battle),
      ...buildReverseCursedTechniqueActions(actor, opponent, battle),
      ...buildTechniqueFeatureHandActions(actor, opponent, battle),
      ...buildDuelDomainSpecificActions(actor, opponent, battle)
    ];
    var existingIds = new Set(templates.map(function mapTemplateId(template) {
      return template?.id || template?.sourceActionId || "";
    }).filter(Boolean));
    buildDuelCardTemplateHandActions().forEach(function addCardTemplateAction(action) {
      var id = action?.id || action?.sourceActionId || "";
      if (!id || existingIds.has(id)) return;
      templates.push(action);
      existingIds.add(id);
    });
    // 旧版本会在这里手动补一张魔虚罗调幅仪式；现在以 duel-special-card.json 为唯一来源，避免同名重复发放。
    var hasMahoragaTuningRitual = templates.some(isMahoragaTuningRitualAction) ||
      existingIds.has("mahoraga_tuning_ritual") ||
      existingIds.has("ten_shadows_mahoraga_tuning_ritual") ||
      existingIds.has("card_ten_shadows_mahoraga_tuning_ritual");
    if (!hasMahoragaTuningRitual) {
      templates.push({
        id: "mahoraga_tuning_ritual",
        sourceActionId: "mahoraga_tuning_ritual",
        label: "魔虚罗调幅仪式",
        name: "魔虚罗调幅仪式",
        cardType: "summon",
        type: "ten_shadows_ritual",
        normalHandOnly: true,
        tags: ["十影", "魔虚罗", "调幅仪式", "召唤", "式神", "仪式"],
        specialHandTags: ["ten_shadows"],
        exclusiveToArchetypes: [],
        requiresCe: true,
        requirements: { domainActive: "any" },
        apCost: 2,
        baseCeCost: 0,
        baseDamage: 0,
        costType: "percentage",
        ceCostRatio: 0.5,
        risk: "critical",
        effects: {
          activateDomain: false,
          summonMahoragaProxy: true,
          stabilityDelta: 0,
          weightDeltas: { ten_shadows_ritual: 5 }
        },
        effectSummary: "召来未调幅魔虚罗强制接手战斗。魔虚罗存活期间保护召唤者；魔虚罗死亡时召唤者落败。",
        status: "CONFIRMED"
      });
      existingIds.add("mahoraga_tuning_ritual");
    }
    return templates.filter(function filterIdentityScopedAction(template) {
      return isDuelActionAllowedByActorIdentity(template, actor, battle);
    }).map(function mapTemplate(template) {
      var runtimeTemplate = getProjectionRuntimeAction(getStarRageRuntimeAction(getBloodManipulationRuntimeAction(template, actor, battle), actor, battle), actor, battle);
      if (runtimeTemplate.domainSpecific && runtimeTemplate.available !== undefined) return runtimeTemplate;
      var availability = getDuelActionAvailability(runtimeTemplate, actor, opponent, battle);
      return {
        ...runtimeTemplate,
        costCe: availability.costCe,
        available: availability.available,
        unavailableReason: availability.reason,
        riskLabel: getDuelActionRiskLabel(runtimeTemplate, actor, opponent)
      };
    });
  }

  function buildCustomDuelSpecialActions(actor) {
    var appState = getOptionalDependency("state");
    var actorId = actor?.profileId || actor?.characterId || actor?.id || "";
    if (!actorId || !Array.isArray(appState?.customDuelCards)) return [];
    var card = appState.customDuelCards.find(function findCustomCard(item) {
      return item?.characterId === actorId || item?.id === actorId;
    });
    if (!card || !Array.isArray(card.customHandCards)) return [];
    return card.customHandCards.map(function mapCustomHand(action) {
      return {
        ...action,
        customDuelCard: true,
        available: true
      };
    });
  }

  function buildCardTemplateRuntimeEffects(card) {
    var effects = { ...(card?.effects || {}) };
    [
      "outgoingScale",
      "damageScale",
      "incomingHpScale",
      "incomingCeScale",
      "sureHitScale",
      "domainPressureScale",
      "manualAttackScale",
      "domainLoadScale",
      "selfHpCostRatio",
      "selfHpCostFlat",
      "evasionBonus"
    ].forEach(function copyRuntimeNumber(key) {
      if (card?.[key] === undefined) return;
      var value = Number(card[key]);
      if (Number.isFinite(value)) effects[key] = value;
    });
    if (card?.selfHpCostNonlethal !== undefined) {
      effects.selfHpCostNonlethal = card.selfHpCostNonlethal !== false;
    }
    if (card?.blockToIncomingScale !== undefined) {
      effects.blockToIncomingScale = Boolean(card.blockToIncomingScale);
    }
    if (card?.consumeOutgoingScaleOnDamage !== undefined) {
      effects.consumeOutgoingScaleOnDamage = card.consumeOutgoingScaleOnDamage !== false;
    }
    if (Array.isArray(card?.delayedSelfStatuses)) {
      effects.delayedSelfStatuses = card.delayedSelfStatuses.map(function cloneDelayedStatus(status) {
        return { ...(status || {}) };
      });
    }
    return effects;
  }

  function buildDuelCardTemplateHandAction(card) {
    if (!card?.sourceActionId || card.playableInHandBeta === false || card.futureTemplate) return null;
    return {
      id: card.sourceActionId,
      sourceActionId: card.sourceActionId,
      cardId: card.cardId || ("card_" + card.sourceActionId),
      label: card.name || card.sourceActionId,
      name: card.name || card.sourceActionId,
      description: card.effectSummary || "",
      cardType: card.cardType || "technique",
      type: "card_template_runtime",
      tags: Array.isArray(card.tags) ? card.tags.slice() : [],
      specialHandTags: Array.isArray(card.specialHandTags) ? card.specialHandTags.slice() : [],
      allowedContexts: Array.isArray(card.allowedContexts) ? card.allowedContexts.slice() : ["normal"],
      requirements: { ...(card.requirements || {}) },
      apCost: Number(card.apCost || 1),
      baseCeCost: Number(card.baseCeCost || card.ceCost || card.costCe || 0),
      baseDamage: Number(card.baseDamage || 0),
      baseBlock: Number(card.baseBlock || 0),
      blockIgnoreRatio: Math.max(0, Math.min(0.9, Number(card.blockIgnoreRatio || 0))),
      baseDomainLoadDelta: Number(card.baseDomainLoadDelta || 0),
      durationRounds: Number(card.durationRounds || 0),
      damageType: card.damageType || "none",
      scalingProfile: card.scalingProfile || "card_template_runtime",
      accuracyProfile: card.accuracyProfile || "none",
      evasionAllowed: card.evasionAllowed,
      hitRateModifier: Number(card.hitRateModifier || 0),
      effects: buildCardTemplateRuntimeEffects(card),
      risk: card.risk || "medium",
      rarity: card.rarity || "common",
      weight: Number(card.weight || 1),
      selectionWeight: Number(card.selectionWeight || card.weight || 1),
      effectSummary: card.effectSummary || "",
      exclusiveHandSelection: Boolean(card.exclusiveHandSelection),
      selectionLockReason: card.selectionLockReason || "",
      consumeOutgoingScaleOnDamage: card.consumeOutgoingScaleOnDamage,
      blockToIncomingScale: Boolean(card.blockToIncomingScale),
      bloodCeCostRatio: card.bloodCeCostRatio,
      bloodHpCostRatio: card.bloodHpCostRatio,
      bloodCeCostReduction: card.bloodCeCostReduction,
      bloodCeControlDamageScale: card.bloodCeControlDamageScale,
      bloodCeToBaseDamageScale: card.bloodCeToBaseDamageScale,
      bloodHpToBaseDamageScale: card.bloodHpToBaseDamageScale,
      bloodHpCostContributesDamage: card.bloodHpCostContributesDamage,
      bloodOriginalBaseDamageScale: card.bloodOriginalBaseDamageScale,
      bloodBoostDamageScale: card.bloodBoostDamageScale,
      starRageEffect: card.starRageEffect,
      starRageMassCost: card.starRageMassCost,
      starRageSummonMassCost: card.starRageSummonMassCost,
      starRageRecallMassCost: card.starRageRecallMassCost,
      starRageRecallMassGain: card.starRageRecallMassGain,
      starRageMassGain: card.starRageMassGain,
      starRageOutgoingScale: card.starRageOutgoingScale,
      starRageIncomingScale: card.starRageIncomingScale,
      starRageIncomingReductionCap: card.starRageIncomingReductionCap,
      starRageDamageReductionCap: card.starRageDamageReductionCap,
      starRageConsumeAllMass: card.starRageConsumeAllMass,
      starRageBlackHoleBaseDamagePerMass: card.starRageBlackHoleBaseDamagePerMass,
      starRageBlackHoleBlockIgnorePerMass: card.starRageBlackHoleBlockIgnorePerMass,
      starRageBlackHoleBlockIgnoreOffset: card.starRageBlackHoleBlockIgnoreOffset,
      starRageBlackHoleSelfHpCostBaseRatio: card.starRageBlackHoleSelfHpCostBaseRatio,
      starRageBlackHoleSelfHpCostPerMassRatio: card.starRageBlackHoleSelfHpCostPerMassRatio,
      starRageCeControlDamageScale: card.starRageCeControlDamageScale,
      starRageCeControlDamageScaleLimit: card.starRageCeControlDamageScaleLimit,
      starRageCeControlMaxMultiplier: card.starRageCeControlMaxMultiplier,
      starRageGarudaUnit: card.starRageGarudaUnit ? { ...card.starRageGarudaUnit } : undefined,
      projectionSorcery: card.projectionSorcery ? { ...card.projectionSorcery } : undefined,
      summonSpec: card.summonSpec ? { ...card.summonSpec } : undefined,
      mechanismSpec: card.mechanismSpec ? { ...card.mechanismSpec } : undefined,
      resourceSpec: card.resourceSpec ? { ...card.resourceSpec } : undefined,
      serviceReceiptRules: card.serviceReceiptRules ? { ...card.serviceReceiptRules } : undefined,
      massiveObjectRules: card.massiveObjectRules ? { ...card.massiveObjectRules } : undefined,
      status: card.status || "CANDIDATE"
    };
  }

  function buildDuelCardTemplateHandActions() {
    var getter = getOptionalDependency("getDuelCardTemplateIndex");
    var index = getter ? getter() : global.JJKDuelCardTemplate?.getDuelCardTemplateIndex?.();
    return (index?.cards || []).map(buildDuelCardTemplateHandAction).filter(Boolean);
  }

  function scoreDuelActionCandidate(action, actor, opponent, duelState) {
    var battle = getBattle(duelState);
    var profile = getDuelProfileForSide(battle, actor?.side || "");
    var domainResponse = getDuelDomainResponseProfile(profile || {}, actor, opponent, battle);
    var stable = Number(actor?.stability || 0);
    var ceRatio = actor?.maxCe ? Number(actor.ce || 0) / actor.maxCe : 0;
    var hpRatio = actor?.maxHp ? Number(actor.hp || 0) / actor.maxHp : 0;
    var domainRisk = actor?.domain?.threshold ? Number(actor.domain.load || 0) / actor.domain.threshold : 0;
    var seedContext = [
      battle?.battleSeed || battle?.seed || "",
      battle?.round || 0,
      actor?.side || "",
      actor?.characterId || actor?.id || actor?.name || "",
      opponent?.domain?.active ? "opponent-domain" : "no-opponent-domain",
      battle?.domainSubPhase?.type || "normal",
      action.id
    ].join("|");
    var seedJitter = (hashDuelSeed(seedContext) % 1000) / 1000;
    var score = 1 + seedJitter;
    if (!action.available) score -= 8;
    var subPhase = battle?.domainSubPhase;
    if (subPhase?.type === "trial" && !subPhase.verdictResolved) {
      if (action.domainSpecific) score += actor.side === subPhase.owner ? 4.2 : 3.9;
      if (action.id === "request_verdict") score += subPhase.verdictReady ? 5.5 : -3.5;
      if (subPhase.violenceRestricted && ["forced_output", "ce_reinforcement", "domain_expand", "domain_force_sustain", "technique_interference"].includes(action.id)) score -= 2.4;
      if (actor.side === subPhase.defender && ["defend", "challenge_evidence", "deny_charge", "delay_trial"].includes(action.id)) score += subPhase.canDefend === false ? -4 : 2.4;
      if (actor.side === subPhase.defender && action.id === "remain_silent") score += subPhase.canRemainSilent === false ? -4 : 2.4;
    }
    if (subPhase?.type === "jackpot" && !subPhase.jackpotResolved) {
      if (actor.side === subPhase.owner && action.domainSpecific) score += 4.2;
      if (action.id === "claim_jackpot") score += subPhase.jackpotReady ? 6 : -4;
      if (actor.side === subPhase.owner && ["risk_spin", "raise_probability", "advance_jackpot", "advance_jackpot_cycle"].includes(action.id)) score += 1.5;
    }
    if ((getDuelStatusEffectValue(actor, "techniqueConfiscated") > 0 || getDuelStatusEffectValue(actor, "curseTechniqueBound") > 0) && ["technique_interference", "forced_output", "domain_expand", "domain_force_sustain"].includes(action.id)) score -= 4.5;
    if ((getDuelStatusEffectValue(actor, "cursedToolConfiscated") > 0 || getDuelStatusEffectValue(actor, "toolFunctionLocked") > 0) && ["forced_output", "ce_reinforcement"].includes(action.id)) score -= 3.8;
    if (getDuelStatusEffectValue(actor, "summonSuppressed") > 0 && ["ce_reinforcement", "technique_interference", "domain_force_sustain"].includes(action.id)) score -= 2.2;
    if (getDuelStatusEffectValue(actor, "executionStateCandidate") > 0 && ["ce_reinforcement", "forced_output", "domain_clash"].includes(action.id)) score += 1.8;
    if (getDuelStatusEffectValue(actor, "jackpotStateCandidate") > 0 && ["ce_reinforcement", "defensive_frame", "ce_compression"].includes(action.id)) score += 1.6;
    if (ceRatio < 0.22) score += ["residue_reading", "defensive_frame", "ce_compression", "domain_release"].includes(action.id) ? 2.2 : -2;
    if (hpRatio < 0.38) score += action.id === "defensive_frame" ? 2.4 : 0;
    if (stable < 0.38) score += ["ce_compression", "defensive_frame", "residue_reading"].includes(action.id) ? 2.1 : -1.1;
    if (getDuelStatusEffectValue(actor, "techniqueImbalance") > 0) score += ["ce_compression", "defensive_frame", "residue_reading"].includes(action.id) ? 2 : -2.2;
    if (getDuelStatusEffectValue(actor, "ceRegenBlocked") > 0) score += action.costCe <= Math.max(8, actor.maxCe * 0.035) ? 1.3 : -1.5;
    if (Number(action.baseHealing || 0) > 0 || action.rctHealing || isCurseRegenerationAction(action)) {
      var missingHpRatio = Math.max(0, 1 - hpRatio);
      if (hpRatio < 0.72) score += Math.min(4.2, 0.8 + missingHpRatio * 5);
      if (hpRatio < 0.38) score += 1.6;
      if (action.id === "reverse_cursed_technique_heal" || action.id === "curse_regen_candidate") score += 1.8;
    }
    if (actor.domain?.active) {
      score += ["domain_compress", "domain_force_sustain", "domain_release"].includes(action.id) ? 2.4 : 0;
      if (domainRisk > 0.72) score += ["domain_compress", "domain_release"].includes(action.id) ? 2.8 : (action.id === "domain_force_sustain" ? -2.4 : 0);
    } else if (action.id === "domain_expand" && ceRatio > 0.42 && stable > 0.45) {
      score += 2;
    }
    if (opponent?.domain?.active && domainResponse.allowedDomainResponseActions.includes(action.id)) score += 2.9;
    if (ceRatio > 0.55 && hpRatio > 0.45) score += ["ce_reinforcement", "technique_interference", "forced_output"].includes(action.id) ? 0.8 : 0;
    return score;
  }

  function pickDuelActionChoices(actor, opponent, duelState, count) {
    var battle = getBattle(duelState);
    var choiceCount = count === undefined ? 3 : count;
    var pool = buildDuelActionPool(actor, opponent, battle);
    var profile = getDuelProfileForSide(battle, actor?.side || "");
    var domainResponse = getDuelDomainResponseProfile(profile || {}, actor, opponent, battle);
    var selected = [];
    function pushById(id) {
      var item = pool.find(function findAction(action) {
        return action.id === id && !selected.some(function isChosen(chosen) {
          return chosen.id === id;
        });
      });
      if (item && item.available) selected.push(item);
    }
    getDuelSubPhasePreferredActionIds(actor, battle).forEach(pushById);
    if (actor?.domain?.active) {
      var risk = actor.domain.threshold ? actor.domain.load / actor.domain.threshold : 0;
      pushById(risk > 0.68 ? "domain_release" : "domain_compress");
      pushById("domain_force_sustain");
    } else {
      pushById("domain_expand");
    }
    if (actor?.maxHp && Number(actor.hp || 0) / Number(actor.maxHp || 1) < 0.72) {
      pushById("reverse_cursed_technique_heal");
      pushById("curse_regen_candidate");
    }
    if (isDuelOpponentDomainThreat(opponent, actor, battle)) {
      domainResponse.allowedDomainResponseActions.forEach(pushById);
    }
    var ranked = pool
      .filter(function filterSelected(action) {
        return !selected.some(function isSelected(chosen) {
          return chosen.id === action.id;
        });
      })
      .sort(function sortByScore(a, b) {
        return scoreDuelActionCandidate(b, actor, opponent, battle) - scoreDuelActionCandidate(a, actor, opponent, battle);
      });
    ranked.forEach(function addAvailable(action) {
      if (selected.length >= choiceCount) return;
      if (action.available) selected.push(action);
    });
    ranked.forEach(function addFallback(action) {
      if (selected.length >= choiceCount) return;
      selected.push(action);
    });
    return selected.slice(0, choiceCount);
  }

  function getDuelSubPhasePreferredActionIds(actor, battle) {
    var activeBattle = getBattle(battle);
    var subPhase = activeBattle?.domainSubPhase;
    if (!actor || !subPhase) return [];
    if (subPhase.type === "trial" && !subPhase.verdictResolved) {
      if (actor.side === subPhase.owner) {
        if (subPhase.trialEligibility === "object_confiscation") {
          return ["object_confiscation", "tool_function_lock", "wielder_liability", "request_verdict", "rule_pressure"];
        }
        if (subPhase.trialEligibility === "redirect_to_controller") {
          return ["controller_redirect", "summon_suppression", "request_verdict", "rule_pressure", "present_evidence"];
        }
        if (subPhase.trialEligibility === "exorcism_ruling") {
          return subPhase.verdictReady
            ? ["request_verdict", "present_evidence", "rule_pressure", "advance_trial"]
            : ["present_evidence", "rule_pressure", "advance_trial", "request_verdict"];
        }
        return subPhase.verdictReady
          ? ["request_verdict", "present_evidence", "rule_pressure", "press_charge", "advance_trial"]
          : ["present_evidence", "press_charge", "advance_trial", "rule_pressure", "request_verdict"];
      }
      if (actor.side === subPhase.defender) {
        if (subPhase.trialSubjectType === "intelligent_curse") return ["curse_argument", "distort_residue", "curse_pressure", "remain_silent"];
        if (subPhase.trialSubjectType === "instinct_curse") return ["instinctive_struggle", "curse_fluctuation", "flee_exorcism"];
        if (subPhase.trialSubjectType === "shikigami") return ["proxy_denial"];
        if (subPhase.canDefend === false && subPhase.canRemainSilent === false) return [];
        return ["defend", "challenge_evidence", "remain_silent", "deny_charge", "delay_trial"];
      }
    }
    if (subPhase.type === "jackpot" && !subPhase.jackpotResolved && actor.side === subPhase.owner) {
      return subPhase.jackpotReady
        ? ["claim_jackpot", "stabilize_cycle", "advance_jackpot", "raise_probability", "risk_spin", "advance_jackpot_cycle"]
        : ["advance_jackpot", "raise_probability", "stabilize_cycle", "risk_spin", "claim_jackpot", "advance_jackpot_cycle"];
    }
    return [];
  }

  function getDuelActionRiskLabel(action, actor, opponent) {
    var rules = getDuelActionRules();
    var base = rules.riskLabels?.[action.risk] || action.risk || "风险未知";
    if (!actor) return base;
    if (!action.available && action.unavailableReason) return action.unavailableReason;
    var domainRisk = actor.domain?.threshold ? Number(actor.domain.load || 0) / actor.domain.threshold : 0;
    if (action.id === "domain_force_sustain" && domainRisk > 0.72) return "极高风险，可能领域崩解";
    if (getDuelStatusEffectValue(actor, "ceRegenBlocked") > 0 && Number(action.costCe || 0) > actor.maxCe * 0.08) return "咒力回流断裂，慎用高消耗手法";
    if (getDuelStatusEffectValue(actor, "techniqueImbalance") > 0 && ["forced_output", "domain_expand", "technique_interference"].includes(action.id)) return "术式失衡中，风险上升";
    if (opponent?.domain?.active && action.id === "domain_clash") return "高负荷，对抗领域";
    if (opponent?.domain?.active && action.id === "simple_domain_guard") return "防必中，简易领域会磨损";
    if (opponent?.domain?.active && action.id === "hollow_wicker_basket_guard") return "防必中，行动受限";
    if (opponent?.domain?.active && action.id === "falling_blossom_emotion") return "自动迎击必中";
    if (opponent?.domain?.active && action.id === "zero_ce_domain_bypass") return "零咒力必中规避";
    if (opponent?.domain?.active && action.id === "domain_survival_guard") return "缺少硬防线，硬扛领域";
    return base;
  }

  function createEmptyDuelActionContext() {
    return {
      turn: 0,
      outgoingScale: 1,
      incomingHpScale: 1,
      incomingHpReductionCap: 0,
      incomingCeScale: 1,
      sureHitScale: 1,
      domainPressureScale: 1,
      manualAttackScale: 1,
      domainLoadScale: 1,
      evasionBonus: 0,
      consumeOutgoingScaleOnDamage: true,
      weightDeltas: {},
      actionLabels: []
    };
  }

  function normalizeDuelActionContextForTurn(battle, side) {
    var turn = getDuelActionTurnNumber(battle);
    var context = battle?.actionContext?.[side];
    if (!context || Number(context.turn || 0) !== turn) {
      context = createEmptyDuelActionContext();
      context.turn = turn;
      battle.actionContext[side] = context;
      return context;
    }
    context.outgoingScale = Number(context.outgoingScale || 1);
    context.incomingHpScale = Number(context.incomingHpScale || 1);
    context.incomingHpReductionCap = Math.max(0, Number(context.incomingHpReductionCap || 0));
    context.incomingCeScale = Number(context.incomingCeScale || 1);
    context.sureHitScale = Number(context.sureHitScale || 1);
    context.domainPressureScale = Number(context.domainPressureScale || 1);
    context.manualAttackScale = Number(context.manualAttackScale || 1);
    context.domainLoadScale = Number(context.domainLoadScale || 1);
    context.evasionBonus = Number(context.evasionBonus || 0);
    context.consumeOutgoingScaleOnDamage = context.consumeOutgoingScaleOnDamage !== false;
    context.weightDeltas ||= {};
    context.actionLabels ||= [];
    return context;
  }

  function ensureDuelActionContext(battle) {
    if (!battle) return null;
    if (!battle.actionContext) {
      battle.actionContext = {
        left: createEmptyDuelActionContext(),
        right: createEmptyDuelActionContext()
      };
    }
    battle.actionContext.left ||= createEmptyDuelActionContext();
    battle.actionContext.right ||= createEmptyDuelActionContext();
    normalizeDuelActionContextForTurn(battle, "left");
    normalizeDuelActionContextForTurn(battle, "right");
    return battle.actionContext;
  }

  function getDuelActionContext(battle, side) {
    var context = battle?.actionContext?.[side];
    return context || createEmptyDuelActionContext();
  }

  function getDuelBlockIncomingHpScale(action, numericPreview, effects) {
    var block = Math.max(0, Number(numericPreview?.finalBlock || 0));
    if (!block || !action?.blockToIncomingScale && !effects?.blockToIncomingScale) return 1;
    return Number(clamp(1 - block / 140, 0.25, 0.95).toFixed(4));
  }

  function addDuelActionWeightDeltas(context, deltas) {
    Object.entries(deltas || {}).forEach(function addDelta(entry) {
      var key = entry[0];
      var value = entry[1];
      context.weightDeltas[key] = Number((Number(context.weightDeltas[key] || 0) + Number(value || 0)).toFixed(3));
    });
  }

  function isDomainActive(resource) {
    return Boolean(resource?.domain && resource.domain.active);
  }

  function getDuelActionText(action) {
    return [
      action?.id,
      action?.label,
      action?.name,
      action?.description,
      action?.effectSummary,
      action?.damageType,
      action?.scalingProfile,
      action?.cardType,
      action?.type,
      [].concat(action?.tags || []).join(" "),
      [].concat(action?.specialHandTags || []).join(" ")
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function createsBlackFlashWindow(action) {
    var effectText = [
      action?.effects?.selfStatus?.id,
      action?.effects?.selfStatus?.label,
      [].concat(action?.effects?.selfStatuses || []).map(function mapStatus(status) {
        return [status?.id, status?.label].filter(Boolean).join(" ");
      }).join(" ")
    ].filter(Boolean).join(" ");
    return /impactWindowCandidate|burstTimingWindowCandidate|blackFlashWindow|black_flash_window|爆发窗口候选|爆发时机窗口候选/i.test(effectText);
  }

  function isStrikeLikeAction(action) {
    var text;
    var cardType;
    var damageType;
    var scalingProfile;
    var baseDamage;
    var profile;

    if (!action || action.blackFlashEligible === false || action.evasionAllowed === false) return false;
    if (action.domainSpecific || action.effects?.activateDomain || action.effects?.releaseDomain || action.effects?.hutianBlackFlash) return false;
    if (createsBlackFlashWindow(action)) return false;
    text = getDuelActionText(action);
    cardType = String(action.cardType || action.type || "").toLowerCase();
    damageType = String(action.damageType || "").toLowerCase();
    scalingProfile = String(action.scalingProfile || "").toLowerCase();
    if (/domain|领域|healing|rct|反转术式|治疗|resource|support|defense|guard|防御|领域应对|domain_response/.test(cardType + " " + scalingProfile)) return false;
    if (/苍|赫|茈|blue|red|purple|解|捌|cleave|dismantle|slash|斩击|远程|远距|投射|射出|projectile|beam|光束|吸引|反转爆发|范围|area|aoe|必中|sure_hit|式神|shikigami/.test(text)) return false;
    baseDamage = Number(action.baseDamage ?? action.damage ?? 0);
    if (!(baseDamage > 0) && !action.instantKillOnHit && !action.effects?.instantKillOnHit && action.blackFlashEligible !== true) return false;
    if (action.blackFlashEligible === true) return true;
    profile = action.accuracyProfile ? String(action.accuracyProfile) : inferDuelAccuracyProfile(action);
    if (!["melee", "weapon", "execution_sword"].includes(profile)) return false;
    if (damageType === "melee" || damageType === "physical" || damageType === "cursed_tool") return true;
    if (["physical", "zero_ce", "cursed_tool", "melee", "strike"].includes(scalingProfile)) return true;
    return /strike|melee|physical|打击|体术|近身|拳|踢|肉搏|贴身|cursed_tool|咒具|刀|剑/.test(text);
  }

  function takeBlackFlashWindow(actor) {
    if (!Array.isArray(actor?.statusEffects)) return null;
    var ids = new Set(["impactWindowCandidate", "burstTimingWindowCandidate", "blackFlashWindow", "black_flash_window"]);
    var index = actor.statusEffects.findIndex(function findWindow(effect) {
      return ids.has(effect?.id);
    });
    if (index < 0) return null;
    var status = actor.statusEffects.splice(index, 1)[0];
    return status || null;
  }

  function calculateActionNumericPreview(action, actor) {
    var helper = global.JJKDuelCardTemplate?.calculateDuelCardFinalPreview;
    if (typeof helper !== "function") return null;
    try {
      var battle = getBattle();
      var runtimeAction = getProjectionRuntimeAction(getStarRageRuntimeAction(getBloodManipulationRuntimeAction(action, actor || {}, battle), actor || {}, battle), actor || {}, battle);
      var preview = helper(runtimeAction, actor || {});
      if (runtimeAction?.bloodRuntime) {
        preview = {
          ...(preview || {}),
          bloodRuntime: runtimeAction.bloodRuntime,
          base: {
            ...(preview?.base || {}),
            baseDamage: runtimeAction.baseDamage
          }
        };
      }
      if (runtimeAction?.starRageRuntime) {
        preview = {
          ...(preview || {}),
          starRageRuntime: runtimeAction.starRageRuntime,
          base: {
            ...(preview?.base || {}),
            baseDamage: runtimeAction.baseDamage
          }
        };
      }
      if (runtimeAction?.projectionRuntime) {
        preview = {
          ...(preview || {}),
          projectionRuntime: runtimeAction.projectionRuntime,
          base: {
            ...(preview?.base || {}),
            baseDamage: runtimeAction.baseDamage
          }
        };
      }
      return preview;
    } catch (error) {
      return null;
    }
  }

  function getHutianBlackFlashStacks(actor) {
    var stored = Number(actor?.hutianBlackFlashStacks || 0);
    var statusValue = getDuelStatusEffectValue(actor, "hutianBlackFlashGrowth");
    return Math.max(0, Math.floor(Number.isFinite(stored) ? Math.max(stored, statusValue) : statusValue));
  }

  function setHutianBlackFlashStacks(actor, stacks) {
    if (!actor) return;
    var value = Math.max(0, Math.floor(Number(stacks || 0)));
    actor.hutianBlackFlashStacks = value;
    actor.statusEffects = Array.isArray(actor.statusEffects) ? actor.statusEffects.filter(function keepEffect(effect) {
      return effect?.id !== "hutianBlackFlashGrowth";
    }) : [];
    if (value > 0) {
      actor.statusEffects.push({
        id: "hutianBlackFlashGrowth",
        label: "黑闪递增",
        rounds: 999,
        value: value
      });
    }
  }

  function getDuelMartialScoreForEvasion(resource) {
    var profile = resource?.characterCardProfile || {};
    var raw = profile.raw || {};
    var axes = profile.axes || {};
    return Math.max(0, Number(raw.martialScore ?? raw.bodyScore ?? axes.body ?? 0) || 0);
  }

  function getDuelHitRateFromMartialDiff(diff) {
    var value = Number(diff || 0);
    var compressed = Math.sign(value) * Math.sqrt(Math.abs(value)) * 0.055;
    return clamp(0.66 + compressed, 0.42, 0.86);
  }

  function normalizeRate(value, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    if (Math.abs(number) > 1) return number / 100;
    return number;
  }

  function inferDuelAccuracyProfile(action) {
    var cardType = String(action?.cardType || action?.type || "").toLowerCase();
    var damageType = String(action?.damageType || "").toLowerCase();
    var scalingProfile = String(action?.scalingProfile || "").toLowerCase();
    var text = [
      action?.id,
      action?.label,
      action?.name,
      action?.description,
      action?.effectSummary,
      cardType,
      damageType,
      scalingProfile,
      [].concat(action?.tags || []).join(" ")
    ].filter(Boolean).join(" ").toLowerCase();
    if (action?.evasionAllowed === false || action?.domainSpecific || action?.effects?.activateDomain || action?.effects?.releaseDomain) return "none";
    if (action?.accuracyProfile) return String(action.accuracyProfile);
    if (action?.executionSword || action?.instantKillOnHit) return "execution_sword";
    if (/范围|area|aoe|environment|swarm|散射|爆破|地形|环境/.test(text)) return "technique_area";
    if (/咒具|cursed_tool|weapon|刀|剑/.test(text) || cardType === "curse_tool" || damageType === "cursed_tool") return "weapon";
    if (/苍|赫|茈|blue|red|purple|解|捌|cleave|dismantle|slash|斩击|远程|远距|投射|射出|projectile|beam|光束|吸引|反转爆发/.test(text)) return "technique_projectile";
    if (/近身|体术|拳|踢|melee|strike|physical|black_flash/.test(text) || cardType === "attack" || cardType === "basic") return "melee";
    if (cardType === "technique" || cardType === "ce_burst" || cardType === "special" || cardType === "soul_pressure") return "technique_projectile";
    return "melee";
  }

  function getDuelAccuracyProfileConfig(profile) {
    var key = String(profile || "none");
    var configs = {
      melee: { hitBonus: 0, min: 0.25, max: 0.9, damageScaleOnMiss: 0, ceScaleOnMiss: 0, stabilityScaleOnMiss: 0 },
      weapon: { hitBonus: 0.02, min: 0.25, max: 0.92, damageScaleOnMiss: 0, ceScaleOnMiss: 0, stabilityScaleOnMiss: 0 },
      execution_sword: { hitBonus: 0.12, min: 0.28, max: 0.95, damageScaleOnMiss: 0, ceScaleOnMiss: 0, stabilityScaleOnMiss: 0 },
      technique_projectile: { hitBonus: 0.08, min: 0.3, max: 0.94, damageScaleOnMiss: 0.18, ceScaleOnMiss: 0.25, stabilityScaleOnMiss: 0.25 },
      technique_area: { hitBonus: 0.23, min: 0.42, max: 0.95, damageScaleOnMiss: 0.45, ceScaleOnMiss: 0.5, stabilityScaleOnMiss: 0.5 }
    };
    return configs[key] || null;
  }

  function rollDuelEvasionRandom(battle, label) {
    var value = typeof battle?.rng === "function" ? battle.rng() : Math.random();
    if (battle) {
      battle.randomLog ||= [];
      battle.randomLog.push({
        round: Number(battle.round || 0) + 1,
        label: label || "evasion",
        value: Number(value.toFixed(8))
      });
    }
    return value;
  }

  function showDuelFloatingCombatText(battle, text, type, side) {
    var now = Date.now();
    if (!battle) return;
    battle.floatingCombatText = {
      text: text || "Miss!",
      type: type || "miss",
      side: side || "",
      createdAt: now,
      expiresAt: now + 1000
    };
  }

  function resolveDuelActionEvasion(action, actor, opponent, battle, options) {
    var profile = inferDuelAccuracyProfile(action);
    var config = getDuelAccuracyProfileConfig(profile);
    var attackerMartial;
    var defenderMartial;
    var diff;
    var baseRate;
    var hitRate;
    var roll;
    var onMiss = action?.onMiss || {};
    var defenderContext;
    var evasionBonus;
    if (!config || !action || !actor || !opponent || !battle) {
      return { checked: false, evaded: false, profile: profile || "none", hitRate: 1, roll: 0 };
    }
    if (options?.damage <= 0 && !action.instantKillOnHit && !action.effects?.instantKillOnHit) {
      return { checked: false, evaded: false, profile: profile, hitRate: 1, roll: 0 };
    }
    attackerMartial = getDuelMartialScoreForEvasion(actor);
    defenderMartial = getDuelMartialScoreForEvasion(opponent);
    defenderContext = getDuelActionContext(battle, opponent.side);
    evasionBonus = Math.max(0, Number(defenderContext.evasionBonus || 0));
    diff = attackerMartial - defenderMartial;
    baseRate = normalizeRate(action.baseHitRate ?? action.accuracyBaseRate, getDuelHitRateFromMartialDiff(diff));
    hitRate = clamp(
      baseRate +
      Number(config.hitBonus || 0) +
      normalizeRate(action.hitRateModifier ?? action.accuracyModifier ?? action.effects?.hitRateModifier, 0) -
      evasionBonus,
      Number(config.min || 0.05),
      Number(config.max || 0.96)
    );
    roll = rollDuelEvasionRandom(battle, "evasion:" + (action.id || action.label || profile));
    return {
      checked: true,
      evaded: roll > hitRate,
      profile: profile,
      hitRate: Number(hitRate.toFixed(4)),
      roll: Number(roll.toFixed(4)),
      attackerMartial: Number(attackerMartial.toFixed(2)),
      defenderMartial: Number(defenderMartial.toFixed(2)),
      martialDiff: Number(diff.toFixed(2)),
      defenderEvasionBonus: Number(evasionBonus.toFixed(4)),
      damageScaleOnMiss: normalizeRate(onMiss.damageScale, config.damageScaleOnMiss),
      ceScaleOnMiss: normalizeRate(onMiss.ceDamageScale, config.ceScaleOnMiss),
      stabilityScaleOnMiss: normalizeRate(onMiss.stabilityScale, config.stabilityScaleOnMiss),
      keepCardOnMiss: Boolean(onMiss.keepCard || action.executionSword || action.retainedPermanent || action.noRefresh)
    };
  }

  function getDuelBattlefieldUnits(battle) {
    if (!battle) return [];
    if (!Array.isArray(battle.battlefieldUnits)) battle.battlefieldUnits = [];
    return battle.battlefieldUnits;
  }

  function cloneDuelPlain(value) {
    if (value == null || typeof value !== "object") return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return Array.isArray(value) ? value.slice() : { ...value };
    }
  }

  function getDuelCardTemplateByCardId(cardId) {
    var getter = getOptionalDependency("getDuelCardTemplateIndex");
    var index = getter ? getter() : global.JJKDuelCardTemplate?.getDuelCardTemplateIndex?.();
    var cards = Array.isArray(index?.cards) ? index.cards : [];
    return cards.find(function findCard(card) {
      return card?.cardId === cardId || card?.sourceActionId === cardId;
    }) || getDuelSpecialCardByCardId(cardId);
  }

  function buildDuelGeneratedHandAction(card, sourceAction, round) {
    if (!card?.sourceActionId) return null;
    return {
      id: card.sourceActionId,
      actionId: card.sourceActionId,
      sourceActionId: card.sourceActionId,
      cardId: card.cardId || ("card_" + card.sourceActionId),
      label: card.name || card.sourceActionId,
      description: card.effectSummary || "",
      type: card.cardType || "maintenance",
      cardType: card.cardType || "maintenance",
      tags: Array.isArray(card.tags) ? card.tags.slice() : [],
      apCost: Number(card.apCost || 0),
      costCe: Number(card.baseCeCost || card.ceCost || 0),
      baseCeCost: Number(card.baseCeCost || card.ceCost || 0),
      baseDamage: Number(card.baseDamage || 0),
      baseBlock: Number(card.baseBlock || 0),
      risk: card.risk || sourceAction?.risk || "medium",
      effectSummary: card.effectSummary || "",
      maintenanceSpec: cloneDuelPlain(card.maintenanceSpec),
      generatedBy: card.generatedBy || sourceAction?.id || sourceAction?.sourceActionId || "",
      generatedRound: round,
      handSource: "generated-maintenance",
      retainedPermanent: true,
      noRefresh: true,
      playableGeneratedCard: true,
      selectionWeight: 999,
      weight: 999
    };
  }

  function injectDuelGeneratedHandCard(battle, side, card, sourceAction) {
    if (!battle || !side || !card) return null;
    battle.handState ||= {};
    battle.handState[side] ||= { cards: [], discardPile: [], round: 0, lastDrawn: [], lastInjected: [] };
    var hand = battle.handState[side];
    var id = card.sourceActionId || card.cardId || "";
    if (!id) return null;
    var existing = (hand.cards || []).find(function findExisting(entry) {
      return (entry?.actionId || entry?.id || entry?.action?.id || "") === id;
    });
    if (existing) return existing;
    var generated = buildDuelGeneratedHandAction(card, sourceAction, Number(battle.round || 0) + 1);
    if (!generated) return null;
    hand.cards = Array.isArray(hand.cards) ? hand.cards : [];
    hand.cards.unshift(generated);
    hand.lastInjected = [{ actionId: generated.id, label: generated.label, reason: "summon-maintenance" }].concat(hand.lastInjected || []).slice(0, 8);
    return generated;
  }

  function applyDuelSummonAction(action, actor, battle) {
    var summonSpec = action?.summonSpec;
    if (!summonSpec?.unitCardId || !actor || !battle) return null;
    var unitTemplate = getDuelCardTemplateByCardId(summonSpec.unitCardId);
    var unitStats = cloneDuelPlain(unitTemplate?.unitStats || action.unitStats || {});
    var ownerSide = actor.side || "";
    var round = Number(battle.round || 0) + 1;
    var unitId = [summonSpec.unitCardId, ownerSide || "neutral", round, getDuelBattlefieldUnits(battle).length + 1].join("_");
    var control = summonSpec.control || unitStats.control || "player_controlled";
    var side = control === "neutral_uncontrolled" || control === "neutral_berserk" ? "neutral" : ownerSide;
    var baseDamage = Number(unitStats.baseDamage || unitTemplate?.baseDamage || 0);
    var maxHp = Number(unitStats.maxHp || unitStats.currentHp || unitTemplate?.baseHp || 0);
    var guardRules = cloneDuelPlain(unitTemplate?.guardRules || {});
    var targetingRules = cloneDuelPlain(unitTemplate?.targetingRules || {});
    var isFriendlyControlled = side !== "neutral" && control !== "neutral_uncontrolled" && control !== "neutral_berserk";
    if (isFriendlyControlled && targetingRules.neverCountsAsGuard !== true && guardRules.neverCountsAsGuard !== true) {
      guardRules.protectOwner = guardRules.protectOwner !== false;
      guardRules.interceptsOpponentAttacks = guardRules.interceptsOpponentAttacks !== false;
      guardRules.priority = Number(guardRules.priority ?? unitStats.guardPriority ?? 10);
    }
    var maintenanceCeCost = Number(
      summonSpec.maintenanceCeCost ??
      unitStats.maintenanceCeCost ??
      unitTemplate?.maintenanceCeCost ??
      Math.ceil(baseDamage * 0.32 + maxHp * 0.035)
    );
    var unit = {
      id: unitId,
      cardId: unitTemplate?.cardId || summonSpec.unitCardId,
      sourceActionId: unitTemplate?.sourceActionId || summonSpec.unitCardId,
      name: unitTemplate?.name || summonSpec.unitName || summonSpec.unitCardId,
      label: unitTemplate?.name || summonSpec.unitName || summonSpec.unitCardId,
      side: side,
      ownerSide: ownerSide,
      controllerSide: side === "neutral" ? "" : ownerSide,
      control: control,
      placement: summonSpec.placement || unitStats.placement || "battlefield",
      tags: Array.isArray(unitTemplate?.tags) ? unitTemplate.tags.slice() : [],
      unitStats: unitStats,
      hp: maxHp,
      maxHp: maxHp,
      baseDamage: baseDamage,
      damageType: unitTemplate?.damageType || "",
      targetingRules: targetingRules,
      guardRules: guardRules,
      adaptationRules: cloneDuelPlain(unitTemplate?.adaptationRules || {}),
      matchupModifiers: cloneDuelPlain(unitTemplate?.matchupModifiers || {}),
      baseStats: cloneDuelPlain(unitStats.baseStats || unitTemplate?.baseStats || {}),
      raw: cloneDuelPlain(unitStats.raw || unitTemplate?.raw || {}),
      axes: cloneDuelPlain(unitStats.axes || unitTemplate?.axes || {}),
      attackProfile: cloneDuelPlain(unitStats.attackProfile || unitTemplate?.attackProfile || {}),
      maintenanceCeCost: Math.max(1, Number.isFinite(maintenanceCeCost) ? Math.round(maintenanceCeCost) : 1),
      lastMaintenanceRound: 0,
      active: true,
      spawnedBy: action.id || action.sourceActionId || "",
      spawnedRound: round,
      durationRounds: Math.max(0, Number(summonSpec.durationRounds ?? unitTemplate?.durationRounds ?? action.durationRounds ?? 0) || 0),
      expiresAfterRound: Math.max(0, Number(summonSpec.durationRounds ?? unitTemplate?.durationRounds ?? action.durationRounds ?? 0) || 0)
        ? round + Math.max(0, Number(summonSpec.durationRounds ?? unitTemplate?.durationRounds ?? action.durationRounds ?? 0) || 0) - 1
        : 0
    };
    getDuelBattlefieldUnits(battle).push(unit);
    var maintenanceCard = null;
    if (summonSpec.requiresMaintenanceCardId) {
      maintenanceCard = injectDuelGeneratedHandCard(battle, ownerSide, getDuelCardTemplateByCardId(summonSpec.requiresMaintenanceCardId), action);
    }
    battle.summonLog ||= [];
    battle.summonLog.unshift({
      round: round,
      actorSide: ownerSide,
      actionId: action.id || "",
      sourceActionId: action.sourceActionId || "",
      cardId: action.cardId || "",
      unitCardId: summonSpec.unitCardId || "",
      unitId: unit.id,
      unitName: unit.name,
      control: control,
      maintenanceActionId: maintenanceCard?.id || "",
      maintenanceCeCost: unit.maintenanceCeCost,
      uniqueTenShadowsSummon: isTenShadowsUniqueShikigamiAction(action)
    });
    markTenShadowsShikigamiSummoned(battle, ownerSide, action, unit);
    return { unit: unit, maintenanceCard: maintenanceCard };
  }

  function cleanupExpiredDuelBattlefieldUnits(battle, round) {
    var currentRound = Number(round || battle?.round || 0) + 1;
    return getDuelBattlefieldUnits(battle).filter(function cleanup(unit) {
      if (!unit?.active) return false;
      var expiresAfterRound = Number(unit.expiresAfterRound || 0);
      if (!expiresAfterRound || currentRound <= expiresAfterRound) return false;
      unit.active = false;
      unit.expiredRound = currentRound;
      battle.summonLog ||= [];
      battle.summonLog.unshift({
        round: currentRound,
        unitId: unit.id || "",
        unitName: unit.name || unit.label || "",
        ownerSide: unit.ownerSide || "",
        reason: "duration-expired"
      });
      return true;
    });
  }

  function getFriendlyAssistSummonUnits(battle, side) {
    return getDuelBattlefieldUnits(battle).filter(function keepUnit(unit) {
      if (!unit?.active || unit.side === "neutral") return false;
      if ((unit.controllerSide || unit.ownerSide || unit.side) !== side) return false;
      if (unit.control === "neutral_uncontrolled" || unit.control === "neutral_berserk") return false;
      return Number(unit.baseDamage || unit.unitStats?.baseDamage || 0) > 0;
    });
  }

  function applyDuelSummonUpkeep(actor, battle) {
    var side = actor?.side || "";
    if (!side || !battle) return null;
    var round = Number(battle.round || 0) + 1;
    var units = getDuelBattlefieldUnits(battle).filter(function keepUnit(unit) {
      if (!unit?.active || unit.side === "neutral") return false;
      if ((unit.controllerSide || unit.ownerSide || unit.side) !== side) return false;
      if (unit.control === "neutral_uncontrolled" || unit.control === "neutral_berserk") return false;
      if (Number(unit.lastMaintenanceRound || 0) === round) return false;
      return Number(unit.maintenanceCeCost || unit.unitStats?.maintenanceCeCost || 0) > 0;
    });
    if (!units.length) return null;
    var paid = [];
    var dismissed = [];
    units.forEach(function maintainUnit(unit) {
      var cost = Math.max(1, Number(unit.maintenanceCeCost || unit.unitStats?.maintenanceCeCost || 1));
      var beforeCe = Number(actor.ce || 0);
      if (beforeCe >= cost) {
        actor.ce = Number((beforeCe - cost).toFixed(1));
        unit.lastMaintenanceRound = round;
        paid.push({ id: unit.id || "", name: unit.name || unit.label || "", costCe: cost });
      } else {
        unit.active = false;
        unit.dismissedRound = round;
        unit.dismissedReason = "maintenance-ce-shortage";
        dismissed.push({ id: unit.id || "", name: unit.name || unit.label || "", requiredCe: cost, availableCe: beforeCe });
      }
    });
    if (!paid.length && !dismissed.length) return null;
    battle.summonLog ||= [];
    battle.summonLog.unshift({
      round: round,
      actorSide: side,
      reason: "summon-maintenance-upkeep",
      paid: paid,
      dismissed: dismissed
    });
    return { round: round, side: side, paid: paid, dismissed: dismissed };
  }

  function applyDuelSummonAssist(actor, opponent, battle) {
    var side = actor?.side || "";
    if (!side || !battle) return null;
    var round = Number(battle.round || 0) + 1;
    battle.summonAssistState ||= {};
    if (Number(battle.summonAssistState[side] || 0) === round) return null;
    var units = getFriendlyAssistSummonUnits(battle, side);
    if (!units.length) return null;
    var attacks = [];
    var totalDamage = 0;
    var totalStabilityShock = 0;
    units.forEach(function attackWithUnit(unit) {
      var count = Math.max(1, Math.min(3, Math.round(Number(unit.unitStats?.actionsPerRound || unit.actionsPerRound || 1))));
      for (var index = 0; index < count; index += 1) {
        var attack = resolveDuelSummonUnitAttack(unit, actor, opponent, battle, round, index);
        if (attack) {
          attacks.push(attack);
          totalDamage += Number(attack.damageApplied || 0);
          totalStabilityShock += Number(attack.stabilityShock || 0);
        }
      }
    });
    if (!attacks.length) return null;
    battle.summonAssistState[side] = round;
    var result = {
      round: round,
      side: side,
      damage: Number(totalDamage.toFixed(1)),
      stabilityShock: Number(totalStabilityShock.toFixed(4)),
      attacks: attacks.slice(0, 12),
      units: units.map(function mapUnit(unit) {
        return { id: unit.id || "", name: unit.name || unit.label || "", baseDamage: Number(unit.baseDamage || unit.unitStats?.baseDamage || 0), actionsPerRound: Number(unit.unitStats?.actionsPerRound || unit.actionsPerRound || 1) };
      }).slice(0, 6)
    };
    battle.summonLog ||= [];
    battle.summonLog.unshift({
      round: round,
      actorSide: side,
      reason: "friendly-summon-assist",
      damage: result.damage,
      attacks: result.attacks,
      units: result.units
    });
    return result;
  }

  function getDuelSummonUnitMartialScore(unit) {
    var raw = unit?.raw || unit?.unitStats?.raw || {};
    var axes = unit?.axes || unit?.unitStats?.axes || {};
    return Math.max(0, Number(raw.martialScore ?? raw.bodyScore ?? axes.body ?? 0) || 0);
  }

  function calculateDuelSummonUnitHitRate(unit, opponent) {
    var attackerMartial = getDuelSummonUnitMartialScore(unit);
    var defenderMartial = getDuelMartialScoreForEvasion(opponent);
    var profile = unit?.attackProfile || unit?.unitStats?.attackProfile || {};
    var baseRate = getDuelHitRateFromMartialDiff(attackerMartial - defenderMartial);
    var modifier = normalizeRate(profile.hitRateModifier, 0);
    return {
      hitRate: clamp(baseRate + modifier, 0.05, 0.96),
      attackerMartial: attackerMartial,
      defenderMartial: defenderMartial
    };
  }

  function isDuelCurseTarget(resource) {
    var text = [resource?.name, resource?.label, resource?.characterCardProfile?.name, resource?.characterCardProfile?.pool, resource?.characterCardProfile?.description].filter(Boolean).join(" ");
    return Boolean(resource?.characterCardProfile?.isCurse || /咒灵|curse/i.test(text));
  }

  function resolveDuelSummonUnitAttack(unit, actor, opponent, battle, round, attackIndex) {
    var baseDamage = Math.max(0, Number(unit?.baseDamage || unit?.unitStats?.baseDamage || 0));
    if (!baseDamage || !opponent) return null;
    var profile = unit?.attackProfile || unit?.unitStats?.attackProfile || {};
    var blockIgnoreRatio = Math.max(0, Math.min(0.9, Number(unit?.blockIgnoreRatio ?? unit?.unitStats?.blockIgnoreRatio ?? profile.blockIgnoreRatio ?? 0)));
    var damage = Math.round(baseDamage * Math.max(0, Number(profile.damageScale || 1)));
    if (Number(profile.curseDamageMultiplier || 0) > 1 && isDuelCurseTarget(opponent)) {
      damage = Math.round(damage * Number(profile.curseDamageMultiplier));
    }
    var hit = calculateDuelSummonUnitHitRate(unit, opponent);
    var roll = rollDuelEvasionRandom(battle, "summon-unit:" + (unit.id || unit.cardId || unit.name || "unit") + ":" + round + ":" + attackIndex);
    var evaded = roll > hit.hitRate;
    var action = {
      id: "summon_unit_attack_" + (unit.id || unit.cardId || "unit") + "_" + attackIndex,
      label: (unit.name || unit.label || "式神") + "·独立攻击",
      cardType: "summon_unit_attack",
      damageType: unit.damageType || unit.unitStats?.damageType || "shikigami",
      accuracyProfile: profile.accuracyProfile || "melee",
      baseDamage: baseDamage,
      blockIgnoreRatio: blockIgnoreRatio,
      effects: {},
      targetPlan: unit.targetingRules || {}
    };
    var target = resolveDuelDamageTarget(action, actor, opponent, battle, { damage: evaded ? 0 : damage, summonUnitAttack: true });
    var application = evaded ? null : applyDuelHpDamageToTarget(target, damage, battle, { blockIgnoreRatio: blockIgnoreRatio });
    var stabilityShock = evaded || target?.type === "unit" ? 0 : Math.min(0.08, Number((damage / 650).toFixed(4)));
    if (stabilityShock > 0) {
      opponent.stability = Number(clamp(Number(opponent.stability || 0) - stabilityShock, 0, 1).toFixed(4));
    }
    return {
      unitId: unit.id || "",
      unitName: unit.name || unit.label || "",
      attackIndex: attackIndex + 1,
      baseDamage: baseDamage,
      damage: damage,
      damageApplied: application ? Number(application.applied || 0) : 0,
      evaded: evaded,
      hitRate: Number(hit.hitRate.toFixed(4)),
      roll: Number(roll.toFixed(4)),
      attackerMartial: Number(hit.attackerMartial.toFixed(2)),
      defenderMartial: Number(hit.defenderMartial.toFixed(2)),
      blockIgnoreRatio: blockIgnoreRatio ? Number(blockIgnoreRatio.toFixed(4)) : undefined,
      target: target ? { type: target.type, id: target.id || "", name: target.name || "", intercepted: Boolean(target.intercepted), selectionMode: target.selectionMode || "" } : undefined,
      damageApplication: application || undefined,
      stabilityShock: Number(stabilityShock.toFixed(4)),
      attackType: profile.attackType || ""
    };
  }

  function isMahoragaTuningRitualAction(action) {
    var text = [
      action?.id,
      action?.sourceActionId,
      action?.cardId,
      action?.label,
      action?.name,
      action?.effectSummary
    ].filter(Boolean).join(" ");
    return /mahoraga_tuning_ritual|魔虚罗调幅仪式|魔须罗调幅仪式|调幅魔须罗仪式|调幅仪式/.test(text)
      && /mahoraga|魔虚罗|魔须罗/.test(text);
  }

  var MAHORAGA_PROXY_BASE_STATS = Object.freeze({
    cursedEnergy: "SS",
    control: "S",
    efficiency: "S",
    body: "SSS",
    martial: "SSS",
    talent: "SS"
  });

  var MAHORAGA_PROXY_BASE_RAW = Object.freeze({
    cursedEnergyScore: 7.4,
    controlScore: 6.2,
    efficiencyScore: 6.2,
    bodyScore: 8.8,
    martialScore: 8.8,
    talentScore: 7.4
  });

  var MAHORAGA_PROXY_AXES = Object.freeze({
    jujutsu: 6.9,
    body: 8.8,
    insight: 7.55,
    build: 8.2
  });

  function createMahoragaProxyProfile(sourceProfile, side) {
    var original = sourceProfile || {};
    var name = "八握剑异戒神将 魔虚罗";
    var originalFlags = Array.isArray(original.flags) ? original.flags : [];
    var originalTags = Array.isArray(original.tags) ? original.tags : [];
    return {
      ...original,
      id: "builtin_mahoraga_proxy_" + (side || "side"),
      characterId: "builtin_mahoraga_proxy_" + (side || "side"),
      name: name,
      displayName: name,
      officialGrade: "特级式神",
      visibleGrade: "specialGrade",
      grade: "specialGrade",
      powerTier: "specialGrade",
      baseStats: { ...MAHORAGA_PROXY_BASE_STATS },
      raw: { ...MAHORAGA_PROXY_BASE_RAW },
      axes: { ...MAHORAGA_PROXY_AXES },
      combatScore: 8.8,
      combatPowerUnit: {
        label: "5,200",
        value: 5200,
        band: "special",
        scoreBasis: 8.8,
        formula: "mahoraga builtin proxy profile"
      },
      disruptionScore: Math.max(8.2, Number(original?.disruptionScore || 0)),
      disruptionUnit: {
        label: "特级适应压制",
        value: Math.max(4200, Number(original?.disruptionUnit?.value || 0))
      },
      pool: "builtin_shikigami",
      flags: Array.from(new Set(originalFlags.concat([
        "mahoragaProxy",
        "shikigami",
        "ten_shadows",
        "adaptive",
        "physicalMonster"
      ]))),
      tags: Array.from(new Set(originalTags.concat(["十影", "魔虚罗", "式神", "调幅代打"]))),
      traits: ["完全适应", "八握剑", "魔虚罗代打中"],
      description: "调幅仪式后替代术师参战。会记录对手攻击手札，同名手札每命中一次都会降低后续伤害，第 6 次起归零。"
    };
  }

  function isUnfinishedTenShadowsDomainTarget(opponent, battle) {
    if (!opponent || !isDomainActive(opponent)) return false;
    var profile = getDuelProfileForSide(battle, opponent.side) || opponent.characterCardProfile || {};
    var domainState = battle?.domainProfileStates?.[opponent.side] || {};
    var text = [
      profile?.id,
      profile?.name,
      profile?.displayName,
      profile?.domainProfile,
      profile?.techniqueText,
      profile?.externalResource,
      domainState?.domainName,
      domainState?.barrierType,
      domainState?.domainCompletion,
      domainState?.effectSummary,
      opponent.domain?.name,
      opponent.domain?.label
    ].filter(Boolean).join(" ");
    return /伏黑惠|megumi|十种影|十影|ten[_\s-]?shadows|嵌合暗翳庭/i.test(text)
      && /未完成|不完全|incomplete|incomplete_barrier|嵌合暗翳庭/i.test(text);
  }

  function applyRecontractUnfinishedTenShadowsResolution(action, actor, opponent, battle, directDamage) {
    var rule = action?.specialResolution?.unfinishedTenShadowsDomainRule;
    if (!rule) return null;
    if (isDomainActive(actor)) return null;
    if (!isUnfinishedTenShadowsDomainTarget(opponent, battle)) return null;
    var multiplier = Number(rule.damageMultiplier || 1);
    var adjustedDamage = Math.max(0, Math.round(Number(directDamage || 0) * (Number.isFinite(multiplier) ? multiplier : 1)));
    return {
      id: "recontract_unfinished_ten_shadows_domain",
      treatedAsSureHit: Boolean(rule.treatedAsSureHit),
      damageBefore: directDamage,
      damageAfter: adjustedDamage,
      damageMultiplier: Number((Number.isFinite(multiplier) ? multiplier : 1).toFixed(3)),
      reason: rule.reason || "unfinished ten shadows domain special resolution"
    };
  }

  function activateMahoragaProxy(action, actor, battle) {
    var side = actor?.side;
    var profileKey = side === "right" ? "right" : "left";
    var profile = battle?.[profileKey] || actor?.characterCardProfile || {};
    if (!side || !actor || !battle) return null;
    battle.mahoragaProxy ||= {};
    if (!battle.mahoragaProxy[side]?.active) {
      battle.mahoragaProxy[side] = {
        active: true,
        side: side,
        startedRound: Number(battle.round || 0) + 1,
        ritualActionId: action?.id || action?.sourceActionId || "mahoraga_tuning_ritual",
        originalProfile: cloneDuelPlain(profile),
        originalResource: cloneDuelPlain(actor),
        attackMemory: {}
      };
    }
    var proxyProfile = createMahoragaProxyProfile(profile, side);
    battle[profileKey] = proxyProfile;
    actor.name = proxyProfile.name;
    actor.maxHp = Math.max(300, Number(actor.maxHp || 0));
    actor.hp = actor.maxHp;
    actor.maxCe = Math.max(220, Number(actor.maxCe || 0));
    actor.ce = Math.min(actor.maxCe, Math.max(0, Number(actor.ce || 0)));
    actor.ceRegen = Math.max(18, Number(actor.ceRegen || 0));
    actor.stability = Math.max(0.92, Number(actor.stability || 0));
    actor.characterCardProfile = proxyProfile;
    actor.combatPowerUnit = proxyProfile.combatPowerUnit;
    actor.baseStats = { ...proxyProfile.baseStats };
    actor.raw = { ...proxyProfile.raw };
    actor.axes = { ...proxyProfile.axes };
    actor.statusEffects = (Array.isArray(actor.statusEffects) ? actor.statusEffects : [])
      .filter(function removeDuplicate(effect) { return effect?.id !== "mahoragaSubstitute"; });
    actor.statusEffects.push({
      id: "mahoragaSubstitute",
      label: "魔虚罗代打中",
      rounds: 999,
      value: 1
    });
    return {
      active: true,
      side: side,
      name: proxyProfile.name,
      startedRound: Number(battle.round || 0) + 1
    };
  }

  function getMahoragaProxyState(battle, side) {
    var state = battle?.mahoragaProxy?.[side];
    return state?.active ? state : null;
  }

  function getMahoragaAttackKey(action) {
    return String(action?.sourceActionId || action?.cardId || action?.id || action?.label || action?.name || "unknown_action");
  }

  function applyMahoragaAdaptation(action, opponent, battle, directDamage, stabilityShock) {
    var state = getMahoragaProxyState(battle, opponent?.side);
    if (!state || directDamage <= 0) return null;
    var key = getMahoragaAttackKey(action);
    var before = Math.max(0, Number(state.attackMemory?.[key] || 0));
    var scale = Math.max(0, (6 - before) / 6);
    var adaptedDamage = Math.max(0, Math.round(Number(directDamage || 0) * scale));
    var adaptedShock = Math.max(0, Number(stabilityShock || 0) * scale);
    state.attackMemory[key] = Math.min(6, before + 1);
    return {
      actionKey: key,
      actionLabel: action?.label || action?.name || key,
      countBefore: before,
      countAfter: state.attackMemory[key],
      damageScale: Number(scale.toFixed(4)),
      originalDamage: directDamage,
      adaptedDamage: adaptedDamage,
      originalStabilityShock: Number((stabilityShock || 0).toFixed(4)),
      adaptedStabilityShock: Number(adaptedShock.toFixed(4))
    };
  }

  function applyDuelMaintenanceAction(action, actor, battle) {
    var spec = action?.maintenanceSpec;
    if (!spec || !actor || !battle) return null;
    var actorSide = actor.side || "";
    var stateId = spec.grantsState || "";
    if (stateId) {
      actor.statusEffects = Array.isArray(actor.statusEffects) ? actor.statusEffects : [];
      var existing = actor.statusEffects.find(function findState(status) {
        return status?.id === stateId;
      });
      if (existing) existing.rounds = Math.max(Number(existing.rounds || 0), 1);
      else actor.statusEffects.push({ id: stateId, label: "影中藏身", rounds: 1, value: 1, sourceActionId: action.id || "" });
    }
    if (spec.apCostMode === "all_remaining_ap" && battle.actionPoints?.[actorSide]) {
      battle.actionPoints[actorSide].spent = Number(battle.actionPoints[actorSide].spent || 0) + Number(battle.actionPoints[actorSide].current || 0);
      battle.actionPoints[actorSide].current = 0;
    }
    return {
      grantsState: stateId,
      skipActiveTurn: Boolean(spec.skipActiveTurn),
      apCostMode: spec.apCostMode || ""
    };
  }


  function handleMahoragaUnitDefeat(battle, defeatedUnit) {
    if (!battle || !defeatedUnit || !battle.mahoragaProxy) return null;
    var unitId = defeatedUnit.id;

    for (var side in battle.mahoragaProxy) {
        var state = battle.mahoragaProxy[side];
        if (!state || !state.active || state.unitId !== unitId) continue;

        var actor = callDependency("getDuelResourcePair", [battle, side]);
        if (!actor) return null;

        // 移除代打状态（解除 HP 锁定）
        actor.statusEffects = (Array.isArray(actor.statusEffects) ? actor.statusEffects : [])
            .filter(function(effect) { return effect.id !== "mahoragaSubstitute"; });

        // 魔虚罗被击破后召唤者直接落败
        actor.hp = 0;

        // 关闭魔虚罗代理标记
        state.active = false;
        state.endedRound = Number(battle.round || 0) + 1;
        battle.actionUiMessage = "魔虚罗代打结束，召唤者体势崩解。";

        callDependency("recordDuelResourceChange", [battle, {
            side: side,
            title: "魔虚罗被击破",
            detail: (side === "left" ? "我方" : "对方") + "召唤的魔虚罗已被击败，体势崩解。",
            type: "mahoraga_defeat",
            delta: { hp: -1, mahoragaProxyActive: false }
        }]);

        return { side: side, actorName: actor.name || "", hpBefore: 1, hpAfter: actor.hp, defeated: true };
    }
    return null;
  }

  function getDuelTargetSide(resource, fallback) {
    return resource?.side || resource?.ownerSide || resource?.teamSide || fallback || "";
  }

  function getDuelUnitHp(unit) {
    var hp = unit?.hp ?? unit?.currentHp ?? unit?.unitStats?.currentHp ?? unit?.unitStats?.maxHp ?? 0;
    hp = Number(hp || 0);
    return Number.isFinite(hp) ? Math.max(0, hp) : 0;
  }

  function setDuelUnitHp(unit, hp) {
    if (!unit) return;
    var value = Math.max(0, Number(hp || 0));
    unit.hp = value;
    unit.currentHp = value;
    if (unit.unitStats && typeof unit.unitStats === "object") unit.unitStats.currentHp = value;
    if (value <= 0) {
      unit.defeated = true;
      unit.active = false;
    }
  }

  function isDuelUnitAlive(unit) {
    if (!unit || unit.defeated) return false;
    if (unit.active === false && getDuelUnitHp(unit) <= 0) return false;
    return getDuelUnitHp(unit) > 0;
  }

  function getMahoragaProxyUnit(battle, side) {
    var state = battle?.mahoragaProxy?.[side];
    if (!state?.active || !state.unitId) return null;
    return getDuelBattlefieldUnits(battle).find(function findProxyUnit(unit) {
      return unit?.id === state.unitId && isDuelUnitAlive(unit);
    }) || null;
  }

  function isMahoragaProxyProtectingSide(battle, side) {
    return Boolean(getMahoragaProxyUnit(battle, side));
  }

  function protectMahoragaSummonerHp(battle, side) {
    if (!isMahoragaProxyProtectingSide(battle, side)) return false;
    var actor = callDependency("getDuelResourcePair", [battle, side]);
    if (!actor || Number(actor.hp || 0) > 0) return false;
    actor.hp = 1;
    battle.actionUiMessage = "魔虚罗仍在场，召唤者伤害由调幅仪式保护。";
    return true;
  }

  function protectMahoragaSummoners(battle) {
    protectMahoragaSummonerHp(battle, "left");
    protectMahoragaSummonerHp(battle, "right");
  }

  function getDuelUnitTags(unit) {
    var tags = [];
    if (Array.isArray(unit?.tags)) tags = tags.concat(unit.tags);
    if (Array.isArray(unit?.template?.tags)) tags = tags.concat(unit.template.tags);
    if (Array.isArray(unit?.cardTemplate?.tags)) tags = tags.concat(unit.cardTemplate.tags);
    return tags.map(function normalizeTag(tag) { return String(tag || "").toLowerCase(); });
  }

  function getDuelGuardPriority(unit) {
    return Number(unit?.guardPriority ?? unit?.guardRules?.priority ?? unit?.targetingRules?.guardPriority ?? 0);
  }

  function isDuelGuardUnit(unit) {
    var tags = getDuelUnitTags(unit);
    if (unit?.targetingRules?.neverCountsAsGuard || unit?.guardRules?.neverCountsAsGuard) return false;
    if (unit?.unitStats?.control === "neutral_berserk" || unit?.control === "neutral_berserk") return false;
    if (tags.includes("狂暴单位") || tags.includes("berserk")) return false;
    return Boolean(
      unit?.guardRules?.interceptsOpponentAttacks ||
      unit?.guardRules?.protectOwner ||
      unit?.targetingRules?.interceptsOpponentAttacks ||
      unit?.interceptsOpponentAttacks ||
      unit?.protectsOwner ||
      tags.includes("guard") ||
      tags.includes("protector") ||
      tags.includes("守护")
    );
  }

  function getDuelGuardUnitsForSide(battle, defenderSide) {
    return getDuelBattlefieldUnits(battle)
      .filter(function guardForSide(unit) {
        var side = getDuelTargetSide(unit, unit?.side);
        return side === defenderSide && isDuelUnitAlive(unit) && isDuelGuardUnit(unit);
      })
      .sort(function byPriority(left, right) {
        return getDuelGuardPriority(right) - getDuelGuardPriority(left) || getDuelUnitHp(right) - getDuelUnitHp(left);
      });
  }

  function findDuelBattlefieldTargetById(battle, targetId, defender) {
    if (!targetId) return null;
    var normalized = String(targetId);
    var unit = getDuelBattlefieldUnits(battle).find(function matchUnit(candidate) {
      return String(candidate?.id || candidate?.cardId || candidate?.sourceActionId || "") === normalized;
    });
    if (unit && isDuelUnitAlive(unit)) return { type: "unit", unit: unit, id: unit.id || unit.cardId || normalized, name: unit.name || unit.label || unit.cardName || normalized, side: getDuelTargetSide(unit, defender?.side) };
    if (String(defender?.id || defender?.side || "") === normalized) return { type: "character", resource: defender, id: defender.id || defender.side || normalized, name: defender.name || defender.label || defender.side || normalized, side: defender.side || "" };
    return null;
  }

  function resolveDuelDamageTarget(action, actor, opponent, battle, options) {
    if (opponent && battle) {
      var oppSide = opponent.side || "";
      if (getMahoragaProxyState(battle, oppSide)) {
        var unit = getDuelBattlefieldUnits(battle).find(function(u) {
          return u.id === battle.mahoragaProxy[oppSide].unitId && u.active;
        });
        if (unit) {
          return {
            type: "unit",
            unit: unit,
            id: unit.id,
            name: unit.name,
            side: "neutral",
            explicit: false,
            intercepted: true,
            selectionMode: "mahoraga_proxy_guard",
            isMahoragaProxy: true
          };
        }
      }
    }
    var targetPlan = action?.targetPlan || action?.targetingPlan || {};
    var defenderSide = targetPlan.primaryTargetSide || targetPlan.targetSide || opponent?.side || "";
    var explicitTarget = findDuelBattlefieldTargetById(battle, targetPlan.primaryTargetId || targetPlan.explicitTargetId || targetPlan.targetId, opponent);
    if (explicitTarget) return { ...explicitTarget, explicit: true, intercepted: false, selectionMode: targetPlan.selectionMode || "explicit" };
    if (options?.damage > 0 && targetPlan.allowUnitInterception !== false && !action?.effects?.bypassGuard && !action?.bypassGuard) {
      var guardUnit = getDuelGuardUnitsForSide(battle, defenderSide)[0];
      if (guardUnit) {
        return {
          type: "unit",
          unit: guardUnit,
          id: guardUnit.id || guardUnit.cardId || guardUnit.sourceActionId || "",
          name: guardUnit.name || guardUnit.label || guardUnit.cardName || "守护单位",
          side: defenderSide,
          explicit: false,
          intercepted: true,
          selectionMode: "guard_priority"
        };
      }
    }
    return { type: "character", resource: opponent, id: opponent?.id || opponent?.side || defenderSide, name: opponent?.name || opponent?.label || defenderSide, side: defenderSide, explicit: false, intercepted: false, selectionMode: targetPlan.selectionMode || "opponent_character" };
  }

  function applyDuelHpDamageToTarget(target, amount, battle, options) {
    var damage = Math.max(0, Number(amount || 0));
    if (!target || damage <= 0) return { applied: 0, overkill: 0, defeated: false, targetType: target?.type || "" };
    if (target.type === "unit") {
      var beforeHp = getDuelUnitHp(target.unit);
      var unitBlock = Math.max(0, Number(target.unit?.baseBlock ?? target.unit?.unitStats?.baseBlock ?? 0) || 0);
      var blockIgnoreRatio = Math.max(0, Math.min(0.9, Number(options?.blockIgnoreRatio || 0)));
      var effectiveBlock = Math.max(0, unitBlock * (1 - blockIgnoreRatio));
      var unitDamageReductionRatio = Math.max(0, Math.min(0.9, Number(target.unit?.damageReductionRatio ?? target.unit?.unitStats?.damageReductionRatio ?? 0)));
      var effectiveDamage = Math.max(0, damage - effectiveBlock);
      if (unitDamageReductionRatio > 0) effectiveDamage *= (1 - unitDamageReductionRatio);
      var appliedToUnit = Math.min(beforeHp, effectiveDamage);
      var afterHp = Math.max(0, beforeHp - appliedToUnit);
      setDuelUnitHp(target.unit, afterHp);
      var result = {
        targetType: "unit",
        targetId: target.id || "",
        targetName: target.name || "",
        applied: Number(appliedToUnit.toFixed(1)),
        blocked: Number(Math.min(damage, effectiveBlock).toFixed(1)),
        reduced: unitDamageReductionRatio ? Number(Math.max(0, damage - effectiveBlock - effectiveDamage).toFixed(1)) : undefined,
        blockIgnored: Number(Math.max(0, unitBlock - effectiveBlock).toFixed(1)),
        blockIgnoreRatio: blockIgnoreRatio ? Number(blockIgnoreRatio.toFixed(4)) : undefined,
        beforeHp: Number(beforeHp.toFixed(1)),
        afterHp: Number(afterHp.toFixed(1)),
        overkill: Number(Math.max(0, effectiveDamage - appliedToUnit).toFixed(1)),
        defeated: beforeHp > 0 && afterHp <= 0
      };
      // 若魔虚罗单位被击败，触发召唤者体势归零
      if (result.defeated && battle) {
        handleMahoragaUnitDefeat(battle, target.unit);
      }
      return result;
    }
    var beforeCharacterHp = Number(target.resource?.hp || 0);
    var shieldAbsorbed = 0;
    var shieldStatus = (target.resource?.statusEffects || []).find(function findProjectionShield(effect) {
      return effect?.id === "projectionFrameShield" && Number(effect.value || 0) > 0;
    });
    if (shieldStatus) {
      shieldAbsorbed = Math.min(damage, Math.max(0, Number(shieldStatus.value || 0)));
      shieldStatus.value = Number(Math.max(0, Number(shieldStatus.value || 0) - shieldAbsorbed).toFixed(1));
      damage = Math.max(0, damage - shieldAbsorbed);
    }
    target.resource.hp = beforeCharacterHp - damage;
    return {
      targetType: "character",
      targetId: target.id || "",
      targetName: target.name || "",
      applied: Number(damage.toFixed(1)),
      shieldAbsorbed: shieldAbsorbed ? Number(shieldAbsorbed.toFixed(1)) : undefined,
      beforeHp: Number(beforeCharacterHp.toFixed(1)),
      afterHp: Number(Number(target.resource.hp || 0).toFixed(1)),
      overkill: 0,
      defeated: beforeCharacterHp > 0 && Number(target.resource.hp || 0) <= 0
    };
  }

  function applyHutianBlackFlashEffect(effects, actor, opponent, options) {
    var stacks = getHutianBlackFlashStacks(actor);
    var baseRatio = Number(effects.hutianBlackFlashBaseHpRatio || 0.03) + stacks * Number(effects.hutianBlackFlashGrowthPerHit || 0.005);
    var baseDamage = Math.max(0, Number(actor?.hp || 0) * baseRatio);
    var exponent = Number(effects.hutianBlackFlashDamageExponent || 2.5);
    var directDamage = Math.max(0, Math.round(Math.pow(baseDamage, exponent)));
    if (options?.previewOnly) {
      return {
        directDamage: directDamage,
        baseDamage: Number(baseDamage.toFixed(4)),
        baseRatio: Number(baseRatio.toFixed(4)),
        stacksBefore: stacks,
        stacksAfter: stacks + 1,
        hpHeal: 0,
        ceHeal: 0,
        previewOnly: true
      };
    }
    if (directDamage > 0 && !options?.skipOpponentDamage) opponent.hp -= directDamage;
    var hpHeal = Math.max(0, Number(actor?.hp || 0) * Number(effects.hutianBlackFlashHpHealCurrentRatio || 0.08));
    var ceHeal = Math.max(0, Number(actor?.ce || 0) * Number(effects.hutianBlackFlashCeHealCurrentRatio || 0.04));
    actor.hp = Number(actor.hp || 0) + hpHeal;
    actor.ce = Number(actor.ce || 0) + ceHeal;
    actor.stability = Number(clamp(Number(actor.stability || 0) + Number(effects.hutianBlackFlashStabilityDelta || 0.01), 0, 1).toFixed(4));
    setHutianBlackFlashStacks(actor, stacks + 1);
    if (!options?.skipOpponentStatus) {
      opponent.statusEffects = Array.isArray(opponent.statusEffects) ? opponent.statusEffects : [];
      opponent.statusEffects.push({ id: "hutianBlackFlashShock", label: "黑闪！", rounds: 1, value: 1 });
    }
    return {
      directDamage: directDamage,
      baseDamage: Number(baseDamage.toFixed(4)),
      baseRatio: Number(baseRatio.toFixed(4)),
      stacksBefore: stacks,
      stacksAfter: stacks + 1,
      hpHeal: Number(hpHeal.toFixed(1)),
      ceHeal: Number(ceHeal.toFixed(1))
    };
  }

  function applyDuelActionEffect(action, actor, opponent, duelState) {
    var battle = getBattle(duelState);
    if (!action || !actor || !opponent || !battle) return null;
    cleanupExpiredDuelBattlefieldUnits(battle);
    if (action.id === "online_pass_turn" || action.id === "duel_pass_turn" || action.type === "pass") {
      var passUpkeepResult = applyDuelSummonUpkeep(actor, battle);
      var passSummonAssistResult = applyDuelSummonAssist(actor, opponent, battle);
      var passProjectionSettlement = settleProjectionTurnFrameGain(actor, battle);
      var passResult = {
        costCe: 0,
        actorCe: passUpkeepResult ? -passUpkeepResult.paid.reduce(function sumCost(total, entry) { return total + Number(entry.costCe || 0); }, 0) : 0,
        actorHp: 0,
        actorStability: 0,
        actorDomainLoad: 0,
        opponentStability: 0,
        opponentHp: 0,
        opponentDomainLoad: 0,
        domainActivated: false,
        domainReleased: false,
        directDamage: 0,
        blackFlashTriggered: false,
        blackFlashLabel: "",
        mechanicsApplied: [],
        projectionSorcery: passProjectionSettlement ? { settlement: passProjectionSettlement } : undefined,
        summonUpkeep: passUpkeepResult || undefined,
        summonAssist: passSummonAssistResult || undefined,
        passTurn: true
      };
      appendDuelActionLog(action, actor, opponent, passResult, battle);
      return passResult;
    }
    action = getProjectionRuntimeAction(getStarRageRuntimeAction(getBloodManipulationRuntimeAction(action, actor, battle), actor, battle), actor, battle);
    var side = actor.side;
    var opponentSide = opponent.side;
    var mechanicsApplied = collectDuelMechanicsForAction(action);
    var effects = mergeDuelMechanicEffects(action.effects || {}, mechanicsApplied);
    var contexts = ensureDuelActionContext(battle);
    var actorContext = contexts?.[side] || createEmptyDuelActionContext();
    var opponentContext = contexts?.[opponentSide] || createEmptyDuelActionContext();
    var before = {
      actorCe: actor.ce,
      actorHp: actor.hp,
      actorStability: actor.stability,
      actorDomainLoad: actor.domain?.load || 0,
      actorDomainActive: Boolean(actor.domain?.active),
      opponentCe: opponent.ce,
      opponentHp: opponent.hp,
      opponentStability: opponent.stability,
      opponentDomainLoad: opponent.domain?.load || 0
    };
    var summonUpkeepResult = applyDuelSummonUpkeep(actor, battle);
    var numericPreview = calculateActionNumericPreview(action, actor);
    var bloodRuntime = action.bloodRuntime || numericPreview?.bloodRuntime || null;
    var starRageRuntime = action.starRageRuntime || numericPreview?.starRageRuntime || null;
    var blackFlashWindow = null;
    var costCe = Math.min(actor.ce, Number(action.costCe ?? getDuelActionCost(action, actor)));
    actor.ce -= costCe;
    var hpCost = applyDuelActionHpCost(action, actor);
    var bloodConversionResult = applyBloodManipulationConversion(action, actor, costCe, hpCost);
    if (bloodRuntime?.active && !action.bloodConversion) {
      action = getProjectionRuntimeAction(getStarRageRuntimeAction(getBloodManipulationRuntimeAction(action, actor, battle, {
        actualCeCost: costCe,
        actualHpCost: hpCost
      }), actor, battle), actor, battle);
      effects = mergeDuelMechanicEffects(action.effects || {}, mechanicsApplied);
      numericPreview = calculateActionNumericPreview(action, actor);
      bloodRuntime = action.bloodRuntime || numericPreview?.bloodRuntime || bloodRuntime;
      starRageRuntime = action.starRageRuntime || numericPreview?.starRageRuntime || starRageRuntime;
    }
    var bloodRoundState = addBloodManipulationRoundSpend(battle, side, bloodRuntime, costCe, hpCost);
    actor.stability = Number(clamp(Number(actor.stability || 0) + Number(effects.stabilityDelta || 0), 0, 1).toFixed(4));

    if (effects.activateDomain && actor.domain?.threshold > 0) {
      actor.domain.active = true;
      actor.domain.turnsActive = 0;
    }
    if (effects.releaseDomain && actor.domain) {
      actor.domain.active = false;
      if (battle.domainProfileStates?.[side]) delete battle.domainProfileStates[side];
      if (battle.domainSubPhase?.owner === side) {
        battle.domainSubPhase.verdictResolved = true;
        battle.domainSubPhase.endedByRelease = true;
        battle.domainSubPhase.trialEndReason = "domainManuallyEnded";
        battle.domainSubPhase.trialStatus = "resolved";
        updateDuelDomainTrialContext(battle, {
          trialStatus: "resolved",
          trialEndReason: "domainManuallyEnded"
        });
        invalidateDuelActionChoices(battle);
      }
    }
    if (actor.domain && isDomainActive(actor) && Number(effects.domainLoadDelta || 0)) {
      actor.domain.load += Number(effects.domainLoadDelta || 0);
    }
    if (opponent.domain && isDomainActive(opponent) && Number(effects.opponentDomainLoadDelta || 0)) {
      opponent.domain.load += Number(effects.opponentDomainLoadDelta || 0);
    }
    if (Number(effects.opponentStabilityDelta || 0)) {
      opponent.stability = Number(clamp(Number(opponent.stability || 0) + Number(effects.opponentStabilityDelta || 0), 0, 1).toFixed(4));
    }
    if (effects.opponentRegenInterference) {
      opponent.statusEffects.push({ id: "ceRegenInterference", label: "咒力回流受扰", rounds: 1, value: Number(effects.opponentRegenInterference) });
    }
    (effects.selfStatuses || []).forEach(function addSelfStatus(status) {
      if (status?.id) actor.statusEffects.push({ ...status });
    });
    (effects.delayedSelfStatuses || []).forEach(function addDelayedSelfStatus(status) {
      if (!status?.id) return;
      var delayedStatus = { ...status };
      var delayTurns = Math.max(0, Number(delayedStatus.triggerDelayTurns || 0));
      if (!delayedStatus.triggerRound && delayTurns > 0) {
        delayedStatus.triggerRound = getDuelActionTurnNumber(battle) + delayTurns;
      }
      delete delayedStatus.triggerDelayTurns;
      actor.statusEffects.push(delayedStatus);
    });
    var pendingOpponentStatuses = Array.isArray(effects.opponentStatuses) ? effects.opponentStatuses : [];
    if (Number(effects.lowStabilityHpRecoil || 0) && Number(actor.stability || 0) < 0.38) actor.hp -= Number(effects.lowStabilityHpRecoil);
    var damageSettlementRatio = action?.projectionRuntime?.active
      ? Number(action.projectionRuntime.damageSettlementRatio || action.projectionDamageSettlementRatio || 0.72)
      : (action.risk === "high" || action.risk === "critical" ? 0.58 : 0.45);
    var directDamage = Math.max(0, Math.round(Number(numericPreview?.finalDamage || 0) * damageSettlementRatio));
    var directDamageBeforeScale = directDamage;
    var projectionFrameDamageForSettlement = directDamageBeforeScale;
    var damageScaleSummary = null;
    var directHealing = Math.max(0, Math.round(Number(numericPreview?.finalHealing || 0)));
    var actualHealing = 0;
    var healingBlockedByDefeat = false;
    var stabilityShock = Math.max(0, Number(numericPreview?.base?.baseStabilityDamage || 0) / 100);
    var hutianBlackFlashResult = null;
    var evasionResult = null;
    var blackFlashStatus = null;
    var blackFlashDamageBefore = 0;
    var blackFlashDamageBonus = 0;
    var damageTarget = null;
    var damageApplication = null;
    var summonResult = null;
    var summonAssistResult = null;
    var maintenanceResult = null;
    var mahoragaProxyResult = null;
    var mahoragaAdaptation = null;
    var specialResolutionResult = null;
    var starRageResult = null;
    var projectionOutOfFrameResult = triggerProjectionOutOfFrameIfReady(action, actor, opponent, battle, actorContext);
    var projectionResult = applyProjectionImmediateEffects(action, actor, battle, actorContext);
    var projectionSettlement = null;
    var projectionReflect = null;
    var starRageSingleCardBonus = null;
    var instantKillOnHit = Boolean(action.instantKillOnHit || effects.instantKillOnHit);
    if (effects.hutianBlackFlash) {
      hutianBlackFlashResult = applyHutianBlackFlashEffect(effects, actor, opponent, { previewOnly: true });
      directDamage = hutianBlackFlashResult.directDamage;
    }
    if (!effects.hutianBlackFlash && directDamage > 0 && isStrikeLikeAction(action)) {
      blackFlashWindow = takeBlackFlashWindow(actor);
    }
    if (blackFlashWindow) {
      blackFlashDamageBefore = directDamage;
      directDamage = Math.max(directDamage + 8, Math.round(directDamage * 1.35));
      blackFlashDamageBonus = Math.max(0, directDamage - blackFlashDamageBefore);
      stabilityShock += 0.085;
      blackFlashStatus = { id: "blackFlashShock", label: actor?.characterCardProfile?.isZeroCe ? "极限打击冲击" : "黑闪冲击", rounds: 1, value: 1 };
    }
    specialResolutionResult = applyRecontractUnfinishedTenShadowsResolution(action, actor, opponent, battle, directDamage);
    if (specialResolutionResult) directDamage = specialResolutionResult.damageAfter;
    directDamageBeforeScale = directDamage;
    if (directDamage > 0) {
      var pendingOutgoingScale = Math.max(0, Number(actorContext.outgoingScale || 1));
      var activeStatusOutgoingScale = Math.max(0, Number(getActiveDuelOutgoingStatusScale(actor, battle) || 1));
      var effectDamageScale = Math.max(0, Number(effects.damageScale || 1));
      var defenderIncomingHpScale = Math.max(0, Number(opponentContext.incomingHpScale || 1));
      var defenderIncomingHpReductionCap = Math.max(0, Number(opponentContext.incomingHpReductionCap || 0));
      var damageWithoutDefenderScale = directDamage * pendingOutgoingScale * activeStatusOutgoingScale * effectDamageScale;
      projectionFrameDamageForSettlement = Math.max(0, Math.round(Number.isFinite(damageWithoutDefenderScale) ? damageWithoutDefenderScale : directDamageBeforeScale));
      var totalDamageScale = pendingOutgoingScale * activeStatusOutgoingScale * effectDamageScale * defenderIncomingHpScale;
      damageScaleSummary = {
        pendingOutgoingScale: Number(pendingOutgoingScale.toFixed(4)),
        activeStatusOutgoingScale: Number(activeStatusOutgoingScale.toFixed(4)),
        effectDamageScale: Number(effectDamageScale.toFixed(4)),
        defenderIncomingHpScale: Number(defenderIncomingHpScale.toFixed(4)),
        defenderIncomingHpReductionCap: defenderIncomingHpReductionCap || undefined,
        total: Number(totalDamageScale.toFixed(4))
      };
      if (Number.isFinite(totalDamageScale) && totalDamageScale !== 1) {
        if (defenderIncomingHpReductionCap > 0 && defenderIncomingHpScale < 1 && Number.isFinite(damageWithoutDefenderScale)) {
          var uncappedDefenderScaledDamage = damageWithoutDefenderScale * defenderIncomingHpScale;
          var preventedByDefenderScale = Math.max(0, damageWithoutDefenderScale - uncappedDefenderScaledDamage);
          var cappedPrevention = Math.min(preventedByDefenderScale, defenderIncomingHpReductionCap);
          directDamage = Math.max(0, Math.round(damageWithoutDefenderScale - cappedPrevention));
          opponentContext.incomingHpReductionCap = Math.max(0, defenderIncomingHpReductionCap - cappedPrevention);
          damageScaleSummary.cappedIncomingHpReduction = Number(cappedPrevention.toFixed(1));
          damageScaleSummary.uncappedIncomingHpReduction = Number(preventedByDefenderScale.toFixed(1));
          damageScaleSummary.remainingIncomingHpReductionCap = Number(opponentContext.incomingHpReductionCap.toFixed(1));
        } else {
          directDamage = Math.max(0, Math.round(directDamage * totalDamageScale));
        }
      }
    }
    evasionResult = specialResolutionResult?.treatedAsSureHit
      ? { checked: true, evaded: false, profile: "special_resolution_sure_hit", hitRate: 1, roll: 0 }
      : resolveDuelActionEvasion(action, actor, opponent, battle, { damage: directDamage, stabilityShock: stabilityShock, instantKillOnHit: instantKillOnHit });
    if (evasionResult?.evaded) {
      showDuelFloatingCombatText(battle, "Miss!", "miss", opponentSide);
      battle.evasionLog ||= [];
      battle.evasionLog.unshift({
        round: Number(battle.round || 0) + 1,
        actionId: action.id || "",
        actionLabel: action.label || action.id || "",
        actorSide: side,
        opponentSide: opponentSide,
        hitRate: evasionResult.hitRate,
        roll: evasionResult.roll,
        profile: evasionResult.profile
      });
      directDamage = Math.max(0, Math.round(directDamage * Number(evasionResult.damageScaleOnMiss || 0)));
      stabilityShock = Math.max(0, Number(stabilityShock || 0) * Number(evasionResult.stabilityScaleOnMiss || 0));
      instantKillOnHit = false;
      if (hutianBlackFlashResult) hutianBlackFlashResult.evaded = true;
    }
    if (!evasionResult?.evaded && hasProjectionSorceryAccess(actor, battle) && projectionFrameDamageForSettlement > 0) {
      recordProjectionTurnDamage(battle, side, projectionFrameDamageForSettlement);
    }
    damageTarget = resolveDuelDamageTarget(action, actor, opponent, battle, { damage: directDamage, stabilityShock: stabilityShock, instantKillOnHit: instantKillOnHit });
    if (!evasionResult?.evaded && damageTarget?.type !== "unit") {
      mahoragaAdaptation = applyMahoragaAdaptation(action, opponent, battle, directDamage, stabilityShock);
      if (mahoragaAdaptation) {
        directDamage = mahoragaAdaptation.adaptedDamage;
        stabilityShock = mahoragaAdaptation.adaptedStabilityShock;
      }
    }
    if (!evasionResult?.evaded && instantKillOnHit) {
      directDamage = Math.max(directDamage, Math.ceil(damageTarget?.type === "unit" ? getDuelUnitHp(damageTarget.unit) : Number(opponent.hp || 0)));
      damageApplication = applyDuelHpDamageToTarget(damageTarget, directDamage, battle, { blockIgnoreRatio: bloodRuntime?.blockIgnoreRatio || action.blockIgnoreRatio || 0 });
    } else if (!evasionResult?.evaded && effects.hutianBlackFlash) {
      hutianBlackFlashResult = applyHutianBlackFlashEffect(effects, actor, opponent, {
        skipOpponentDamage: damageTarget?.type === "unit",
        skipOpponentStatus: damageTarget?.type === "unit"
      });
      directDamage = hutianBlackFlashResult.directDamage;
      if (damageTarget?.type === "unit") damageApplication = applyDuelHpDamageToTarget(damageTarget, directDamage, battle, { blockIgnoreRatio: bloodRuntime?.blockIgnoreRatio || action.blockIgnoreRatio || 0 });
    } else if (!effects.hutianBlackFlash && directDamage > 0) {
      damageApplication = applyDuelHpDamageToTarget(damageTarget, directDamage, battle, { blockIgnoreRatio: bloodRuntime?.blockIgnoreRatio || action.blockIgnoreRatio || 0 });
    }
    if (damageApplication?.applied > 0 && damageTarget?.type === "character") {
      applyProjectionDamageTakenFrameGain(damageTarget, battle, damageApplication.applied);
      projectionReflect = applyProjectionFrameShieldReflect(damageTarget.resource, actor, battle, damageApplication.applied);
    }
    if (!evasionResult?.evaded && directDamage > 0 && bloodRuntime?.active) resetBloodManipulationRoundState(battle, side);
    if (!evasionResult?.evaded && blackFlashStatus && damageTarget?.type !== "unit") opponent.statusEffects.push(blackFlashStatus);
    if (!evasionResult?.evaded && damageTarget?.type !== "unit") {
      pendingOpponentStatuses.forEach(function addOpponentStatus(status) {
        if (status?.id) opponent.statusEffects.push({ ...status });
      });
    }
    if (stabilityShock > 0 && damageTarget?.type !== "unit") {
      opponent.stability = Number(clamp(Number(opponent.stability || 0) - stabilityShock, 0, 1).toFixed(4));
    }
    if (directHealing > 0 && Number(actor.maxHp || 0) > 0) {
      if (isDuelResourceDefeated(actor, battle)) {
        healingBlockedByDefeat = true;
      } else {
        var beforeHealHp = Number(actor.hp || 0);
        actor.hp = Number(clamp(beforeHealHp + directHealing, 0, getDuelActionTemporaryResourceCap(actor, "hp", "maxHp", "temporaryHpOverCap")).toFixed(1));
        actualHealing = Math.max(0, Number((Number(actor.hp || 0) - beforeHealHp).toFixed(1)));
      }
    }
    starRageResult = applyStarRageResolution(action, actor, battle, actorContext);
    if (isMahoragaTuningRitualAction(action)) {
      // 魔虚罗调幅仪式：召唤未调幅魔虚罗独立单位，锁定召唤者体势为1
      if (!battle.mahoragaProxy || !battle.mahoragaProxy[side]?.active) {
        // 创建未调幅魔虚罗单位（中立，狂暴）
        var unitId = "mahoraga_unsubdued_" + side + "_" + (Number(battle.round || 0) + 1);
        var mahoragaUnit = {
          id: unitId,
          cardId: "mahoraga_unsubdued_unit",
          sourceActionId: "mahoraga_unsubdued_unit",
          name: "八握剑异戒神将 魔虚罗",
          label: "八握剑异戒神将 魔虚罗（未调幅）",
          side: "neutral",
          ownerSide: side,
          controllerSide: "neutral",
          control: "neutral_berserk",
          placement: "battlefield",
          tags: ["魔虚罗", "狂暴", "适应"],
          unitStats: {
            maxHp: 500,
            currentHp: 500,
            baseDamage: 200,
            baseBlock: 100,
            mahoragaTurnEndHpRegen: 80,
            damageType: "melee",
            accuracyProfile: "melee",
            evasionAllowed: false
          },
          hp: 500,
          currentHp: 500,
          maxHp: 500,
          baseDamage: 200,
          baseBlock: 100,
          mahoragaTurnEndHpRegen: 80,
          damageType: "melee",
          accuracyProfile: "melee",
          evasionAllowed: false,
          active: true,
          spawnedBy: action.id,
          spawnedRound: Number(battle.round || 0) + 1,
          durationRounds: 0,
          expiresAfterRound: 0,
          adaptationMemory: {}
        };
        // 标记十影一次召唤（同满象）
        if (!battle.tenShadowsSummonState) battle.tenShadowsSummonState = {};
        if (!battle.tenShadowsSummonState[side]) battle.tenShadowsSummonState[side] = {};
        battle.tenShadowsSummonState[side]["mahoraga_unsubdued_unit"] = {
          unitId: unitId,
          unitName: mahoragaUnit.name,
          uniqueTenShadowsSummon: true
        };
        getDuelBattlefieldUnits(battle).push(mahoragaUnit);

        // 锁定召唤者 HP = 1
        actor.hp = 1;
        actor.statusEffects = (actor.statusEffects || []).filter(function(e) {
          return e.id !== "mahoragaSubstitute";
        });
        actor.statusEffects.push({
          id: "mahoragaSubstitute",
          label: "八握剑异戒神将 魔虚罗 代打中",
          rounds: 999,
          value: 1
        });
        battle.actionUiMessage = "八握剑异戒神将 魔虚罗 代打中";

        // 建立 proxy 状态记录
        battle.mahoragaProxy ||= {};
        battle.mahoragaProxy[side] = {
          active: true,
          side: side,
          unitId: unitId,
          startedRound: Number(battle.round || 0) + 1,
          ritualActionId: action.id
        };

        mahoragaProxyResult = { active: true, unitId: unitId, name: mahoragaUnit.name };
      } else {
        mahoragaProxyResult = { active: false, reason: "魔虚罗已经存在于战场" };
      }
    } else {
      summonResult = applyDuelSummonAction(action, actor, battle);
    }
    maintenanceResult = applyDuelMaintenanceAction(action, actor, battle);
    summonAssistResult = applyDuelSummonAssist(actor, opponent, battle);
    protectMahoragaSummoners(battle);

    var contextOutgoingScaleBeforeUpdate = Math.max(0, Number(actorContext.outgoingScale || 1));
    var effectOutgoingScale = Math.max(0, Number(effects.outgoingScale || 1));
    var blockIncomingHpScale = getDuelBlockIncomingHpScale(action, numericPreview, effects);
    if (directDamageBeforeScale > 0 && contextOutgoingScaleBeforeUpdate !== 1 && actorContext.consumeOutgoingScaleOnDamage !== false) {
      actorContext.outgoingScale = 1;
      actorContext.consumeOutgoingScaleOnDamage = true;
    }
    if (effectOutgoingScale !== 1) actorContext.outgoingScale *= effectOutgoingScale;
    if (effects.consumeOutgoingScaleOnDamage === false) actorContext.consumeOutgoingScaleOnDamage = false;
    actorContext.incomingHpScale *= Number(effects.incomingHpScale || 1) * blockIncomingHpScale;
    if (bloodRuntime?.active && Number(effects.incomingHpReductionCapFromBloodHpCostMultiplier || 0) > 0) {
      actorContext.incomingHpReductionCap += Math.max(0, Number((hpCost * Number(effects.incomingHpReductionCapFromBloodHpCostMultiplier || 0)).toFixed(1)));
    }
    actorContext.incomingCeScale *= Number(effects.incomingCeScale || 1);
    actorContext.sureHitScale *= Number(effects.sureHitScale || 1);
    actorContext.domainPressureScale *= Number(effects.domainPressureScale || 1);
    actorContext.manualAttackScale *= Number(effects.manualAttackScale || 1);
    actorContext.domainLoadScale *= Number(effects.domainLoadScale || 1);
    actorContext.evasionBonus += Number(effects.evasionBonus || 0);
    actorContext.actionLabels.push(action.label);
    addDuelActionWeightDeltas(actorContext, effects.weightDeltas);
    addDuelActionWeightDeltas(opponentContext, effects.opponentWeightDeltas);
    var domainSpecificResult = action.domainSpecific
      ? applyDuelDomainSpecificAction(action, actor, opponent, battle)
      : null;
    if (action.selectedLast || action.projectionSettleTurn) {
      projectionSettlement = settleProjectionTurnFrameGain(actor, battle);
    }
    clampDuelResource(actor);
    clampDuelResource(opponent);
    if (bloodConversionResult?.allowOverCap) {
      actor.hp = bloodConversionResult.afterHp;
      actor.ce = bloodConversionResult.afterCe;
      syncBloodManipulationTemporaryOverCap(actor);
      recordBloodManipulationConversionChange(battle, side, actor, bloodConversionResult);
    }

    var result = {
      costCe: costCe,
      hpCost: hpCost,
      actorCe: Number((actor.ce - before.actorCe).toFixed(1)),
      actorHp: Number((actor.hp - before.actorHp).toFixed(1)),
      actorStability: Number((actor.stability - before.actorStability).toFixed(4)),
      actorDomainLoad: Number(((actor.domain?.load || 0) - before.actorDomainLoad).toFixed(1)),
      opponentStability: Number((opponent.stability - before.opponentStability).toFixed(4)),
      opponentHp: Number((opponent.hp - before.opponentHp).toFixed(1)),
      opponentDomainLoad: Number(((opponent.domain?.load || 0) - before.opponentDomainLoad).toFixed(1)),
      domainActivated: !before.actorDomainActive && Boolean(actor.domain?.active),
      domainReleased: before.actorDomainActive && !actor.domain?.active,
      directDamage: directDamage,
      directDamageBeforeScale: directDamageBeforeScale,
      damageScale: damageScaleSummary || undefined,
      blockIncomingHpScale: blockIncomingHpScale !== 1 ? blockIncomingHpScale : undefined,
      directHealing: directHealing,
      actorHealing: actualHealing,
      healingBlockedByDefeat: healingBlockedByDefeat || undefined,
      instantKillOnHit: Boolean(!evasionResult?.evaded && (action.instantKillOnHit || effects.instantKillOnHit)),
      evasion: evasionResult?.checked ? evasionResult : undefined,
      blackFlashTriggered: Boolean(!evasionResult?.evaded && (blackFlashWindow || effects.hutianBlackFlash)),
      blackFlashLabel: !evasionResult?.evaded && effects.hutianBlackFlash ? "黑闪！" : (!evasionResult?.evaded && blackFlashWindow ? (actor?.characterCardProfile?.isZeroCe ? "极限打击窗口" : "黑闪") : ""),
      blackFlashDamageBefore: blackFlashWindow ? blackFlashDamageBefore : undefined,
      blackFlashDamageBonus: blackFlashWindow ? blackFlashDamageBonus : undefined,
      blackFlashSourceActionId: blackFlashWindow ? (action.id || "") : undefined,
      hutianBlackFlash: hutianBlackFlashResult || undefined,
      damageTarget: damageTarget ? {
        type: damageTarget.type,
        id: damageTarget.id || "",
        name: damageTarget.name || "",
        side: damageTarget.side || "",
        intercepted: Boolean(damageTarget.intercepted),
        selectionMode: damageTarget.selectionMode || ""
      } : undefined,
      damageApplication: damageApplication || undefined,
      bloodManipulation: bloodRuntime ? {
        ceCostRatio: Number(action.bloodCeCostRatio || 0),
        hpCostRatio: Number(action.bloodHpCostRatio || 0),
        bloodPierceRatio: bloodRuntime.bloodPierceRatio,
        bloodBoostRatio: bloodRuntime.bloodBoostRatio,
        blockIgnoreRatio: bloodRuntime.blockIgnoreRatio,
        roundState: bloodRoundState || undefined,
        conversion: bloodConversionResult || undefined,
        clearedAfterDamage: Boolean(!evasionResult?.evaded && directDamage > 0)
      } : undefined,
      starRage: starRageRuntime ? starRageResult || { massBefore: starRageRuntime.massBefore } : (starRageSingleCardBonus || undefined),
      projectionSorcery: projectionResult || projectionOutOfFrameResult || projectionSettlement || projectionReflect ? {
        runtime: action.projectionRuntime || undefined,
        immediate: projectionResult || undefined,
        outOfFrame: projectionOutOfFrameResult || undefined,
        settlement: projectionSettlement || undefined,
        reflect: projectionReflect || undefined
      } : undefined,
      guardIntercepted: Boolean(damageTarget?.intercepted),
      summon: summonResult ? {
        unitId: summonResult.unit?.id || "",
        unitName: summonResult.unit?.name || "",
        side: summonResult.unit?.side || "",
        ownerSide: summonResult.unit?.ownerSide || "",
        control: summonResult.unit?.control || "",
        hp: summonResult.unit?.hp || 0,
        maxHp: summonResult.unit?.maxHp || 0,
        baseDamage: summonResult.unit?.baseDamage || 0,
        maintenanceActionId: summonResult.maintenanceCard?.id || ""
      } : undefined,
      maintenance: maintenanceResult || undefined,
      summonUpkeep: summonUpkeepResult || undefined,
      summonAssist: summonAssistResult || undefined,
      mahoragaProxy: mahoragaProxyResult || undefined,
      mahoragaAdaptation: mahoragaAdaptation || undefined,
      specialResolution: specialResolutionResult || undefined,
      numericPreview: numericPreview,
      mechanicsApplied: mechanicsApplied.map(function mapMechanic(mechanic) {
        return {
          id: mechanic.id || "",
          label: mechanic.label || mechanic.id || "",
          logTemplate: mechanic.logTemplate || mechanic.effectSummary || ""
        };
      }),
      domainSpecific: domainSpecificResult || undefined
    };
    appendDuelActionLog(action, actor, opponent, result, battle);
    return result;
  }

  function applyDuelDomainSpecificAction(action, actor, opponent, duelState) {
    return callDependency("applyDuelDomainSpecificAction", [action, actor, opponent, duelState]);
  }

  function appendDuelActionLog(action, actor, opponent, result, duelState) {
    return callDependency("appendDuelActionLog", [action, actor, opponent, result, duelState]);
  }

  function getDuelCpuAction(actor, opponent, duelState) {
    var battle = getBattle(duelState);
    var pool = buildDuelActionPool(actor, opponent, battle).filter(function availableOnly(action) {
      return action.available;
    });
    if (!pool.length) return null;
    var profile = getDuelProfileForSide(battle, actor?.side || "");
    var domainResponse = getDuelDomainResponseProfile(profile || {}, actor, opponent, battle);
    var hpRatio = actor.maxHp ? actor.hp / actor.maxHp : 0;
    var ceRatio = actor.maxCe ? actor.ce / actor.maxCe : 0;
    var domainRisk = actor.domain?.threshold ? actor.domain.load / actor.domain.threshold : 0;
    var preferred = [];
    if (actor.domain?.active && domainRisk > 0.75) preferred.push("domain_release", "domain_compress");
    if (isDuelOpponentDomainThreat(opponent, actor, battle)) preferred.push(...domainResponse.allowedDomainResponseActions, "defensive_frame");
    if (hpRatio < 0.36) preferred.push("defensive_frame", "ce_compression");
    if (ceRatio < 0.24) preferred.push("residue_reading", "ce_compression");
    if (actor.domain?.active && domainRisk < 0.45) preferred.push("domain_force_sustain");
    if (!actor.domain?.active && ceRatio > 0.5) preferred.push("domain_expand", "technique_interference", "ce_reinforcement");
    preferred.push("technique_interference", "ce_reinforcement", "defensive_frame", "residue_reading");
    return preferred.map(function findPreferred(id) {
      return pool.find(function findAction(action) {
        return action.id === id;
      });
    }).find(Boolean) ||
      pool.sort(function sortByScore(a, b) {
        return scoreDuelActionCandidate(b, actor, opponent, battle) - scoreDuelActionCandidate(a, actor, opponent, battle);
      })[0];
  }

  function resolveMahoragaTurnEndAttack(battle) {
    if (!battle || !battle.mahoragaProxy) return null;
    var results = [];
    Object.keys(battle.mahoragaProxy).forEach(function(side) {
      var state = battle.mahoragaProxy[side];
      if (!state.active) return;
      var unit = getDuelBattlefieldUnits(battle).find(function(u) {
        return u.id === state.unitId && u.active;
      });
      if (!unit) return;
      // 确定攻击目标：优先攻击十影召唤者（若未影中藏身）
      
      var opponentSide = side === "left" ? "right" : "left";
      var opponent = callDependency("getDuelResourcePair", [battle, opponentSide]);
      if (!opponent) return;
      var regen = Math.max(0, Number(unit.mahoragaTurnEndHpRegen || unit.unitStats?.mahoragaTurnEndHpRegen || 0));
      if (regen > 0) {
        unit.currentHp = Math.min(Number(unit.maxHp || 0), Number(unit.currentHp || unit.hp || 0) + regen);
        unit.hp = unit.currentHp;
      }
      var damage = Math.max(0, Number(unit.baseDamage || unit.unitStats?.baseDamage || 200));
      // 魔虚罗对咒灵特攻
      if (opponent.characterCardProfile?.isCurse || /咒灵/.test(opponent.name || "")) {
        damage *= 3;
      }
      opponent.hp = Math.max(0, (opponent.hp || 0) - damage);
      // 稳定性冲击
      opponent.stability = Number(clamp((opponent.stability || 0) - 0.02, 0, 1).toFixed(4));
      results.push({
        side: side,
        targetSide: opponentSide,
        unitId: unit.id,
        damage: damage,
        unitHpAfterRegen: unit.hp,
        targetHpAfter: opponent.hp
      });
    });
    return results;
  }

  var implementations = {
    getDuelActionTemplates: getDuelActionTemplates,
    buildDuelActionPool: buildDuelActionPool,
    pickDuelActionChoices: pickDuelActionChoices,
    getDuelActionCost: getDuelActionCost,
    getDuelActionAvailability: getDuelActionAvailability,
    applyDuelActionEffect: applyDuelActionEffect,
    getDuelCpuAction: getDuelCpuAction,
    buildDuelDomainSpecificActions: buildDuelDomainSpecificActions,
    invalidateDuelActionChoices: invalidateDuelActionChoices,
    getDuelActionRiskLabel: getDuelActionRiskLabel,
    getDuelActionContext: getDuelActionContext,
    buildDuelActionTemplateIndexes: buildDuelActionTemplateIndexes,
    getDuelActionTemplateIndex: getDuelActionTemplateIndex,
    warmDuelActionTemplateCache: warmDuelActionTemplateCache,
    invalidateDuelActionTemplateCache: invalidateDuelActionTemplateCache,
    buildDuelMechanicTemplateIndexes: buildDuelMechanicTemplateIndexes,
    getDuelMechanicTemplateIndex: getDuelMechanicTemplateIndex,
    warmDuelMechanicTemplateCache: warmDuelMechanicTemplateCache,
    invalidateDuelMechanicTemplateCache: invalidateDuelMechanicTemplateCache,
    getDuelMechanicTemplateById: getDuelMechanicTemplateById,
    collectDuelMechanicsForAction: collectDuelMechanicsForAction
  };

  var api = {
    metadata: Object.freeze({
      namespace: namespace,
      version: version,
      layer: "duel-actions",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "implementation",
      ownsBehavior: true
    }),
    expectedExports: Object.freeze(expectedExports.slice()),
    expectedDependencies: Object.freeze(expectedDependencyNames.slice()),
    bind: bind,
    register: register,
    hasBinding: hasBinding,
    get: get,
    getBinding: getBinding,
    listBindings: listBindings,
    clearBindings: clearBindings,
    bindDependency: bindDependency,
    configure: configure,
    registerDependencies: registerDependencies,
    hasDependency: hasDependency,
    listDependencies: listDependencies,
    clearDependencies: clearDependencies,
    getDuelActionTemplates: getDuelActionTemplates,
    buildDuelActionPool: buildDuelActionPool,
    pickDuelActionChoices: pickDuelActionChoices,
    getDuelActionCost: getDuelActionCost,
    getDuelActionAvailability: getDuelActionAvailability,
    applyDuelActionEffect: applyDuelActionEffect,
    getDuelCpuAction: getDuelCpuAction,
    buildDuelDomainSpecificActions: buildDuelDomainSpecificActions,
    invalidateDuelActionChoices: invalidateDuelActionChoices,
    buildDuelActionTemplateIndexes: buildDuelActionTemplateIndexes,
    getDuelActionTemplateIndex: getDuelActionTemplateIndex,
    warmDuelActionTemplateCache: warmDuelActionTemplateCache,
    invalidateDuelActionTemplateCache: invalidateDuelActionTemplateCache,
    buildDuelMechanicTemplateIndexes: buildDuelMechanicTemplateIndexes,
    getDuelMechanicTemplateIndex: getDuelMechanicTemplateIndex,
    warmDuelMechanicTemplateCache: warmDuelMechanicTemplateCache,
    invalidateDuelMechanicTemplateCache: invalidateDuelMechanicTemplateCache,
    getDuelMechanicTemplateById: getDuelMechanicTemplateById,
    collectDuelMechanicsForAction: collectDuelMechanicsForAction,
    resolveMahoragaTurnEndAttack: resolveMahoragaTurnEndAttack,
    getDuelActionCacheStats: function getDuelActionCacheStats() {
      return {
        actionIndexReady: Boolean(actionTemplateIndexCache),
        mechanicIndexReady: Boolean(mechanicTemplateIndexCache),
        actionLastInvalidatedAt: performanceCacheStats.actionLastInvalidatedAt,
        mechanicLastInvalidatedAt: performanceCacheStats.mechanicLastInvalidatedAt
      };
    }
  };

  global[namespace] = api;
})(globalThis);
