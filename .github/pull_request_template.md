## 변경 목적 및 기준
- 기준 브랜치 / SHA:
- 변경 파일:
- 사용자에게 보이는 영향:

## 영향 분석 및 복구
- [ ] HTML/CSS/JS 의존성과 기존 기능 영향을 확인함
- [ ] 불필요한 파일 전체 교체/삭제/덮어쓰기를 하지 않음
- [ ] 실패 시 원복 가능한 범위를 확인함

## 검증 내역
- [ ] `node scripts/check-site.mjs` / CI 정적 QA 통과
- [ ] PR Preview 또는 격리된 브라우저에서 기능 테스트 완료
- [ ] 모바일 320/360/390/430px, 태블릿 768/820px, PC 1280/1440px 검수
- [ ] 모션 및 reduced-motion, CTA, 이미지, 메뉴, 링크, 문의 모의 응답 확인
- [ ] 변경 전후 Lighthouse(LCP/FCP/TBT/CLS) 비교 또는 성능 무영향 사유 기재
- [ ] 실제 기기 미검증 항목 및 회귀 위험 기록

## 반영 상태
- [ ] `luen-preview` 반영 전 QA 확인
- [ ] Cloudflare Preview 통합 QA 결과 확인 (통합 후)
- [ ] 운영 `main` 및 `luenkorea.com` 반영 여부 별도 기재 (승인 필수)

### 실제 검사 링크 / 실패·보류사항
- CI/Preview:
- 실패/미검증:
- 다음 작업:

상세 기준: `docs/LUEN_DEVELOPMENT_WORKFLOW.md`.
