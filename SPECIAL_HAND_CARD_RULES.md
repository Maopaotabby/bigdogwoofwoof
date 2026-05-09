# 咒术对战特色技能卡编写守则

本文档是 `data/duel-special-card.json` 的维护要求。新增、迁移、修正特色手牌时，先按本守则检查；不要依赖旧草案字段或运行时代码里的硬编码别名兜底。

## 1. 文件位置与运行链路

- 特色技能卡文件：`./data/duel-special-card.json`
- `wheel/runtime-core.js` 加载该文件后写入 `state.duelSpecialCards`
- `modules/duel/duel-actions.js` 从 `state.duelSpecialCards.cards` 读取并生成特色手牌动作
- 该文件与 `data/duel-card-templates-v0.1-candidate.json` 互补
- 审判（日车）和 Jackpot（秤）领域专属卡不写入本文件，由领域脚本动态生成

## 2. 文件结构

整个文件必须保持如下顶层结构：

```json
{
  "schema": "jjk-duel-special-cards",
  "version": "1.0.0",
  "cards": []
}
```

每张卡是 `cards` 数组内的一个 JSON 对象。字段顺序不限，但不得出现草案时期字段，例如 `statBinding`、`mechanicTags`、`powerHint`、`suggestedRarity`、`techniqueId`、`techniqueName`、`duplicateWarning`、`migrationNotes`。

## 3. 每张卡必填字段

| 字段 | 类型 | 要求 |
| --- | --- | --- |
| `cardId` | string | 唯一标识，建议 `card_feature_<术式>_<编号>` |
| `sourceActionId` | string | 全局唯一动作源 ID，可与 `cardId` 对应 |
| `name` | string | 卡牌名 |
| `cardType` | string | 卡牌类型，见第 4 节 |
| `apCost` | number | 旧字段，仅用于兼容历史数据；普通手札结算不再读取它，新增卡可省略或固定为 `0` |
| `baseCeCost` | number | 基础咒力消耗 |
| `baseDamage` | number | 基础伤害，填写未经过运行时乘区修正的原始值 |
| `baseBlock` | number | 基础格挡 |
| `baseStabilityDamage` | number | 基础稳定伤害 |
| `baseCeDamage` | number | 基础咒力伤害 |
| `baseDomainLoadDelta` | number | 领域负荷变化 |
| `baseDomainPressure` | number | 领域压力值 |
| `durationRounds` | number | 持续回合数 |
| `damageType` | string | 伤害类型，如 `melee`、`technique`、`domain`、`soul`、`physical` |
| `scalingProfile` | string | 缩放档案，如 `techniquePower + control` |
| `accuracyProfile` | string | 命中档案，如 `melee`、`technique_projectile`、`technique_area`、`none` |
| `evasionAllowed` | boolean | 是否允许闪避 |
| `hitRateModifier` | number | 命中率修正 |
| `risk` | string | `low`、`medium`、`high`、`critical` |
| `rarity` | string | `common`、`uncommon`、`rare`、`special`、`domain` 等 |
| `tags` | array | 展示标签，需包含 `特色手札`、术式/技能/角色相关标签 |
| `specialHandTags` | array | 关键匹配字段，必须与角色侧标签完全一致 |
| `allowedContexts` | array | 如 `normal`、`domain`、`trial_allowed`、`soul_combat` |
| `effectSummary` | string | UI 显示的效果简述 |
| `effects` | object | 额外效果；无额外效果填 `{}` |
| `requirements` | object | 使用条件；无条件填 `{}` |
| `playableInHandBeta` | boolean | 建议 `true` |
| `status` | string | `CONFIRMED` 或 `CANDIDATE` |

召唤类卡还必须填写 `summonSpec`。非召唤类卡的 `summonSpec`、`mechanismSpec`、`resourceSpec` 可设为 `null`。

## 4. `cardType` 映射

| 原始意图 | 正式 `cardType` |
| --- | --- |
| `attack` | `technique` |
| `defense` | `defense` |
| `resource` | `resource` |
| `support` | `support` |
| `mobility` | `technique` |
| `control` | `technique` |
| `summon` | `summon` |
| `finisher` | `technique` |
| `domain` | `domain` |
| `soul` | `technique` |
| `rule` | `rule` |

## 5. 数值转换

从草案 `balancedRuntimeStats` 迁移时使用以下规则：

- `baseStabilityDamage = controlValue * 0.55`
- `baseCeDamage = soulDamage * 0.35`
- `baseDomainPressure` 优先保留原稿值；没有原稿值时可用 `controlValue`
- 其余数值直接复制
- `baseDamage` 只记录基础值，不要把运行时的伤害乘区提前折算进去

## 6. 角色匹配规则

特色手牌是否发放，核心取决于 `specialHandTags`。

运行时只使用当前角色显式声明的 `specialHandTags` / `特殊手札` 做匹配。

卡片 `specialHandTags` 必须与角色侧显式 `specialHandTags` 有完全一致的交集，才视为该角色可用。自动推断出的 `archetypes`、角色名、术式名、文本描述、旧别名和 `FEATURE_TECHNIQUE_ALIASES` 都不能让特色手牌发放。

硬性要求：

- 优先使用 `character/manifest.json` 中已经存在的 `specialHandTags`
- 如果角色缺少对应标签，先补 `manifest.json`，再在卡片中引用
- 严禁继续使用草案自由别名，例如 `limitless`
- 应使用统一标准标签，例如 `gojo_limitless`
- 不要依赖 `duel-actions.js` 里的硬编码别名 `FEATURE_TECHNIQUE_ALIASES`
- 不要依赖角色卡文本自动推断的 `archetypes`
- 同一张卡不要为了兼容旧别名复制成多张；应保留一张卡，并把兼容标签合并进同一个 `specialHandTags` 数组

常用标签：

| 角色/术式 | `specialHandTags` |
| --- | --- |
| 五条悟 | `gojo_limitless` |
| 宿傩 | `sukuna_slash` |
| 伏黑惠 | `ten_shadows` |
| 真人 | `mahito_soul_transfiguration` |
| 乙骨忧太 | `okkotsu_rika_copy` |
| 虎杖悠仁（68 年后） | `yuji_soul_melee`, `hutian_black_flash` |
| 胀相 / 加茂宪纪 | `blood_manipulation` |
| 鹿紫云一 | `kashimo_mythical_beast` |
| 漏瑚 | `disaster_flames` |
| 花御 | `disaster_plants` |
| 陀艮 | `disaster_tides` |
| 黑沐死 | `curse_spirit_general`, `swarm` 等 |
| 黄栌折 | `self_destructive_burst`, `rct_user` 等 |
| 雷吉·斯塔 | `recontract_icon`, `receipt_materialization` 等 |

## 7. 召唤类卡额外要求

`cardType: "summon"` 的卡必须额外填写 `summonSpec`：

```json
"summonSpec": {
  "unitCardId": "card_unit_xxx",
  "placement": "frontline",
  "control": "player_controlled"
}
```

`unitStats` 等单位定义可放在对应模板数据中，本文件只保存调用引用即可。

## 8. 可留空字段

- `effects`: 无额外效果时填 `{}`
- `requirements`: 无特殊条件时填 `{}`
- `summonSpec`: 非召唤类卡填 `null`
- `mechanismSpec`: 非机制类卡填 `null`
- `resourceSpec`: 非资源类卡填 `null`

## 9. 禁止事项

- 不要导入草案字段：`mechanicTags`、`statBinding`、`powerHint`、`suggestedRarity`、`duplicateWarning`、`migrationNotes` 等
- 不要添加 `importableFromMergedPackage: false` 的草案卡
- 不要添加状态为 `SUPERSEDED_BY_CONFIRMED_CARD` 的草案卡
- 不要把审判/Jackpot 领域专属卡写入本文件
- 不要让 `specialHandTags` 使用未标准化别名
- 不要让 AI 或人工卡面把系统运行时乘区提前写入 `baseDamage`

## 10. 示例

```json
{
  "cardId": "card_feature_limitless_004",
  "sourceActionId": "feature_limitless_004",
  "name": "虚式茈",
  "cardType": "technique",
  "baseCeCost": 54,
  "baseDamage": 24,
  "baseBlock": 0,
  "baseStabilityDamage": 6.6,
  "baseCeDamage": 0,
  "baseDomainLoadDelta": 5,
  "baseDomainPressure": 12,
  "durationRounds": 0,
  "damageType": "domain",
  "scalingProfile": "ceMaxOutput + techniquePower + control",
  "accuracyProfile": "technique_area",
  "evasionAllowed": true,
  "hitRateModifier": 0,
  "risk": "high",
  "rarity": "rare",
  "tags": ["特色手札", "术式", "虚式茈", "无下限术式", "purple", "high_output"],
  "specialHandTags": ["gojo_limitless"],
  "allowedContexts": ["domain", "trial_allowed", "normal"],
  "effectSummary": "合成苍与赫，发出高密度虚式冲击。",
  "effects": {},
  "requirements": {},
  "summonSpec": null,
  "mechanismSpec": null,
  "resourceSpec": null,
  "playableInHandBeta": true,
  "status": "CONFIRMED"
}
```

## 11. 验证流程

修改 `data/duel-special-card.json` 后：

1. 确认 JSON 可解析
2. 刷新页面
3. 在战斗界面选择对应角色
4. 打开控制台检查动作池：

```javascript
var pool = JJKDuelActions.buildDuelActionPool(leftActor, rightActor, state.duelBattle);
console.log(pool.filter(function(card) {
  return card.techniqueFeatureHand || card.specialHandCard;
}));
```

如果特色手牌没有出现，检查角色侧标签：

```javascript
JJKDuelHand.buildDuelCharacterCardProfile(leftActor).explicitSpecialHandTags
```

优先排查：

- 卡片 `specialHandTags` 是否与角色侧完全一致
- `manifest.json` 是否已补充对应角色标签
- 卡片是否误用旧别名
- 卡片是否被错误放入普通模板池
- `playableInHandBeta` 和 `allowedContexts` 是否合理
