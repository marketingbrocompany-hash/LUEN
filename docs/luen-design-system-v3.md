# LUEN Design System V3

## 1. Brand direction

LUEN should feel like a cross-border creative brand that understands creator culture, turns it into content, and connects that content to measurable business action.

The visual system should communicate this without relying on explanatory copy.

**Brand keywords**

- Editorial
- Culture
- Movement
- Precision

The site should not look like:
- a generic influencer agency
- a SaaS dashboard
- a consulting template
- a marketplace for booking creators

The site should feel like:
- a contemporary creative/media brand
- a team that understands Korea and Japan at the same time
- a company that moves from culture → content → business response

---

## 2. Core visual language

### Warm Ivory — Canvas
Use as the primary background.

`#F5F3EE`

Purpose:
- editorial whitespace
- premium, calm base
- lets media and orange signals stand out

### Deep Espresso — Contrast / Proof
Use for sections where results, media, or data need high focus.

`#15100D`

Use intentionally, not everywhere.

Recommended:
- Business Results
- Selected Work
- Performance
- FAQ

### LUEN Orange — Signal / Result / Action
Primary brand accent.

`#D96532`

Use only when information needs to signal movement or importance.

Orange is for:
1. **Signal** — dots, rails, small indicators
2. **Result** — important metrics and proof
3. **Action** — CTA and active state

Do not use orange merely as decoration on every heading, border, card, and label.

---

## 3. Orange Signal motif

The small LUEN signal dot is the repeatable visual identity.

It can appear as:
- a dot before a label
- the start point of a thin line
- a progress point across a campaign journey
- a result indicator
- an active action state

The goal is that repeated use creates an unconscious association:

**Orange signal = LUEN**

Avoid excessive glowing, pulsing, or gaming-style effects.

---

## 4. Typography

Primary Korean/Japanese display/body:
- Pretendard Variable
- Noto Sans JP fallback

UI / English labels:
- Inter

### Desktop scale

- Hero: 60–84px
- Major section: 48–66px
- Normal section: 36–50px
- Feature title: 24–36px
- Body: 14–16px
- Evidence / caption: 11–13px
- Micro label: 10–11px minimum

### Mobile scale

- Hero: 39–52px
- Major section: 36–45px
- Normal section: 30–37px
- Body: 13–14px
- Micro label: 9–10.5px minimum

Do not make every section title the same size.

Every screen needs one visual priority:
- typography
- media
- metric
- proof

Only one should dominate at a time.

---

## 5. Radius system

Large rounded cards should not be the default LUEN UI.

- XS: 4px — media / evidence / tags
- SM: 8px — standard panels / buttons
- MD: 12px — limited large media panels
- LG: 16px — exceptional use only
- Pill: only for tags / compact statuses where semantically appropriate

Avoid 20–30px radius for normal information cards.

---

## 6. Cards

Before creating a card, ask:

**Does this information actually need a container?**

Prefer:
- whitespace
- thin divider
- media
- typography
- aligned columns

over:
- repeated beige boxes
- repeated rounded rectangles
- identical equal-height service cards

Cards should be used only when containment itself has meaning.

---

## 7. Media

LUEN is a creator marketing company. Actual content should have stronger visual authority than decorative UI.

Prefer:
- large creator frames
- real campaign content
- actual campaign proposal pages
- proof screenshots
- store POP
- real visit / review evidence

Avoid:
- heavy desaturation
- unnecessary dark overlays
- generic stock-style imagery
- shrinking real creator content inside decorative cards

Default image treatment:
- natural saturation
- restrained contrast adjustment
- minimal filtering

---

## 8. Motion

Motion should feel controlled and intentional.

Primary motion language:
1. Signal movement
2. Media reveal
3. Editorial transition

Avoid:
- every card lifting 5px
- excessive glowing
- too many independent animations
- motion that exists only because it is possible

If movement does not reinforce hierarchy or direction, remove it.

---

## 9. Page rhythm

Recommended information hierarchy:

1. Hero
2. Client proof
3. Business Results
4. Case Studies
5. What LUEN Does
6. Cross-border Advantage
7. Selected Work
8. Content / Real Deliverable / Performance
9. Process
10. Client Voice
11. FAQ
12. Contact

The page should alternate between:
- quiet editorial canvas
- strong proof/data/media scenes

Do not make every section visually equally loud.

---

## 10. Case Study rule

Each case should answer:

1. What happened?
2. What consumer behavior changed?
3. What LUEN designed or connected?

Priority order:

**Result → Evidence → Explanation**

Not:

**Campaign description → approach → vague benefit**

Signature cases can use unique structures if their proof is stronger in a different format.

---

## 11. Copy style

Use natural business Korean.

Avoid:
- abstract marketing slogans with no concrete meaning
- repetitive “연결합니다 / 설계합니다 / 만들어냅니다”
- AI-like conclusion phrases
- exaggerated adjectives
- generic agency language

Good copy should sound like an experienced operator explaining what actually happens.

### Clinic language guardrail

Do **not** use language that can imply that LUEN is a licensed/registered medical patient attraction business.

Avoid:
- 일본 환자 유치
- 외국인 환자 유치
- 일본 고객 유치, when used in a clinic context and likely to imply patient-attraction activity
- any phrasing that suggests LUEN directly recruits or brokers medical patients

Prefer factual marketing descriptions such as:
- 일본 시장 대상 콘텐츠 마케팅
- 일본 소비자 대상 클리닉 콘텐츠
- 일본 크리에이터 협업 캠페인
- 일본 시장 커뮤니케이션
- 클리닉 브랜드 콘텐츠 마케팅

When in doubt, describe the **marketing/content activity**, not patient acquisition.

---

## 12. UI/UX rules

Before adding or changing a component, check:

1. Does this look like it has always belonged to LUEN?
2. Does it strengthen the hierarchy?
3. Is it necessary to put it in a box?
4. Can the same idea be shown with media or evidence instead?
5. Is the text readable on a real laptop and phone?
6. Is the mobile experience intentionally designed, not merely stacked?

---

## 13. Implementation policy

`assets/css/luen-v3.css` is the authoritative design layer for migrated sections.

Legacy files remain temporarily for backward compatibility.

When a section is verified in V3:
1. Move its final visual rules into the V3 system.
2. Confirm desktop / tablet / mobile.
3. Remove redundant legacy override rules only after verification.
4. Never blindly delete or globally overwrite old CSS before the migrated section is checked.

No force-push or destructive broad rewrite for visual cleanup.

---

## 14. Current V3 migration status

Migrated:
- Hero
- Client logo rail
- Business Results
- Capability
- Case Studies
- What LUEN Does foundation
- Cross-border Advantage
- Selected Work
- Core Expertise / Content
- Real Deliverable
- Performance
- Process
- Client Voice
- FAQ
- Contact

Remaining technical cleanup:
- remove redundant rules from legacy CSS after visual QA
- consolidate duplicated mobile overrides
- verify real-device typography and spacing
- complete PC/mobile visual QA when browser access is available
