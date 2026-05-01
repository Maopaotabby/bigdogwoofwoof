# Technique Card Drafts

Status: CANDIDATE

This directory layer defines a draft framework for ordinary innate technique cards. It is not a playable deck system and does not replace the existing duel card/action/domain files.

## Files

- `data/technique-card-draft-schema-v0.1-candidate.json`
  Defines required draft card fields, enum values, duplicate policy, and ordinary technique boundaries.
- `data/technique-card-drafts-v0.1-candidate.json`
  Stores the explicit ordinary technique allowlist and a small number of draft examples.
- `data/technique-card-existing-index-v0.1-candidate.json`
  Generated index of existing action cards, card templates, domain records, strength records, wheel entries, and excluded non-ordinary entries.
- `data/technique-card-migration-map-v0.1-candidate.json`
  Placeholder routes for later moving accepted drafts into action-backed cards or domain interfaces.
- `scripts/build-technique-card-index.js`
  Rebuilds the existing index from current project data.
- `scripts/validate-technique-card-drafts.js`
  Validates draft fields, enum values, duplicates, allowlist membership, and excluded-entry boundaries.
- `data/technique-feature-hand-drafts-latest-manifest.json`
  Points to the latest reviewed feature-hand candidate package. As of 2026-05-01, this is v0.6.
- `data/technique-feature-hand-drafts-v0.6-merged-balanced.json`
  Full merged audit package for the v0.4 reviewed package plus the v0.5 untouched-only delta. It preserves every source card and marks merge-only entries.
- `data/technique-feature-hand-drafts-v0.6-runtime-import-candidates.json`
  Candidate pool after duplicate/mechanism filtering and balance recomputation. This is the only v0.6 file that should be used as the next manual mapping source.
- `data/technique-feature-hand-drafts-v0.6-merge-map.json`
  Records mechanism-level merge decisions for Deadly Sentencing, Jacob's Ladder / technique extinguishment, and conditional world slash.
- `scripts/review-feature-hand-drafts.cjs`
  Reviews raw external candidate packages, preserves original stats, adds migration fields, and produces reviewed package outputs.
- `scripts/merge-feature-hand-drafts.cjs`
  Merges reviewed packages and recomputes balanced runtime anchors with character-stat bindings.

## Commands

Run this after changing existing cards or adding draft cards:

```powershell
node scripts\build-technique-card-index.js
node scripts\validate-technique-card-drafts.js
```

The validation should pass with zero errors before draft data is used by another tool.

Review an external feature-hand candidate package:

```powershell
node scripts\review-feature-hand-drafts.cjs "C:\Users\15164\Downloads\candidate.json"
```

When reviewing an untouched-only delta against a prior reviewed package:

```powershell
node scripts\review-feature-hand-drafts.cjs "C:\Users\15164\Downloads\candidate.json" ".\data\technique-feature-hand-drafts-v0.4-reviewed.json"
```

Rebuild the latest merged v0.6 package:

```powershell
node scripts\merge-feature-hand-drafts.cjs
```

## Latest Reviewed Feature-Hand Package

As of 2026-05-01, use v0.6 as the latest reviewed package:

- Full audit package: `data/technique-feature-hand-drafts-v0.6-merged-balanced.json`
- Runtime mapping candidate pool: `data/technique-feature-hand-drafts-v0.6-runtime-import-candidates.json`
- Mechanism merge map: `data/technique-feature-hand-drafts-v0.6-merge-map.json`
- Summary: `data/technique-feature-hand-drafts-v0.6-merge-summary.txt`
- Manifest: `data/technique-feature-hand-drafts-latest-manifest.json`

Do not directly import v0.4 or v0.5 after v0.6 exists. v0.4 and v0.5 remain source/audit packages only.

v0.6 currently preserves 216 source cards, exposes 206 runtime import candidates, marks 7 cards as `needs_merge`, and marks 3 old `technique_extinguishment` records as superseded by the latest `angel_jacobs_ladder` mapping.

Mechanism decisions:

- `deadly_sentencing`: trial/confiscation/execution-sword cards are generated only by the local Deadly Sentencing subphase, not normal hand draw.
- `angel_jacobs_ladder`: Jacob's Ladder cards must merge into anti-technique/barrier/incarnation targeting logic before runtime import.
- `world_slash`: world slash remains a conditional mechanism and must not become a repeatable normal attack card.

Balance caps verified on v0.6 runtime candidates:

- `baseDamage <= 26`
- `baseBlock <= 32`
- `baseCeCost <= 58`
- `apCost <= 2`

Every v0.6 card includes `statBinding`; balanced values are base anchors and still need character-stat modifiers at runtime.

## Draft-Only Numeric Boundary

Draft cards must not write final combat fields directly. Keep these as `powerHint`, `effectDraft`, or `migrationNotes` until the target combat module owns the final values:

- `apCost`
- `ceCost`
- `costCe`
- `baseDamage`
- `baseBlock`
- `soulDamage`
- `domainLoadDelta`
- `scalingProfile`
- `ruleBasedConfig`
- `antiDomainInteraction`
- `exclusiveWith`
- `allowedWith`

## Ordinary Technique Boundary

The current wheel page named `生得术式` has 65 entries, but ordinary innate technique draft work must use the explicit allowlist in `technique-card-drafts-v0.1-candidate.json`.

Do not directly import every wheel entry as a draftable ordinary technique.

The following categories must not enter ordinary innate technique drafts:

- advanced mechanics such as `反转术式` and `反转术式外放`
- character skills such as `激震掌`
- derivative skills such as `可爱蜜糖`
- bloodline or species traits
- story identities such as `星浆体`
- Simuria species or bloodline talents
- curse/spirit special ability entries that are not ordinary innate techniques, including `瘟柩葬仪 —— 疱疮神`

These entries may appear in `existingButExcluded` so the duplicate detector can warn about overlap, but they are not draftable as ordinary innate technique cards.

## Domain Boundary

`cardIntent: "domain"` means the draft is related to a technique's possible domain expression. It does not directly create a playable domain expansion card.

Domain activation, domain passive effects, and domain-exclusive cards should migrate through:

- `domain-card-templates-v0.1-candidate.json`
- `domain-configs-v0.1-candidate.json`
- `duel-domain-profiles-v0.1-candidate.json`

## Adding Draft Cards

Add new entries under `draftCards`. Every card must:

- use `status: "CANDIDATE"`
- reference a technique from `ordinaryTechniqueAllowlist`
- set `duplicateStatus`
- set `duplicateWarning`, `variantOf`, `variantReason`, and `draftVariantType` when the draft is a variant, upgrade, domain version, rule version, or soul version
- fill `existingCardRefs` if it overlaps an existing card or action
- avoid final numeric balance unless deliberately marked as a draft hint
- explain blockers in `doNotFinalizeReason`

Use `draftRole: "variant"` when the idea is a deliberate alternate take on an existing card. Use `draftRole: "migration_placeholder"` only when the draft exists to reserve a future migration route.

## Rule And Soul Drafts

For `ruleRelated: true`, `migrationNotes` must state that rule-based domains can only coexist with `self_buff` and cannot retain `sure_hit`, `auto_attack`, `soul_damage`, or `hard_control`.

For `soulRelated: true`, `mechanicTags` must include at least one of:

- `soul_damage`
- `soul_boundary`
- `incarnated_sorcerer_counter`
- `vessel_separation`
- `soul_resonance`
