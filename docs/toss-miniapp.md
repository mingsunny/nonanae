# 토스 미니앱(앱인토스) 버전

브랜치 `feat/toss-miniapp`. 웹(Vercel) 버전은 그대로 두고, 같은 코드에서 **토스용 빌드**를 따로 만든다.

| | 웹 (`npm run build`) | 토스 미니앱 (`npm run build:toss`) |
|---|---|---|
| 로그인 | 이메일 가입·로그인 | **토스 로그인만** |
| 로그인 없이 참여(게스트) | 있음 | **없음** — 초대 링크로 오면 토스 로그인 → 그 초대 화면으로 돌아감 |
| 비밀번호 재설정·변경 | 있음 | 없음 (주소로 들어오면 인트로/그룹 목록으로) |
| 봇 확인(Turnstile) | 있음 | 없음 |
| 의견 보내기(구글폼) | 있음 | 없음 (외부 링크 금지. 문의·신고는 토스 더보기 메뉴) |
| 초대 링크 | `https://nonanae.vercel.app/join?code=…` 복사 | 토스 공유 링크(`intoss://nonanae/join?code=…`) + 토스 공유 시트 |
| 핀치 줌 | 됨 | 막음 |

토스 빌드인지는 `src/lib/platform.ts`의 `isTossBuild()` (`.env.toss`의 `VITE_TARGET=toss`)로 가른다.

## 1. 앱인토스 콘솔 (사용자)

1. [앱인토스 콘솔](https://apps-in-toss.toss.im)에서 워크스페이스 → 미니앱 등록. **앱 이름(appName)** 을 정한다.
   - `nonanae`가 아니면 `app/apps-in-toss.config.ts`의 `appName`과 `app/.env.toss`의 `VITE_TOSS_APP_NAME`을 같은 값으로 바꾼다.
2. **개발 → mTLS 인증서 → 발급받기**. zip 안의 `*_public.crt`, `*_private.key`를 Supabase 담당자에게 안전하게 전달 (저장소에 올리지 않기).
3. **토스 로그인** 설정
   - 동의 항목: 최소로(이름 정도). 노나내는 토스에서 받은 개인정보를 저장하지 않고 userKey만 쓴다.
   - 약관: 이용약관 `https://nonanae.vercel.app/terms`, 개인정보 처리방침 `https://nonanae.vercel.app/privacy`
   - 연결 끊기 콜백: URL `https://<프로젝트>.supabase.co/functions/v1/toss-unlink`, 메서드 POST, Basic Auth 값(예: `nonanae:<긴 임의 문자열>`) — 같은 값을 Supabase 비밀값 `TOSS_UNLINK_BASIC_AUTH`에도 넣는다.
4. 출시 전에 **채널톡으로 카테고리 문의**: "더치페이 정산 계산·계좌 안내 앱"이 '금융/송금 관련 서비스' 등록 제한에 걸리는지.

## 2. Supabase (Supabase 담당자)

순서대로:

1. SQL Editor에서 `supabase/migrations/20261116000000_toss_login.sql` 실행
   (`20261027000000_delete_audit_log_on_withdraw.sql`이 먼저 적용돼 있어야 함)
2. Edge Functions → Secrets
   - `TOSS_MTLS_CERT` : `*_public.crt` 내용 전체
   - `TOSS_MTLS_KEY` : `*_private.key` 내용 전체
   - `TOSS_APP_NAME` : 콘솔의 앱 이름 (예: `nonanae`)
   - `TOSS_UNLINK_BASIC_AUTH` : 콘솔 연결 끊기 콜백에 넣은 Basic Auth 값
3. 함수 배포 (둘 다 JWT 확인을 끈다 — 로그인 전/토스 서버가 부르기 때문)
   ```sh
   supabase functions deploy toss-login --no-verify-jwt
   supabase functions deploy toss-unlink --no-verify-jwt
   ```

동작:
- `toss-login`: 인가 코드 → (mTLS) 토스 AccessToken → userKey → `toss_accounts`에서 계정 찾기/만들기 → 한 번 쓰는 로그인 토큰. 앱은 `verifyOtp`로 세션을 연다. 처음 로그인한 사람은 기존 "이름·계좌 등록" 화면을 거친다.
- `toss-unlink`: 토스에서 연결 끊기·약관 철회·토스 탈퇴 → `delete_account_by_id`로 노나내 탈퇴 처리(그룹장은 넘기고 계정 삭제).

## 3. 빌드·테스트·업로드

```sh
cd app
npm run dev:toss        # 브라우저에서 토스 모드로 보기 (토스 SDK 호출은 토스 앱/샌드박스에서만 동작)
npm run build:toss      # dist → app/nonanae.ait
```
콘솔 → 출시하기에서 `nonanae.ait` 업로드 → QR로 토스 앱에서 테스트 → 검수 요청.
(`npx ait token add` 후 `npm run deploy:toss`로 올릴 수도 있다)

## 4. 아직 확인 못 한 것 (실제 연결 전 위험)

- **Edge Function의 mTLS**: `Deno.createHttpClient({ cert, key })`가 Supabase Edge Runtime에서 동작하는지 확인 못 함. 안 되면 토스 API 호출만 다른 서버(Vercel 함수 등)로 옮겨야 한다. 인증서를 받으면 가장 먼저 시험할 것.
- **내부용 이메일**: 토스 사용자 계정에 `toss-<userKey>@toss.nonanae.invalid`를 쓴다. Supabase가 이 도메인을 거절하면 다른 형식으로 바꿔야 한다.
- **CAPTCHA**: Supabase Auth에 CAPTCHA가 켜져 있으면 `verifyOtp`도 막히는지 확인 필요(토스 빌드는 봇 확인을 안 함).
- Edge Function 코드는 로컬에 Deno가 없어 타입 검사를 못 했다. 앱 쪽은 빌드·테스트 통과.
- 안드로이드 뒤로가기, `intoss://nonanae/join?code=…` 링크가 `/join` 화면으로 열리는지 → QR 테스트에서 확인.

## 5. 남은 일

- 개인정보 처리방침: 토스 로그인(수집 항목: 토스 사용자 식별키), 국외 이전(Supabase Inc.) 문구 갱신. 국외 이전 동의문을 토스 로그인 약관에 등록.
- 앱 안에서 회원 탈퇴할 때 토스 연결도 끊기(`remove-by-user-key`) — 지금은 노나내 계정만 지운다(다시 들어오면 새 계정).
- 계좌번호 DB 암호화가 필요한지 앱인토스에 문의 (체크리스트: 민감 정보 암호화).
