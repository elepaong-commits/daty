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
   - 코드 하나에 5번 틀리면 그 코드는 못 쓴다. 로그인과 같은 제한(15분에 실패 10회, IP별·이메일별)도 걸린다

- 저장: `password_reset_codes` 테이블에 코드 원문 대신 SHA-256만 둔다(`codeHash`). 코드가 무작위라 느린 해시가 필요 없다
- 알려진 한계: 짝꿍은 상대 계정의 비밀번호를 바꿀 수 있다. 두 사람이 데이터를 전부 공유하는 앱이라 받아들였다. 다만 코드를 받은 사람이 짝꿍 본인인지는 확인하지 않으니 코드를 다른 사람에게 보내지 않도록 화면에서 안내한다

### 세션 무효화
- `users.password_changed_at`보다 먼저 발급된 세션(JWT `iat`)은 `requireAuth`가 401로 막는다. `requireAuth`는 매 요청 사용자를 조회한다(`requireCouple`이 쓰는 `coupleId`도 같은 조회에서 얻는다)
- `iat`는 초 단위라서 비교할 때 변경 시각도 초 단위로 내린다. 그래서 변경과 같은 초에 발급된 새 세션은 유효하다

## 이메일 링크로 재설정

짝꿍이 도와줄 수 없을 때(둘 다 잊었거나 짝꿍이 아직 없을 때) 쓴다. 설정 방법은 `docs/operations.md`.

- `POST /api/auth/forgot-password` (`{ email, lang }`) → **항상 `204`**(가입 여부를 드러내지 않는다). 사용자가 있으면 `randomBytes(32)` 토큰을 만들어 `${APP_URL}/reset-password?token=...` 링크를 `lang`(ko/ja) 문구로 보낸다
  - IP당 15분에 5회(성공·실패 모두 센다), 같은 사용자에게는 2분에 한 통. 이메일을 찾기 전에 `204`로 답하고(응답 시간으로 가입 여부가 드러나지 않게), 링크 만들기·발송은 그 뒤에 하나씩 차례로 한다. 실패는 로그만 남긴다
  - Resend 환경 변수(`RESEND_API_KEY`, `MAIL_FROM`, `APP_URL`)가 비어 있으면 `503 MAIL_DISABLED`
- 재설정은 같은 `POST /api/auth/reset-password`에 `{ token, newPassword }`를 보낸다. 30분 유효, 한 번만
- 저장: `password_reset_codes.via_email = true`인 행에 토큰의 SHA-256. 짝꿍 코드(`via_email = false`)와 서로 덮어쓰지 않지만, 재설정에 성공하면 그 사용자의 코드와 링크가 모두 지워진다
- 화면: 로그인 → "비밀번호를 잊었어요"에서 "짝꿍에게 코드 받기" / "이메일로 링크 받기"를 고른다. 링크는 `ResetLinkPage`(`/reset-password`)가 받는다
- 메일은 SDK 없이 `fetch`로 Resend HTTP API를 부른다(`src/lib/mail.ts`). 테스트에서는 보내지 않고 `outbox`에 쌓는다
