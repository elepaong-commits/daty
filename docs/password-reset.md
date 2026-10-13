# 비밀번호 재설정

## 지금 있는 것

### 로그인 상태에서 변경
- `POST /api/auth/password` (`{ currentPassword, newPassword }`) → `204`
- 현재 비밀번호가 틀리면 `400 WRONG_PASSWORD`. 401을 쓰지 않는 이유는 프론트가 401을 받으면 로그아웃 처리하기 때문이다
- 바꾼 기기에는 새 세션 쿠키를 주고, 다른 기기의 세션은 끊는다(아래 "세션 무효화")
- 화면: 내 정보 시트 → 비밀번호 변경 (`frontend/src/features/auth/PasswordSettings.tsx`)

### 짝꿍이 발급하는 재설정 코드
이메일 발송 없이 쓸 수 있는 방식이다. 커플 앱이라 비밀번호를 잊어도 짝꿍은 로그인돼 있는 경우가 많다.

1. 짝꿍이 내 정보 시트에서 "재설정 코드 만들기"를 누른다 → `POST /api/couple/reset-code` → `{ code, expiresAt, user: { nickname } }`
   - 8자리 코드(헷갈리는 0/O, 1/I/L 제외). 10분 유효, 한 번만 쓸 수 있다
   - 새로 만들면 그 사람의 이전 코드는 지워진다. 짝꿍이 없으면 `409 NO_PARTNER`
2. 잊어버린 사람이 로그인 화면 → "비밀번호를 잊었어요"에서 이메일, 코드, 새 비밀번호를 넣는다 → `POST /api/auth/reset-password` → 바로 로그인되고 `Me`를 돌려준다
   - 코드가 틀리거나 만료됐거나, 이메일이 없거나 다른 사람 것이면 모두 같은 `400 INVALID_RESET_CODE`를 준다(어떤 이메일이 가입돼 있는지 드러나지 않게)
   - 코드 하나에 5번 틀리면 그 코드는 못 쓴다. 로그인과 같은 IP 제한(15분에 실패 10회)도 걸린다

- 저장: `password_reset_codes` 테이블에 코드 원문 대신 SHA-256만 둔다(`codeHash`). 코드가 무작위라 느린 해시가 필요 없다
- 알려진 한계: 짝꿍은 상대 계정의 비밀번호를 바꿀 수 있다. 두 사람이 데이터를 전부 공유하는 앱이라 받아들였다. 다만 코드를 받은 사람이 짝꿍 본인인지는 확인하지 않으니 코드를 다른 사람에게 보내지 않도록 화면에서 안내한다

### 세션 무효화
- `users.password_changed_at`보다 먼저 발급된 세션(JWT `iat`)은 `requireAuth`가 401로 막는다. `requireAuth`는 매 요청 사용자를 조회한다(`requireCouple`이 쓰는 `coupleId`도 같은 조회에서 얻는다)
- `iat`는 초 단위라서 비교할 때 변경 시각도 초 단위로 내린다. 그래서 변경과 같은 초에 발급된 새 세션은 유효하다

## 나중에: 이메일 링크로 재설정 (B)

도메인이 생기고 운영 배포가 끝난 뒤에 추가한다. 위의 두 방식은 그대로 두고 하나를 더하는 것이다. 특히 둘 다 비밀번호를 잊었거나 짝꿍이 아직 없을 때 필요하다.

### 준비
- 메일 발송 서비스: [Resend](https://resend.com) 무료 플랜(하루 100통)이면 충분하다. 발신 도메인 DNS에 SPF/DKIM 레코드를 추가해야 스팸함으로 가지 않는다. Cloudflare Email Routing은 받기 전용이라 발송에는 못 쓴다
- 서버 메모리를 아끼려면 SDK 대신 `fetch`로 Resend HTTP API(`POST https://api.resend.com/emails`)를 부른다
- 환경 변수(`.env.example`에도 추가): `RESEND_API_KEY`, `MAIL_FROM`(예: `daty <no-reply@도메인>`), `APP_URL`(메일 속 링크의 프론트 주소). R2처럼 비어 있으면 기능을 끄고 `503 MAIL_DISABLED`

### 데이터
- `password_reset_codes`를 그대로 쓴다. `issuedById`가 `null`이면 메일로 발급한 코드다. 구분이 필요하면 `channel` 컬럼(`PARTNER` / `EMAIL`)을 추가한다
- 메일 링크용 토큰은 사람이 입력하지 않으니 길게 만든다: `randomBytes(32).toString("base64url")`. 저장은 똑같이 SHA-256 해시. 유효 시간은 30분 정도로 한다

### API
- `POST /api/auth/forgot-password` (`{ email }`) → **항상 `204`**(가입 여부를 드러내지 않는다). 사용자가 있으면 토큰을 만들고 `${APP_URL}/reset-password?token=...` 링크를 보낸다
  - `credentialsLimiter`를 걸고, 같은 사용자에게는 몇 분에 한 통만 보낸다(최근 코드의 `createdAt`으로 확인)
  - 메일 발송 실패는 로그만 남기고 응답은 그대로 `204`
- 재설정은 지금의 `POST /api/auth/reset-password`를 넓힌다: `{ email, code }` 또는 `{ token }` 중 하나와 `newPassword`. 검증과 세션 무효화, 로그인 처리는 지금 코드를 그대로 쓴다

### 프론트
- 로그인 화면의 "비밀번호를 잊었어요"에서 두 갈래로 나눈다: "짝꿍에게 코드 받기"(지금 폼) / "이메일로 링크 받기"(이메일 입력 → "메일을 보냈어요" 안내)
- `/reset-password?token=` 라우트: 새 비밀번호만 받는다. 로그인하지 않아도 열 수 있어야 하므로 `App.tsx`의 로그인 게이트보다 앞에 둔다
- 메일 본문은 받는 사람 언어(ko/ja)로 보낸다. 사용자 언어를 서버가 모르므로 요청에 `lang`을 함께 보내거나 `users`에 언어 컬럼을 추가한다

### 테스트
- `backend/test/password.test.ts`에 추가: 없는 이메일도 `204`, 토큰 재사용·만료 거부, 발송 간격 제한
- 테스트에서는 실제 메일을 보내지 않도록 발송 함수를 `env.NODE_ENV === "test"`일 때 보낸 메일을 메모리에 쌓기만 하게 하고, 테스트가 거기서 링크를 꺼낸다
