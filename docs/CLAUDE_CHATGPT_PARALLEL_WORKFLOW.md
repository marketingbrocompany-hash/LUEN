# LUEN 홈페이지 — Claude × ChatGPT 병행 작업 기준

> 2026-11-01 기준. 역할 분리 + GitHub PR 통합 방식. **운영 사이트와 고객 포털을 서로 독립적으로 관리합니다.**

## 1. 작업 담당

| 구분 | Claude | ChatGPT |
|---|---|---|
| HTML/CSS/JS 신규 개발 | 기능 구현·개별 PR·화면 검수 | 변경 전후 코드 리뷰·회귀 QA |
| 모바일 UX | 반응형/레이아웃/캡션·메뉴 수정 | Chromium/WebKit 및 실제 iPhone Safari QA |
| 성능 | 성능 최적화 후보 구현 | Lighthouse 기준선·후보 A/B 및 CLS/LCP/TBT 검증 |
| 결함 피드백 | 원본 PR에서 필요한 수정 | 재현 방법·수치·정확한 CSS/JS 위치를 원본 PR 코멘트로 전달 |
| 배포 | 명시 승인 전 `main` 병합 금지 | 통합 PR 검증 후 승인받아 운영 배포 |

## 2. 브랜치 및 PR의 원칙

1. **동시 개발은 허용, 같은 파일에 대한 무조정 동시 수정은 금지**. 작업 시작 시 PR 범위·파일·브랜치·기준 SHA를 공유합니다.
2. Claude는 기능별 `claude/*` 독립 브랜치에서 작은 PR을 제출합니다. `main`에 직접 push하거나 강제 덮어쓰지 않습니다.
3. ChatGPT는 독립 `qa/*` 또는 `perf/*` 브랜치에서 테스트/분석을 실행하고, 사용자에게 영향 주는 변경은 승인 없이는 병합하지 않습니다.
4. 여러 PR이 같은 `index.html` 캐시 버전·CSS·JS를 건드리면, 원본 PR을 **그대로 유지**한 채 기준 `main`에서 통합 검수 브랜치를 만듭니다. 한 원본의 head를 기반으로 다른 PR의 정확한 diff를 추가한 경우 SHA와 파일 범위를 기록합니다.
5. 통합 브랜치가 원본 각각과 무엇이 다른지 명시합니다. 통합 QA에서 발견된 문제는 원본 PR 코멘트로 피드백합니다.
6. 승인 없이 원본 PR과 통합 PR을 모두 개별 병합하면 중복 반영이 생길 수 있습니다. **최종 병합 경로는 하나로 선택**합니다.
7. 제작·통합 검수 시 운영 DNS, Formspree 실접수, 고객 로그인 포털, GitHub Pages 운영 호스트를 임의 변경하지 않습니다.

## 3. 통합 QA 체크리스트

- [ ] 모든 원본 PR의 head SHA 및 `main` 기준 확인, 변경 파일 충돌/누락 점검
- [ ] 정적 QA 및 플랫폼·사례·문의 Formspree **모의** 전송
- [ ] 반응형: 320 / 360 / 390 / 430 / 740 / 767 / 768 / 1440px
- [ ] Chromium + WebKit: 가로 넘침, 레이아웃, 글꼴, CTA 중복, 버튼 색상
- [ ] 네이티브 터치: 링크의 **실제 클릭 영역 높이·너비뿐 아니라 인접 링크와 충돌 여부** 검사
- [ ] YouTube·Instagram 릴스 이동/스와이프/애니메이션 재개
- [ ] 이미지 디코드, 히어로 3개 영상, 개인정보 안내·연락처
- [ ] LCP/FCP/TBT/CLS 성능 변화와 가독성 측정, 실제 iPhone Safari
- [ ] 모든 검사 통과 후 사용자 최종 승인, `main` 병합, 공식 `luenkorea.com` HTML 및 문의 경로 확인

## 4. 이번 실제 적용 예시

- Claude P1 [#256](https://github.com/marketingbrocompany-hash/LUEN/pull/256): 타임라인/FAQ 플로팅 CTA
- Claude P2 [#257](https://github.com/marketingbrocompany-hash/LUEN/pull/257): 모바일 가독성, 프로젝트 상담 버튼 오렌지 통일
- Claude P3 [#258](https://github.com/marketingbrocompany-hash/LUEN/pull/258): 릴스 카드 라벨
- ChatGPT **통합 Draft [#259](https://github.com/marketingbrocompany-hash/LUEN/pull/259)**: #256 head를 기반으로 #257·#258 변경을 충돌 없이 통합, 원본 PR 보존
- 통합 Chromium/WebKit QA에서 **P2의 푸터 링크 클릭영역 42~42.84px 및 랩핑 링크 약 9px 겹침** 발견 → 통합 브랜치에서만 44px 이상/충돌 0 보정, [Claude PR #257에 재현 내용](https://github.com/marketingbrocompany-hash/LUEN/pull/257) 기록
- [통합 browser QA](https://github.com/marketingbrocompany-hash/LUEN/actions/runs/41264552573): **10/10 PASS**, Chromium/WebKit × 320/390/767/768/1440
- [실제 iPhone 16 / iOS18 Safari](https://github.com/marketingbrocompany-hash/LUEN/actions/runs/41264773660): **6/6 PASS**. BrowserStack Local로 **운영 아닌 후보 브랜치 자체**를 테스트. 모바일 메뉴, 타임라인, 세 상담 버튼 색, 풋터 링크 충돌, 릴스 캡션 및 레일, 문의 페이지로 이동 확인. 실제 Formspree 제출 없음.
- 실제 iPhone용 *일회성* BrowserStack 유료 워크플로는 성공 후 삭제. 테스트 스크립트만 보존.

## 5. 운영 원칙

운영 사이트의 실제 DNS 원천은 카페24가 관리하는 GitHub Pages입니다. Vercel이 별도 Production/Preview를 READY로 표시해도 공식 도메인의 새 코드 반영을 증명하지는 않습니다. 별도 DNS 운영 문서:
[`LUEN_PRODUCTION_ORIGIN_DNS_20261029.md`](LUEN_PRODUCTION_ORIGIN_DNS_20261029.md).

본 문서는 QA/통합 방식만 정의합니다. **실제 운영 배포 및 DNS 이전 승인을 대신하지 않습니다.**
