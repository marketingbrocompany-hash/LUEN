# LUEN 브랜치·PR·릴리스 감사지 — 2026-10-18

> **스냅샷**: GitHub/Vercel API와 GitHub Actions 검사 결과 기준. 추후 자동 갱신되지 않는다.
> 이 문서는 인벤토리이며 PR의 병합·종료·삭제를 실행하지 않는다.

## 확인된 상태
- 운영 GitHub 브랜치 `main`: `f2d951d41050c54e358e6a1106f0f30c82c16952`
- 개발 GitHub 브랜치 `luen-preview`: `0ac2c8b5acdfb00295ca651292197949b51d3840`
- `main...luen-preview`: **116커밋 ahead, 0 behind**, 변경 파일 39개 (GitHub compare 결과). 운영과 개발 격차가 크므로 일괄 merge 금지.
- Vercel Production: `main` 기반 READY (배포 파일이 올바른지 실화면 독립 검사는 이 조사에서 미실시).
- 개발 Preview: Vercel READY + Cloudflare `https://luen-preview.pages.dev` 배포 성공.
- 2026-10-18 GitHub Actions: Cloudflare Preview `39099830862` **success**; static QA `39099830720` **success**; Lighthouse `39099830718` **success**. 운영 반영 의미는 아님.

## 열려 있는 PR 총 15개 (#138 ~ #152)
- **#140~#152**: 13개가 차례로 연결된 역사적 stacked PR. 각 PR head 커밋은 `luen-preview`의 **조상** (대표 비교: #140 기준 ahead 103/behind 0, #152 기준 ahead 43/behind 0). 즉 코드가 개발 이력에 포함되어 있으나 **각 PR 자체는 여전히 OPEN이고 운영 `main`으로 병합되지 않았다.** 이 PR들을 무조건 재병합하면 안 된다.
- **#138 (YouTube long-form)**: `feat/youtube-longform-service-20261017` → `main`, 미병합. `luen-preview`와 diverged (preview ahead 116, PR head 쪽 2커밋). 개발 사이트의 YouTube 서비스 페이지 제목은 여전히 “롱폼 · 숏폼”을 포함하여 #138 변경과 다르다. 별도 이식/통합 검토 필요.
- **#139 (Instagram Reels tiers)**: `feat/instagram-reels-tiers-20261017` → `main`, 미병합. `luen-preview`와 diverged (preview ahead 116, PR head 쪽 4커밋). 개발 브랜치에 `services/instagram-influencer-marketing/index.html`이 **없음(404)**. 홈 티어·서비스 페이지·sitemap·CSS를 다른 작업과 충돌 없게 별도 통합해야 한다.
- **#153**: 폰트 로딩 실험을 `luen-preview`에만 squash 병합 완료. `main` 미반영. 사전 QA 승인 절차가 충분하지 않았으므로 운영 릴리스 후보로 자동 승격하지 않는다.

## 최근 성능 실험 — 운영 반영 보류
2026-10-18 Cloudflare 개발 사이트 Lighthouse 반복측정 비교:
| 지표(중앙값) | 변경 전 | 폰트 로딩 실험 후 |
| --- | ---: | ---: |
| 모바일 Performance | 59 | 65 |
| 모바일 LCP | 약 8,976 ms | 약 3,851 ms |
| 모바일 FCP | 약 6,968 ms | 약 1,607 ms |
| 모바일 TBT | **0 ms** | **약 2,827 ms** |
| 모바일 CLS | 0 | 약 0.00002 |
| PC Performance | 87 | 88 |

첫 화면 표시는 좋아졌으나 TBT가 크게 악화된 측정값이 존재한다. 기기·폰트 렌더링 확인과 동등 조건 재측정이 필요하며 **'최종 최적화 성공'으로 판단하지 않는다**. 프리뷰 코드를 강제 롤백하지 않는다.

## 안전한 다음 작업 순서
1. #138과 #139의 최종 요구사항/페이지 구성, 현재 Preview 스타일 충돌 조사; 별도 소규모 PR로 이식하고 전체 QA.
2. #140~#152의 PR 의존성·실제 이력 포함 상태를 메모로 정리하되, 보존·정리 정책 확정 전까지 일괄 close/rebase/force-push 금지.
3. 폰트 실험의 모바일 TBT 이상을 별도 브랜치에서 재측정하고, 결과가 나쁠 경우 **일반 PR로 역변경**하는 방안을 검토.
4. 서비스/메인 실제 화면, iOS Safari 및 Android Chrome 실기기, 리포트용 대표 콘텐츠·숏폼 루프 확인.
5. 운영 배포는 별도 릴리스 PR과 사용자 승인 이후 진행.

관련 링크:
- GitHub PR 목록: https://github.com/marketingbrocompany-hash/LUEN/pulls
- 개발 QA: https://github.com/marketingbrocompany-hash/LUEN/actions/runs/39099830862
- 개발 성능: https://github.com/marketingbrocompany-hash/LUEN/actions/runs/39099830718
- 개발 홈페이지: https://luen-preview.pages.dev
