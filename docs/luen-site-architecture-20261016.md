# LUEN Website Architecture — Phase 1

Date: 2026-10-16  
Status: Architecture baseline before implementation  
Branch: `plan/site-architecture-20261016`

## 0. Purpose

LUEN의 기존 단일 페이지 홈페이지를 유지하면서, 검색 유입과 B2B 문의 전환을 확장할 수 있는 다중 페이지 구조로 단계적으로 확장한다.

핵심 원칙:
- 현재 운영 중인 메인페이지의 브랜드 감도와 사례 자산을 버리지 않는다.
- 메인페이지는 LUEN 전체를 보여주는 허브로 단순화한다.
- 상세 서비스/사례/가이드 페이지는 검색 의도와 구매 의도에 맞춰 분리한다.
- 페이지 수를 늘리기 위한 얇은 페이지는 만들지 않는다.
- 각 상세페이지는 SEO 페이지가 아니라 실제 영업자료처럼 읽혀야 한다.
- PC와 모바일을 동시에 설계한다.
- 한 작업 묶음 = 한 브랜치, 여러 커밋, 최종 QA, PR 1개 원칙을 따른다.

---

## 1. Site Navigation

### Primary Navigation

1. SERVICES
2. CASE STUDIES
3. INSIGHTS
4. PROJECT GUIDE
5. ABOUT
6. PROJECT INQUIRY

### Utility Navigation

- 고객 로그인
- LUEN 로고 → Home

### Terminology Rule

홈페이지 전체에서 아래 용어 원칙을 적용한다.

- 기본 표현: **크리에이터 매칭**
- 사용하지 않는 기본 표현: **크리에이터 섭외**
- 실제 실행 과정은 필요에 따라:
  - 크리에이터 협의
  - 조건 조율
  - 일정 조율
  - 커뮤니케이션
  - 계약
  로 구분한다.

의도:
`매칭`은 단순 연락 대행보다 브랜드·타깃·콘텐츠 포맷에 맞는 크리에이터 조합을 설계한다는 LUEN의 역할을 더 정확히 표현한다.

---

## 2. Sitemap

### Level 0

- `/` — Home
- `/services/` — Services Hub
- `/cases/` — Case Studies Hub
- `/insights/` — Insights Hub
- `/project-guide/` — Project Guide
- `/about/` — About LUEN
- `/contact/` — Project Inquiry

### Services

- `/services/japan-marketing/`
- `/services/japan-creator-marketing/`
- `/services/japan-inbound/`
- `/services/youtube-creator-marketing/`

### Initial Case Studies

- `/cases/herahera-seoul-fnb/`
- `/cases/ikeda-edita/`
- `/cases/yuki-clinic/`
- `/cases/masubuchi-bibigo/`

### Initial Insights

- `/insights/japan-influencer-marketing-cost/`
- `/insights/japan-youtuber-matching-guide/`
- `/insights/how-to-choose-japan-marketing-agency/`
- `/insights/youtube-creator-marketing-metrics/`
- `/insights/japan-inbound-creator-marketing/`

초기 구현은 모든 페이지를 한 번에 만들지 않는다. Home → Services Hub → Japan Creator Marketing을 먼저 제작하고 검증한 뒤 확장한다.

---

## 3. Page Roles & Search Intent

### Home

Role:
- LUEN이 어떤 회사인지 빠르게 이해
- 실제 성과와 신뢰 확인
- 방문자가 자신에게 맞는 서비스 페이지로 이동
- Project Inquiry 유도

Primary themes:
- 한국·일본 크리에이터 마케팅
- 유튜브 크리에이터 마케팅
- 일본 마케팅
- 브랜드 콘텐츠

Home은 특정 키워드 하나에 과도하게 맞추지 않는다.

### Services Hub

Role:
- 방문자의 상황을 4개 서비스 유형으로 분기
- 각각의 상세 서비스 페이지로 안내

Cards:
1. Japan Market Entry
2. Japan Creator Marketing
3. Japan Inbound
4. YouTube Creator Marketing

### Japan Marketing

Primary search intent:
- 일본 마케팅 대행사
- 일본 진출 마케팅
- 일본 SNS 마케팅

Client:
- 일본 시장 진출을 고민하는 한국 브랜드
- 채널/크리에이터가 아직 확정되지 않은 담당자

Core promise:
시장 진입 방향부터 크리에이터, 콘텐츠, 실행까지 연결.

### Japan Creator Marketing

Primary search intent:
- 일본 인플루언서 마케팅
- 일본 크리에이터 마케팅
- 일본 유튜버 매칭
- 일본 인플루언서 매칭

Client:
- 일본 크리에이터 캠페인 실행 의도가 명확한 브랜드

Core promise:
브랜드와 목표에 맞는 크리에이터 매칭부터 콘텐츠 설계·운영·성과 확인까지.

### Japan Inbound

Primary search intent:
- 일본 인바운드 마케팅
- 일본인 관광객 마케팅
- 방한 일본인 마케팅
- 일본인 환자 마케팅

Client:
- 한국 F&B
- Clinic / Beauty
- Retail / Experience

Core promise:
일본 콘텐츠 노출을 한국 방문·예약·구매 행동으로 연결.

### YouTube Creator Marketing

Primary search intent:
- 유튜브 크리에이터 마케팅
- 유튜브 마케팅 대행사
- 유튜버 마케팅
- 유튜브 롱폼 마케팅

Client:
- 단발 숏폼보다 설명력·검색 잔존성·브랜드 맥락이 필요한 브랜드

Core promise:
Creator Fit, 콘텐츠 구조, 장면 설계, 검색/행동 연결, 성과 확인.

### Case Studies

Role:
- '할 수 있다'가 아니라 '해봤다'를 증명
- 서비스 페이지의 주장에 구체적 근거 제공

### Insights

Role:
- 구매 의도가 높은 검색 질문을 선점
- 정보 탐색 단계의 잠재 고객을 서비스/사례/문의로 연결

### Project Guide

Role:
- 계약 직전의 불확실성 해소
- 과정, 기간, 예산 구조, 산출물, FAQ 제공

### About

Role:
- LUEN의 관점과 운영 방식
- Korea ↔ Japan cross-border 역량
- 단순 크리에이터 리스트 대행사가 아닌 전략/운영 파트너라는 포지셔닝

### Contact

Role:
- Project Inquiry 전환
- 문의 전 고객이 필요한 최소 정보를 쉽게 전달하도록 설계

---

## 4. Home — New Information Architecture

현재 메인의 모든 내용을 유지하지 않고, 허브 역할에 맞춰 다음 순서로 재편한다.

### 01 Hero — KEEP

Existing:
"조회수를 만드는 것과 구매를 만드는 것은 다릅니다."

Action:
- 유지
- 현재 warm beige/orange/editorial 방향 유지
- 서비스 설명을 Hero에 과도하게 추가하지 않음

### 02 Selected Partners — KEEP

Role:
- 초기 신뢰 형성
- 현재 loop 유지

### 03 Brand Challenge — NEW

Source:
LUEN proposal "BRAND CHALLENGE"

Web interpretation:

VIEWER
- 광고를 넘깁니다.
- 재미와 신뢰할 이유를 찾습니다.

LUEN
- 브랜드가 하고 싶은 말을
- 시청자가 보고 싶은 장면으로 바꿉니다.

BRAND
- 인지에서 끝나지 않고
- 검색·방문·예약·구매로 이어져야 합니다.

Purpose:
Hero의 "조회수 ≠ 구매" 메시지에 논리적 설명을 제공.

Design:
- PPT Venn diagram 그대로 복제하지 않음
- 3-part editorial flow
- thin orange line / index / subtle directional motion
- mobile: vertical stack

### 04 What LUEN Does — NEW / RESTRUCTURE

4 service gateways:
- Japan Market Entry
- Japan Creator Marketing
- Japan Inbound
- YouTube Creator Marketing

Each block:
- who it is for
- one-line promise
- relevant case hint
- Explore service CTA

### 05 Selected Case Studies — KEEP + LINK OUT

Existing 대표 캠페인을 유지하되 각 카드/챕터가 상세 Case Study로 연결되도록 확장.

Featured:
- ヘラヘラ三銃士 × 순미네행복게장
- 池田真子 × EDITA
- 美容看護師 YUKI chan
- 爆食ますぶちさちよ × bibigo

### 06 Selected Work — KEEP

Role:
- 실제 발행 콘텐츠의 시각적 증거
- 상세 서비스 설명과 분리

### 07 LUEN Content Flow — NEW SUMMARY

Source:
Proposal "LUEN CONTENT FLOW"

Steps:
01 CREATOR FIT
02 MESSAGE
03 CONTENT BUILD
04 SCENE
05 ACTION FLOW
06 PERFORMANCE

Home에서는 각 단계 1줄만.

CTA:
View Project Guide / How LUEN Works

### 08 Results / Performance — KEEP

Existing performance section 유지.
단, 서비스 페이지와 사례 상세페이지에 중복되는 설명은 추후 축약 가능.

### 09 Client Voice — KEEP

Role:
- quantitative proof 이후 qualitative proof

### 10 FAQ — KEEP / SHORTEN LATER

Home에서는 가장 핵심적인 FAQ만.
나머지는 Project Guide 또는 service page로 확장.

### 11 Project Inquiry — KEEP

메인 최종 전환.

---

## 5. Service Page Template

모든 상세 서비스 페이지는 동일한 기본 구조를 사용하되 콘텐츠만 다르게 한다.

1. Hero
2. Client Problem / Market Context
3. What We Do
4. LUEN Content Flow
5. Creator Fit Examples
6. Related Case Studies
7. Deliverables
8. Campaign Process
9. Budget / Scope Guide
10. FAQ
11. Project Inquiry

### Hero Rule

SEO 문구를 제목에 억지로 나열하지 않는다.

Bad:
"일본 인플루언서 마케팅 대행사 | 일본 유튜버 섭외 | SNS..."

Good:
"브랜드에 맞는 일본 크리에이터를
매칭하는 것에서 끝나지 않습니다."

Kicker:
JAPAN CREATOR MARKETING

Supporting copy에 핵심 키워드를 자연스럽게 포함.

---

## 6. Japan Creator Marketing — First Detailed Page

### Hero

Kicker:
JAPAN CREATOR MARKETING

Headline:
브랜드에 맞는 일본 크리에이터를  
매칭하는 것에서 끝나지 않습니다.

Body:
브랜드 목표와 타깃, 콘텐츠 포맷을 기준으로 크리에이터를 매칭하고,
콘텐츠 설계부터 일정 조율, 가이드, 발행, 성과 확인까지 운영합니다.

CTA:
- 프로젝트 방향 상담하기
- 사례 보기

### Proof strip

Examples:
- 460K / 30-DAY VIEWS
- 1,000+ / RESERVATIONS
- 2M+ / SHORT-FORM VIEWS

실제 확인 가능한 수치만 사용한다.

### Client Challenge

단순히 채널 규모를 나열하지 않는다.
- 브랜드와 시청자가 겹치는가
- 기존 콘텐츠 포맷과 브랜드가 자연스럽게 결합 가능한가
- 설명형/체험형/방문형 중 무엇이 맞는가
- 콘텐츠 이후 행동까지 연결 가능한가

### What We Do

- Campaign Direction
- Creator Matching
- Communication & Coordination
- Content Planning
- Production Guide
- Publishing Management
- Performance Review

### LUEN Content Flow

01 Creator Fit  
브랜드·채널·시청자 적합도 판단

02 Message  
브랜드 핵심 가치 정의

03 Content Build  
크리에이터 콘텐츠 흐름에 맞춘 구조 설계

04 Scene  
기억에 남는 장면으로 변환

05 Action Flow  
검색·방문·예약·구매 동선 연결

06 Performance  
발행 이후 데이터와 반응 확인

### Creator Fit Examples

웹에서는 "보유 크리에이터"로 표현하지 않는다.

Section title:
CREATOR FIT EXAMPLES

Example fields:
- Creator
- Category
- Audience / Content Style
- Best Fit
- Related Result

Initial examples:
- ヘラヘラ三銃士
- 爆食ますぶちさちよ
- 池田真子
- 美容看護師 YUKI chan

Disclaimer:
프로젝트별 브랜드, 목표, 일정, 예산에 맞춰 별도 크리에이터 매칭을 진행합니다.

### Related Cases

- F&B / Japan Inbound
- Beauty / Commerce
- Clinic / Reservation
- Food / Online × Offline

### CTA

"우리 브랜드에 맞는 일본 크리에이터 방향 확인하기"

---

## 7. Case Study Template

Structure:

1. Project Intro
2. Challenge
3. Strategy
4. Creator Fit
5. Content
6. Action Flow
7. Result
8. Related Service
9. Project Inquiry

### Result Rule

View / Like / Comment만 나열하지 않는다.

가능한 경우:
- Search
- Reservation
- Purchase
- Ranking
- Offline visit
- Repeat exposure
- Content longevity

등 브랜드 목표와 연결된 결과를 우선.

---

## 8. Initial Case Study Mapping

### Herahera × 순미네행복게장

Position:
Japan Inbound / F&B / YouTube / Offline Extension

Existing homepage assets:
- featured campaign
- 30-day views
- likes/comments
- POP extension

Proposal reuse:
- Viewer/Brand challenge logic
- Action Flow concept

### Ikeda Mako × EDITA

Position:
Japan Market / Beauty / Commerce

Proof:
Rakuten bag category ranking

Proposal reuse:
- Creator Fit
- product review / purchase persuasion structure

### YUKI chan

Position:
Japan Inbound / Clinic / Beauty

Proof:
reservation conversion

Proposal reuse:
- expertise / trust / clinic targeting

### Masubuchi × bibigo

Position:
Japan Market + Inbound / F&B

Proof:
short-form views + online/offline connection

---

## 9. Project Guide

### Sections

1. Who this is for
2. Campaign Process
3. Timeline
4. Deliverables
5. Budget Guide
6. What affects cost
7. FAQ
8. Inquiry

### Campaign Process

Source:
Proposal "LUEN CAMPAIGN PROCESS"

Web version:
01 상담 / 목표 정의
02 전략 / 방향 제안
03 계약 / 조건 확정
04 Creator Matching
05 Production & Publishing
06 Performance Report

"유튜버 매칭"처럼 플랫폼에 한정하지 않는다.

### Budget Guide

제안서의 세부 구독자별 고정 가격표를 웹에 그대로 노출하지 않는다.

Reason:
- 고정 단가로 오해 가능
- 콘텐츠 포맷/촬영/활용권/방문 조건이 빠짐
- 브랜드별 협의 구조와 충돌

Web version:
- Test Campaign
- Growth Campaign
- Brand Campaign
- Custom / Large Creator

Cost factors:
- Platform
- Creator profile
- Content format
- Number of creators
- Korea/Japan visit
- Production scope
- Usage rights
- Timeline

초기 구현에서는 가격 구간을 확정하지 않고 구조만 설계.
공개 가격 여부는 실제 계약 데이터 검토 후 결정.

---

## 10. About

Proposal reuse:
- LUEN Identity
- Creator-centered content design
- brand × creator fit
- branded + experience structure

Suggested sequence:

1. LUEN Identity
2. Korea ↔ Japan
3. How We Think
4. How We Match Creators
5. How We Build Content
6. How We Operate
7. Project CTA

Closing message candidate:
"소비자의 기억 속 한 장면, 이제 당신의 브랜드 차례입니다."

웹에서는 더 자연스럽게 다듬어 사용할 수 있음:
"다음에 기억될 장면은, 당신의 브랜드일 수 있습니다."

---

## 11. Insights Strategy

Insights는 일반 트렌드 뉴스가 아니라 높은 구매 의도의 질문부터 작성한다.

Initial topics:

1. 일본 인플루언서 마케팅 비용은 어떻게 정해질까?
2. 일본 유튜버 매칭 전 확인해야 할 기준
3. 일본 마케팅 대행사 선택 전 확인해야 할 것
4. 유튜브 크리에이터 마케팅에서 조회수 외에 봐야 할 지표
5. 일본인 관광객을 한국 매장으로 연결하는 크리에이터 마케팅

Article template:
- direct answer
- decision factors
- practical examples
- common mistakes
- relevant LUEN case
- related service
- CTA

---

## 12. Proposal Content Usage Matrix

| Proposal asset | Home | Service | Project Guide | About | Insights |
|---|---|---|---|---|---|
| LUEN Identity | summary | - | - | primary | - |
| Brand Challenge | primary | adapted | - | philosophy | - |
| Proposal Background | - | market context | - | - | primary |
| LUEN Content Flow | summary | primary | supporting | methodology | supporting |
| Creator Line-up | - | Creator Fit examples | - | - | - |
| Casting Cost | - | cost factors | primary | - | cost content |
| Campaign Process | summary link | supporting | primary | - | - |
| Closing message | CTA | CTA | CTA | primary | CTA |

---

## 13. Design Direction

### Keep from current website

- warm beige background
- LUEN orange CTA
- editorial typography
- generous whitespace
- large headline hierarchy
- restrained black/charcoal
- image-first case presentation

### Borrow from proposal

- section numbering: 01 / 02 / 03
- thin orange rule
- process/system diagrams
- structured metrics
- English kicker + Korean message
- modular information hierarchy

### Do not copy directly from proposal

- dense PowerPoint bullet layouts
- large grey table blocks
- too many white rounded cards
- tiny body text
- static diagram pasted as image
- decorative objects that do not serve web interaction

Rule:
Proposal UX / information logic is reused.
Proposal PPT appearance is not copied.

---

## 14. Mobile Rules

Design mobile from first implementation.

- Hero: text first
- Brand Challenge: 3 vertical stages
- Services: 1 column
- Content Flow: vertical step sequence
- Creator Fit: horizontal swipe or 1-column cards
- Case studies: content-first 1-column
- Budget: cards, not wide tables
- Process: vertical timeline
- CTA: sticky/floating behavior only if it does not obscure content
- no page-level horizontal overflow

Target QA viewports:
- 1440 × 1000
- 1280 × 900
- 390 × 844
- 375 × 812
- 320 × 700

---

## 15. Internal Linking

### Home

Home → all four services  
Home → selected cases  
Home → Project Guide  
Home → Contact

### Service pages

Service → related cases  
Service → Project Guide  
Service → related insight  
Service → Contact

### Case pages

Case → related service  
Case → related case  
Case → Contact

### Insight pages

Insight → related service  
Insight → relevant case  
Insight → Project Guide where applicable  
Insight → Contact

### Project Guide

Project Guide → all services  
Project Guide → case examples  
Project Guide → Contact

---

## 16. SEO Implementation Rules

Every new indexable page must have:
- unique title
- unique meta description
- canonical
- Open Graph
- Twitter metadata
- one clear H1
- structured internal links
- descriptive image alt
- JSON-LD where appropriate
- sitemap inclusion

Do not:
- repeat the same title across pages
- stuff keywords into H1
- build thin SEO-only pages
- copy service copy across multiple URLs

Search Console data should inform iteration after enough data accumulates.

---

## 17. Development Rollout

### Phase 1 — Architecture
- this document
- sitemap
- navigation
- terminology
- URL strategy
- page responsibilities

### Phase 2 — Home restructuring
- Brand Challenge
- Services gateway
- Content Flow summary
- navigation update
- keep current live visual identity

### Phase 3 — Services Hub + Japan Creator Marketing
- first full service template
- first real conversion path

### Phase 4 — Remaining Services
- Japan Marketing
- Japan Inbound
- YouTube Creator Marketing

### Phase 5 — Case Studies
- hub
- four initial cases

### Phase 6 — Project Guide
- process
- deliverables
- timeline
- budget framework
- FAQ

### Phase 7 — About + Contact refinement

### Phase 8 — Insights
- hub
- five initial high-intent articles

### Phase 9 — Technical SEO
- per-page metadata
- JSON-LD
- sitemap
- robots
- internal links
- Search Console validation

### Phase 10 — Full QA
- desktop
- mobile
- interactions
- forms
- console
- overflow
- broken images
- SEO
- performance

---

## 18. Phase 1 Acceptance Criteria

Phase 1 is complete when:

- site navigation is defined
- URLs are defined
- page roles are distinct
- initial keyword intent is mapped
- current homepage reuse is mapped
- proposal content reuse is mapped
- terminology is standardized to "크리에이터 매칭"
- implementation order is fixed
- no live production code has been changed

Next implementation target:
**Phase 2 — Home restructuring**
