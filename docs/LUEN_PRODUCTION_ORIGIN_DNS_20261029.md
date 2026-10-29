# LUEN 공식 도메인 — 운영 원천 및 안전 전환 계획

> 기준: 2026-10-29. **이 문서는 읽기 전용 조사와 운영 절차만 기록합니다.**
> 현재 DNS, GitHub Pages 설정, Vercel 도메인 별칭, Formspree, 고객 포털을 변경하지 않았습니다.

## 1. 확인된 운영 현황

| 시스템 | 역할 / 확인 결과 |
|---|---|
| 공식 사이트 `https://luenkorea.com/` | **현재 GitHub Pages DNS 경로로 서비스 중**. 최신 SERVICES(플랫폼 3개/상담 CTA 1개) 및 Signature Campaigns(사례 4개) 반영 확인 |
| `https://www.luenkorea.com/` | 공식 apex로 리다이렉트되는 것으로 외부 조회 확인 |
| GitHub | `marketingbrocompany-hash/LUEN`, `main` 최신 코드를 바탕으로 운영 사이트 콘텐츠 반영. **실제 GitHub Pages 발행 소스(branch/folder)는 저장소 Settings → Pages에서 재확인 필요** |
| GitHub 루트 `CNAME` | `luenkorea.com` |
| Vercel `luen-homepage` | GitHub `main`에 연동되어 별도 Production 배포 READY. **현재 공식 도메인의 DNS 대상은 아님** |
| Cloudflare Pages | `luen-preview.pages.dev` — 별도 개발/QA 사이트. 공식 도메인을 연결하지 않음 |
| Formspree | 2026-10-29 운영 문의 1회 실제 제출 → 관리자 Gmail 도착 확인 (실제 사람 문의와 구분된 QA) |
| 고객 로그인 | 별도 `content-intelligence-hub` 서비스. 도메인 전환 범위에서 **제외** |

**중요:** Vercel 대시보드에서 `luenkorea.com`과 `www.luenkorea.com` 도메인은 프로젝트에 등록돼 있으나 `misconfigured: true`. 현재 DNS가 GitHub Pages를 가리키기 때문에 발생하는 **호스팅 원천 불일치**입니다. 사이트 자체 장애와 혼동하지 마세요. Vercel `READY`만으로 공식 사이트가 Vercel에서 제공된다고 판정하지 않습니다.

## 2. 외부 DNS 스냅샷 (2026-10-29)

Google Public DNS 조회와 Vercel 도메인 설정 조회를 교차 확인했습니다. 실제 변경 전에 반드시 **카페24 DNS 관리자 화면에서 전체 레코드 백업**이 필요합니다. 공개 조회는 Zone 전체 백업이 아닙니다.

| 레코드 | 확인한 값 |
|---|---|
| 권한 네임서버 | `ns1.cafe24.com`, `ns2.cafe24.com`, `ns1.cafe24.co.kr`, `ns2.cafe24.co.kr` |
| `@` A | `185.199.108.153` (GitHub Pages), TTL 약 1800초 |
| `@` AAAA | 조회된 답변 없음 |
| `www` CNAME | `marketingbrocompany-hash.github.io.`, TTL 약 1800초 |
| `@` TXT | 최소 1개 조회됨. **검증용 내용은 출력·삭제·교체하지 말 것** |
| `@` MX/CAA | 이번 공개 조회에서 답변 없음. **이것만으로 실제 운영 레코드가 없다고 단정 금지** |

GitHub Pages 공식 문서는 apex A 레코드 4개(`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`)를 권고합니다. 현재 공개 조회에서는 1개만 확인됩니다. 이미 사이트는 HTTPS로 정상 서비스되므로 **지금 레코드를 덮어쓰지 않습니다.** 카페24의 실제 레코드 구성을 비교한 다음 나머지 3개 A 레코드 추가 여부를 **별도 변경·검수 절차**로 결정합니다.

공식 문서:
- GitHub Pages HTTPS/DNS: https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
- Vercel 프로젝트별 도메인 설정: https://vercel.com/docs/domains/set-up-custom-domain

## 3. 현재 권장 운영 원칙 — 즉시 전환하지 않음

1. **당분간 GitHub Pages를 공식 트래픽 원천**으로 유지합니다. `main` 병합 이후 공식 도메인의 실제 HTML과 DNS를 별도로 검증합니다.
2. Vercel은 Preview/별도 Production 아티팩트 제공 목적으로 유지합니다. 단, Vercel `READY`를 공식 사이트 배포 성공으로 표기하지 않습니다.
3. `main`은 운영 승인된 PR만 병합합니다. 별도 포털 URL·인증·DNS를 건드리지 않습니다.
4. 추후 호스팅 통합을 원할 경우 **Vercel 이전 여부를 별도로 승인**한 다음 변경 창을 정합니다.
5. DNS는 카페24에서 관리하므로 Vercel 연결 도메인이 등록되어 있다는 이유로 네임서버를 옮기거나 임의의 A/CNAME을 추가하지 않습니다.

## 4. 읽기 전용 릴리스 후 검사

`node scripts/qa-production-origin.mjs`

또는 GitHub Actions → **LUEN official-domain origin check (read-only)** → Run workflow.

확인 항목:
- apex A가 허용된 GitHub Pages IPv4 주소인지
- `www` CNAME이 `marketingbrocompany-hash.github.io`인지
- 네임서버가 카페24인지 (변경 시 경고)
- 운영 `https://luenkorea.com/`에서 사례 4개 / 플랫폼 3개 / 통합 문의 CTA 1개가 노출되는지
- `https://www.luenkorea.com/`이 공식 HTTPS apex로 리다이렉트되는지

**권한:** GitHub Actions `contents:read`만 사용. DNS 업체 API, Vercel 배포, Formspree 제출, 외부 메일 전송을 수행하지 않습니다. 예상되는 DNS 전환이 승인되면 새로운 호스팅 목적지에 맞도록 이 검사도 먼저 수정하고 검증합니다.

## 5. 향후 Vercel로 호스팅 전환을 명시적으로 승인받는 경우에만

1. **사전 확인:** GitHub Settings → Pages 발행 브랜치/폴더, 카페24 DNS Zone **전체**(A/AAAA/CNAME/TXT/MX/CAA/서브도메인), SSL/HTTPS, Vercel 프로젝트 `luen-homepage`의 Production 커밋·도메인 인증서·리다이렉트를 점검합니다. 변경 전 원본 자료를 저장합니다.
2. **기능 검증:** Preview/Production을 별도 주소로 PC + Android + 실제 iPhone에서 점검. 모든 서브페이지, SEO canonical·sitemap, 스크롤 영상, 이미지, 문의 폼·관리자 수신 확인.
3. **전환 방식:** 카페24 네임서버는 유지하고, Vercel이 `luenkorea.com`에 **실제로 표시하는 프로젝트 전용 A 레코드**와 `www`의 **전용 CNAME** 값을 변경 직전에 다시 확인합니다. 위의 예시 값을 추측해서 적용하지 마세요.
4. **DNS 변경:** 변경 창/담당자 확보 및 TTL 고려 → 기존 apex A와 www CNAME의 정확한 값을 백업한 뒤 **그 두 호스트에 필요한 레코드만** 변경합니다. 메일/TXT/인증/타 서비스 레코드를 유지하고 GitHub Pages와 Vercel 주소가 무분별하게 섞이지 않도록 합니다. Vercel에 현재 도메인을 다시 추가할 필요는 없습니다.
5. **검증:** 여러 공용 리졸버로 DNS, Vercel `configured` 상태, TLS, `www` 리다이렉트, 공식 HTML, 이미지·문의·포털 외부 링크를 확인합니다. 로컬/지역 DNS 캐시 차이를 감안합니다.
6. **복구:** 문제가 발생하면 카페24에서 `@` A를 원래 값 `185.199.108.153`, `www` CNAME을 `marketingbrocompany-hash.github.io.`로 되돌리고(전환 직전 백업과 대조), DNS 전파 및 공식 사이트를 재검증합니다. **Vercel 롤백은 DNS 롤백과 다르므로 둘을 혼동하지 않습니다.**

## 6. 롤백·원천 기준

- 새 GitHub `main` 기준 (검사 코드 포함): `303e9b8dd62bc3581c9e0928b67a3023e2e61047`
- 실제 디자인 운영 릴리스: `af5fbd0cdc13696f63cd1381487d3d2b39d6595e`
- 직전 운영 코드: `95a23fd0564c8f4be9500092e39dae67768cfa6f`
- 직전 Vercel Production 배포: `dpl_AhYrXnN6nsK63CFUVtn7ZDsKKukD`

관련 이슈: https://github.com/marketingbrocompany-hash/LUEN/issues/252
