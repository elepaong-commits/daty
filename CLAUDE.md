# daty

데이트 기록 앱. 핵심 뷰는 지도/저널, 캘린더, 앨범 세 가지.

## 저장소 구조 (모노레포)

- `frontend/` — React 19 + Vite + TypeScript + Tailwind CSS v4 (`@tailwindcss/vite` 플러그인, PostCSS 설정 없음)
  - React Router(탭 3개: `/`, `/calendar`, `/albums` + 하위 화면 `/places/:id`, `/places/:id/edit`, `/albums/:id`, `/recap`(연말 결산, 앨범 탭 아래). 로그인 없이 열리는 `/reset-password?token=`(메일 링크)은 로그인 게이트보다 앞에 있다. 하위 화면에서도 해당 탭이 활성 표시된다), TanStack Query(`src/lib/queries.ts`), 지도는 `@vis.gl/react-google-maps`
  - 1024px(`lg`) 미만은 폰 폭 한 열 + 하단 탭, 이상은 왼쪽 `Sidebar` + 넓은 화면(`useIsDesktop`, 나머지는 `lg:` 클래스). 데스크톱에서 `/places/:id`는 지도 탭 왼쪽 열에 열리고(지도는 그대로), 바텀시트는 가운데 모달이 된다
  - Google Maps JS는 `MapsProvider`(`src/lib/maps.tsx`)가 앱 전체에 한 번 로드한다. 지도와 장소 검색(Places API New, 자동완성 세션 토큰 사용)이 함께 쓴다. 장소 상세 위쪽 사진도 `googlePlaceId`로 Google 장소 사진을 받아 쓰고(`PlaceHero`, 작성자 표시 필수), 없으면 앨범 표지 → 카테고리 타일
  - 디자인 토큰(색상·글꼴·그림자)은 `src/index.css`의 `@theme`에 있다. 새 색을 하드코딩하지 말고 토큰을 쓴다 (`bg-brand-strong`, `text-muted`, `font-display` 등). 브랜드색 `brand`(#00A896)는 흰 글자와 대비가 3:1이 안 되므로 점·막대·테두리 같은 장식에만 쓰고, 글자색과 글자·아이콘이 올라가는 배경은 `brand-strong`(hover는 `brand-deep`)을 쓴다
  - 디자인이 두 벌이다: 기본(classic)과 도트(retro). 기기마다 처음 화면(`ThemePickerPage`)에서 고르고 사이드바·내 정보에서 바꾼다(localStorage, `<html data-theme>`, `src/lib/theme.ts`). 여러 곳에 쓰는 모양은 두 디자인을 함께 담은 `ui-*` 클래스(`ui-card`, `ui-chip`, `ui-title` 등, `index.css` 아래쪽)를 쓰고, 한 곳만 다른 건 `retro:` 변형으로 쓴다. 코드에서 디자인을 가르는 건 아이콘·핀·마스코트처럼 그림이 다른 곳뿐이다(`useIsRetro`, `PixelSprite`). 도트 디자인에서는 기본 글꼴이 Galmuri로 바뀌고 모서리·그림자가 전역으로 각지므로, 메모·노트처럼 긴 글에는 `ui-prose`를 붙인다. 픽셀 테두리만 필요하면 도트 전용 `ui-box`/`ui-btn`/`ui-outline` 등을 기존 클래스 옆에 붙인다. 애니메이션은 `useMotionPreset()`(도트는 계단식 easing, 화면 와이프, 대화창처럼 펼쳐지는 시트)과 `RISE_IN`을 쓴다
  - 화면은 `src/features/<화면>/`, 공용 UI는 `src/components/`, API·타입·날짜 유틸은 `src/lib/`
  - 한국어/일본어 지원. 화면 문구는 하드코딩하지 않고 `src/lib/messages.ts`의 `ko`와 `ja` 양쪽에 넣은 뒤 `useT()`로 쓴다(`ja`는 `Messages` 타입이라 키가 빠지면 빌드가 깨진다). 언어는 헤더 오른쪽 위 토글로 바꾸고 기기(localStorage)에 기억한다. Google 지도 타일 언어는 페이지를 처음 열 때 언어로 고정된다
  - 서비스 워커(`public/sw.js`, 빌드 도구 없이 손으로 쓴 파일)가 앱 껍데기(페이지·해시된 `/assets/*`·아이콘)를 캐시하고 웹 푸시를 띄운다. `/api`와 사진은 캐시하지 않는다. 푸시 구독은 `src/lib/push.ts`, 설정 화면은 내 정보 시트(`NotificationSettings`)
  - 모달(시트·확인창·사진 뷰어)은 `useDialogFocus`(`src/lib/useDialogFocus.ts`)로 열 때 포커스를 안으로 옮기고, Tab을 가두고, Escape를 받고, 닫으면 연 버튼으로 포커스를 돌린다. 겹쳐 열리면 맨 위 것만 반응한다. 키보드 포커스 표시는 `index.css`의 전역 `:focus-visible`(자체 포커스 테두리가 있는 입력창만 `outline-none`)
  - 확인창은 `window.confirm` 대신 `useConfirm()`(`src/lib/confirm.ts`, `ConfirmProvider`가 앱 전체에 하나 띄운다)을 쓴다: `if (await confirm({ title, message?, confirmLabel, danger? }))`. 삭제는 `danger`(빨간 버튼)
  - 사진·장소 메모의 반응·댓글은 `FeedbackPanel`(`useFeedback`) 하나로 그린다. 파일 저장은 `src/lib/download.ts`(숨은 iframe으로 R2의 attachment 링크를 연다)
  - 개발 중에는 Vite가 `/api`를 `127.0.0.1:4000`(백엔드)으로 프록시한다. 운영 빌드는 `VITE_API_URL`
  - 디자인 원본: Figma `7Qc5QDKQEeFWbnAeSbhEA7` (지도 `1:797`, 캘린더 `1:538`, 앨범 `1:329`, 일정 등록 `1:2`, 장소 상세 `17:1531`, 장소 수정 `17:1598`, 일정 수정 `17:1684`, 앨범 상세 `17:1807`)
- `backend/` — Express 5 + Prisma 7 (PostgreSQL) + TypeScript (ESM, `NodeNext`). 개발 실행은 `tsx`, 환경 변수 검증과 요청 검증은 `zod`
  - `src/server.ts` 진입점, `src/app.ts` 앱 구성, `src/routes/` 라우터, `src/middlewares/` 공통 미들웨어, `src/config/env.ts` 환경 변수
  - Prisma Client는 `prisma-client` 생성기로 `src/generated/prisma`에 생성되며 커밋하지 않는다 (`npm install` 시 자동 생성). `@prisma/adapter-pg` 드라이버 어댑터 사용
  - ESM이므로 상대 경로 import에는 `.js` 확장자를 붙인다
- 프론트와 백엔드가 같이 쓰는 API 타입이 생기면 `shared/`로 분리를 검토

각 패키지는 자기 디렉토리에서 독립적으로 `npm install` / `npm run ...` 한다. 루트에는 package.json이 없다.

## 인프라

- **Frontend 배포:** Vercel(또는 Netlify). 프로젝트 Root Directory는 `frontend`.
  - 로그인 쿠키가 SameSite=Lax라서 **API는 프론트와 같은 사이트에서 불러야 한다.** 배포 시 Vercel rewrite로 `/api/*`를 백엔드로 넘기거나 같은 상위 도메인(예: `app.example.com` + `api.example.com`)을 쓴다. 서로 다른 도메인에서 직접 호출하면 쿠키가 전송되지 않는다
- **Backend 배포:** Google Cloud VM (x86_64, **메모리 1GB** 기준, Ubuntu 22.04). 지금은 무료 체험 크레딧으로 돌고, 끝나기 전에 Always Free `e2-micro`(미국 리전)로 옮긴다. GitHub Actions가 빌드한 `dist/`를 서버로 보내고 서버는 `git pull`·마이그레이션·재시작만 한다(`deploy-backend.yml`, 저장소 변수 `DEPLOY_HOST`가 있어야 켜진다). 백업·배포·이전 절차는 `docs/operations.md`. Node, PostgreSQL, Nginx가 한 대에서 같이 돌기 때문에 메모리를 아껴 쓴다 (서버에서 TypeScript 빌드나 무거운 작업은 피하고, 프로세스는 하나만 띄운다).
- **로컬 개발 DB:** Mac의 OrbStack(Docker)에서 `backend/compose.yaml`로 구동 (`npm run db:up`). `localhost:5433`, 계정 `daty`/`daty`, DB `daty_dev`. 개발과 테스트는 이 DB로 하고, 운영 DB에는 붙지 않는다.
- **DB:** PostgreSQL 15, 같은 Oracle VM의 Docker 컨테이너(`date_app_postgres`, compose 파일은 서버의 `~/app-db/`)로 구동. 매일 `backend/scripts/backup.mjs`(cron)가 덤프를 R2 `backups/`에 올린다. 포트는 `127.0.0.1:5432`에만 열려 있어 로컬에서는 SSH 터널(`ssh -L 5432:localhost:5432 oracle-server`)로 접속한다.
- **이미지 저장:** Cloudflare R2.

## 데이터 모델 (`backend/prisma/schema.prisma`)

- 커플 단위 앱: `Couple`에 `User` 두 명이 `coupleCode`로 묶이고, 모든 데이터는 `coupleId`로 소유된다.
- `Place`: 지도 핀. Google Maps 기반(`googlePlaceId`). 상태는 `WISH`(가고 싶은 곳) / `VISITED`.
- `Comment` / `Reaction`: 사진·동영상(`photoId`)이나 장소 메모(`noteId`)에 단 댓글과 이모지. 둘 중 하나만 채운다(DB CHECK). 이모지는 한 사람이 한 대상에 하나
- `PushSubscription`: 알림을 켠 기기의 웹 푸시 구독(언어·시간대 포함)
- `PlaceNote`: 장소 메모(여러 개, 작성자 포함). 본문에 `{{EAT}}` `{{SEE}}` `{{DO}}` 태그 토큰이 들어가고, 프론트(`src/lib/memo.ts`)가 입력창에서는 보는 사람 언어의 문구로 풀고 저장할 때 다시 토큰으로 바꾼다. `DateRecord.memo`도 같은 토큰을 쓴다.
- `DateRecord`: 캘린더 항목. `PLAN`(일정) / `RECORD`(기록). 장소 하나와 연결되고, 앨범에 묶일 수 있다.
- `Album` / `Photo`: 앨범 탭. 하루 데이트의 여러 기록과 사진·동영상을 하나의 앨범으로 묶는다. `Photo.mediaType`이 `PHOTO`/`VIDEO`이고, 앨범 상세에서 모두/사진/동영상 탭으로 거른다.

스키마를 바꿀 때는 로컬 개발 DB에서 `npm run db:migrate`(`prisma migrate dev`)로 마이그레이션 파일을 만들어 커밋하고, 운영 DB에는 `npx prisma migrate deploy`만 쓴다. 운영 DB에 `migrate dev`, `db push`, `migrate reset`을 실행하지 않는다.

## API (`backend/src/modules/`)

**인증:** 이메일 + 비밀번호. 로그인하면 `daty_session` 쿠키(httpOnly, SameSite=Lax, 30일, HS256 JWT)가 발급된다. 발급된 지 하루가 지난 세션은 `requireAuth`가 다음 요청에서 30일짜리로 다시 발급한다(30일 동안 쓰지 않아야 로그아웃). 비밀번호는 `node:crypto` scrypt로 해시(`src/lib/password.ts`). 로그인·가입·비밀번호 변경·재설정·계정 삭제·초대 코드 합류(`/api/couple/join`)는 IP당 15분에 10회 실패로 제한. 가입은 `SIGNUP_ENABLED=true`일 때만 열리고(기본은 닫힘, `403 SIGNUP_CLOSED`), 로그인 화면은 `GET /api/auth/signup`(`{ open }`)을 보고 가입 탭을 숨긴다.

- `requireAuth` → `req.userId`, `requireCouple` → `req.coupleId` (`src/middlewares/auth.ts`). 커플 데이터 라우터(places, records, albums)는 둘 다 거친다. `requireAuth`는 매 요청 사용자를 조회해서 `passwordChangedAt`보다 먼저 발급된 세션을 막는다(비밀번호를 바꾸면 다른 기기는 로그아웃)
- 커플 데이터 쿼리는 반드시 `req.coupleId`로 범위를 제한한다 (`where: { id, coupleId }`)
- 에러 응답은 `{ error, code }`. 프론트는 `code`(`UNAUTHENTICATED`, `COUPLE_REQUIRED`, `INVALID_CREDENTIALS` 등)로 분기한다. 검증 실패는 `INVALID_REQUEST`, 없는 대상은 `NOT_FOUND`, 서버 오류는 `INTERNAL`. 화면에 보이는 문구는 프론트 `errorMessage`(`src/lib/api.ts`)가 `messages.ts`의 `errors[code]`로 바꾸고, 문구가 없는 코드는 상태 코드별 `failures`, 네트워크 끊김(`TypeError`)은 `failures.network`로 보여 준다. 영어 원문은 화면에 내보내지 않는다

- `POST /api/auth/signup|login|logout`, `GET|PATCH /api/auth/me` — 응답은 `{ user, couple | null }`. `PATCH`는 닉네임(`{ nickname }`) 변경
- `POST /api/couple` (기념일 → 6자리 초대 코드 발급), `POST /api/couple/join` (코드로 합류, 최대 2명)
- 비밀번호: `POST /api/auth/password`(로그인 상태에서 변경), `POST /api/couple/reset-code`(짝꿍이 상대의 10분짜리 일회용 코드 발급) → `POST /api/auth/reset-password`(코드로 재설정 후 로그인). 이메일 링크 방식도 있다: `POST /api/auth/forgot-password`(`{ email, lang }`, 항상 `204`) → 메일의 `/reset-password?token=` → 같은 `reset-password`에 `{ token, newPassword }`. Resend 환경 변수가 비어 있으면 `503 MAIL_DISABLED`. 설계는 `docs/password-reset.md`
- 나가기·삭제: `POST /api/couple/leave`(커플에서 나가기), `DELETE /api/couple/partner`(짝꿍 내보내기), `DELETE /api/auth/me`(`{ password }`, 계정 삭제 → 나간 뒤 사용자 행 삭제, 204). 모두 `src/lib/membership.ts`의 `removeFromCouple`을 거친다: 기록은 남은 사람에게 남고, 나간 사람의 반응과 둘 사이의 짝꿍 재설정 코드는 지우고, 쓴 메모·댓글은 남긴다(계정 삭제면 작성자 `null`). 초대 코드는 새로 바뀐다. 마지막 사람이 나가면 커플과 모든 데이터·R2 파일을 지운다
- `GET /api/couple/storage`(R2 사용량. `Photo.sizeBytes`의 합이고, 크기가 없는 예전 사진은 조회할 때 60개씩 R2 HEAD로 채운다), `GET /api/couple/export`(기록 전체 JSON 내려받기)
- `GET /api/push/key`, `POST|DELETE /api/push/subscriptions`, `POST /api/push/test` — 웹 푸시(`requireAuth`만). VAPID 키가 없으면 `503 PUSH_DISABLED`. 아침 알림(기념일·일정·N년 전 오늘)은 API 프로세스 안의 타이머 `src/lib/notifier.ts`가 보낸다(프로세스를 더 띄우지 않는다)
- `GET /api/memories?date=&tz=`(N년 전 오늘의 방문·앨범), `GET /api/recap?year=&tz=`(연말 결산) — 날짜는 보는 사람 시간대(`tz`, IANA 이름)의 달력으로 센다. 동네 이름은 주소에서 읽는다(`src/lib/area.ts`, 한국·일본 주소)
- 반응·댓글: `PUT|DELETE /api/albums/:id/photos/:photoId/reaction`, `POST .../comments`, `DELETE .../comments/:commentId`, 장소 메모는 `/api/places/:id/notes/:noteId/...`로 같다. 응답은 그 대상의 `{ reactions, comments }`. 댓글은 쓴 사람만 지운다
- `GET /api/albums/:id/photos/downloads` — 파일마다 저장용 서명 URL(`response-content-disposition=attachment`, 1시간)
- `GET /api/couple` — 초대 코드, 기념일(`anniversaryDate`), 두 사람 정보. D+N은 클라이언트에서 계산. `PATCH /api/couple`(`{ anniversaryDate }`)로 기념일을 고치고 `{ user, couple }`을 돌려준다
- `GET|POST /api/places`, `GET|PATCH|DELETE /api/places/:id` — `?status=&category=` 필터. 응답에 방문 횟수, 평균 평점, 마지막 방문일 포함
  - 목록 응답의 `latestNote`는 가장 최근 메모. `POST`는 `note`로 첫 메모를 함께 만들 수 있고, 같은 `googlePlaceId`가 이미 있으면 `409 PLACE_EXISTS`
  - `GET /:id`는 최근 방문(`latestVisit`), 메모(`notes`, 최신순), 방문 기록이 묶인 앨범(사진 3장)을 함께 준다
  - `POST /api/places/:id/notes` (`{ content }`), `DELETE /api/places/:id/notes/:noteId`
  - `PATCH /:id`의 `visit: { scheduledAt, rating }`은 그 장소의 최근 방문 기록을 고치고, 방문 기록이 없으면 새로 만든다 (장소 자체에는 날짜·평점 컬럼이 없다)
- `GET /api/records?from=&to=` (ISO, 오프셋 포함), `POST`, `PATCH|DELETE /api/records/:id` — 생성과 수정 모두 `resolvePlace`로 장소를 찾거나 만든다. 수정 시 장소 이름이 바뀌거나 검색으로 고르면 다른 장소로 옮긴다
  - 생성 시 `placeId`(일정 등록의 "저장한 장소") 또는 `placeName`("새 장소"). 기존 장소는 `googlePlaceId` → 이름 순으로 찾아 재사용하고, 없으면 생성. 다른 장소로 옮기면 제목도 그 장소 이름이 된다
  - **지도 핀은 좌표가 있는 장소에만 생긴다.** 좌표·주소·`googlePlaceId`는 프론트의 Google 장소 검색(`PlaceSearch`)에서 온다. 장소 이름과 주소는 앱 언어와 상관없이 그 나라 말로 저장한다(일본 장소는 일본어, `LOCAL_LANGUAGE`). 이름만 있던 장소도 나중에 검색으로 고르면 좌표가 채워진다
  - `RECORD`가 되면 장소를 `VISITED`로 올린다. `PLAN`은 장소 상태를 내리지 않는다
  - `memo`는 그 데이트에 대한 메모(`DateRecord.memo`), `placeNote`는 장소에 대한 메모로 연결된 장소의 `PlaceNote`를 하나 새로 만든다(생성·수정 모두, 수정에서 장소를 옮기면 새 장소에). 일정 폼에 두 칸이 따로 있다
- `GET|POST /api/albums`, `GET|PATCH|DELETE /api/albums/:id`, `DELETE /api/albums/:id/photos/:photoId` — 앨범은 하루(`albumDate`) 또는 기간(`albumDate`~`albumEndDate`, 여행 등)을 덮는다. DB의 `albumEndDate`는 하루짜리면 `null`이고 응답에서는 항상 마지막 날(하루면 `albumDate`와 같음)을 준다. 하루에는 앨범 하나뿐이라 기간이 겹치면 `409 ALBUM_EXISTS`. 월별 앨범(`monthly`, 한 달 동안 집이나 자주 가는 곳에서 찍은 사진)은 날짜 대신 `albumMonth`(`YYYY-MM`)로 만들고 그 달 1일~말일을 덮지만, 날짜를 차지하지 않아 겹침 검사에서 빠진다(같은 달에 여러 개 가능). 폼에서는 방문 기록·장소 고르기를 숨긴다. `coverPhotoId`가 "베스트 컷"(앨범 표지). 고르지 않으면(`null`) 응답의 `coverPhoto`는 첫 번째 사진. 목록(`GET /api/albums`)은 카드에 쓸 만큼만 준다: `photos` 대신 표지를 앞에 둔 최대 3장(`previewPhotos`, 반응·댓글 없음)과 `photoCount`·`videoCount`. 사진 전체와 반응·댓글은 상세(`GET /:id`)에만 있다(프론트 타입 `AlbumSummary` / `Album`). 사진이나 앨범을 지우면 원본·썸네일 R2 객체도 지운다(실패해도 로그만 남김)
  - `POST /api/albums/:id/photos/uploads` (`{ files: [{ contentType }] }`, 최대 30개. 이미지 jpeg/png/webp, 동영상 mp4/quicktime/webm) → 업로드할 `key`, presigned `uploadUrl`(10분), 보낼 `headers`, 그리고 같은 모양의 `thumbnail`(`{uuid}.thumb.jpg`)
  - `POST /api/albums/:id/photos` (`{ photos: [{ key, thumbnailKey, takenAt, durationSec?, fingerprint? }] }`) — R2에 HEAD로 실제 업로드(사진은 15MB 이하 이미지, 동영상은 R2 단일 PUT 한도인 5GB 이하 동영상, 썸네일 2MB 이하 이미지)를 확인한 뒤 기록. 키 확장자로 `mediaType`을 정한다. 키는 `couples/{coupleId}/albums/{albumId}/{uuid}.{ext}`와 그 썸네일 키만 받는다. 썸네일 업로드만 실패하면 `thumbnailKey: null`로 보내고 원본을 쓴다(동영상은 응답의 `thumbnailUrl`이 `null`). `fingerprint`(원본 파일 크기·앞뒤 1MB의 SHA-256, `src/lib/fingerprint.ts`)가 같은 앨범에 이미 있으면 기록하지 않고 올라온 R2 객체를 지운다(앨범 안에서 유일, 예전 사진은 `null`)

**시드:** `npx prisma db seed`는 디자인 시안과 같은 샘플 데이터와 개발 계정(`dev-a@daty.local` / `dev-b@daty.local`, 비밀번호 `daty1234`)을 넣는다. DB 이름이 `_dev`로 끝나지 않으면 실행을 거부한다. 이미 시드된 커플이 있으면 아무것도 지우지 않고 건너뛴다. 처음부터 다시 만들려면 `npx prisma db seed -- --reset`(그 커플의 장소·기록·앨범·업로드한 사진 행이 지워진다).

## 이미지 업로드 패턴

오라클 서버의 I/O 부하를 피하기 위해 이미지 파일은 백엔드를 거치지 않는다.

1. 클라이언트가 백엔드에 Presigned Upload URL을 요청
2. 클라이언트가 그 URL로 R2에 직접 PUT
3. 업로드가 끝나면 클라이언트가 백엔드에 객체 키를 알려 DB에 기록

백엔드에 multipart 업로드 엔드포인트를 만들지 않는다.

- R2 버킷은 **비공개**다. `Photo.storageKey`에 객체 키를 저장하고, 응답의 `imageUrl`은 백엔드가 매번 만든 서명 GET URL이다(`src/lib/storage.ts`). 서명 시각을 6일 단위 구간의 시작(19:00 UTC, 한국·일본 새벽 4시)으로 고정하고 7일(SigV4 최대) 유효라서 6일 동안 URL이 같아 브라우저 캐시가 된다(`imageSigningTime`). `imageUrl`만 있는 예전 행은 그 URL을 그대로 준다
- 서명은 AWS SDK 대신 `aws4fetch`로 한다(서버 메모리 절약). R2 환경 변수(`R2_ACCOUNT_ID` 등 4개)가 비어 있으면 업로드는 `503 STORAGE_DISABLED`
- 프론트는 업로드 전에 사진을 긴 변 2048px JPEG와 800px 썸네일로 줄이고 EXIF 촬영 시각(`takenAt`)을 읽는다(`src/lib/images.ts`, `useUploadPhotos`). 동영상은 브라우저에서 다시 인코딩하지 않고 원본 그대로 올리며, 첫 장면 썸네일·길이·촬영 시각(mvhd)만 만든다(`src/lib/videos.ts`). 업로드 URL이 10분짜리라 동영상은 하나씩 올리기 직전에 URL을 받는다. 사진·동영상 모두 한 개씩 올라가는 대로 바로 등록해서 중간에 끊겨도 올라간 만큼은 남는다. 업로드 URL 요청·R2 PUT·등록은 네트워크 끊김이나 5xx면 `withRetry`(`src/lib/api.ts`)로 두 번 더 시도한다(같은 키의 등록 재시도는 서버가 한 번만 기록한다). R2에 올라갔지만 등록되지 않은 파일은 API 프로세스 안의 하루 한 번 타이머(`src/lib/orphans.ts`)가 `couples/` 아래를 훑어, 하루 넘게 어떤 사진 행도 가리키지 않는 것을 지운다. 업로드 중에는 Screen Wake Lock으로 화면이 꺼지지 않게 한다(`src/lib/wakeLock.ts`, 다른 앱으로 가면 웹에서는 멈춘다). 고른 파일 중 앨범에 이미 있는 것(`fingerprint`)은 올리지 않고 건너뛴다. 앱 차원의 용량 한도는 없다(R2 무료 한도 10GB를 넘으면 GB당 월 $0.015) 그리드·앨범 카드·장소 상세는 `thumbnailUrl`, 사진 뷰어는 `imageUrl`을 쓴다. 썸네일이 없는 예전 사진은 `thumbnailUrl`이 원본 URL이다
- 브라우저가 R2에 직접 PUT하므로 버킷 CORS에 프론트 origin의 `PUT`과 `Content-Type` 헤더를 허용해야 한다

## 작업 규칙

- `main`에 직접 커밋하지 않는다. 브랜치를 만들어 작업하고 PR로 병합한다.
- 커밋 전에 해당 패키지에서 `npm run build`가 통과해야 한다. `frontend/`는 `npm run lint`, `backend/`는 `npm test`도 통과해야 한다.
- 백엔드 테스트(`backend/test/`, Node 내장 테스트 러너 + tsx)는 로컬 개발 DB 컨테이너의 별도 DB `daty_test`를 쓴다(없으면 만들고 마이그레이션한 뒤 매번 비운다. 이름이 `_test`로 끝나지 않으면 거부). `.env`는 읽지 않는다. 커플 데이터 라우트를 새로 만들면 `couple-scope.test.ts`에 다른 커플의 id로 접근하는 경우를 추가한다
- 비밀 값(R2 키, DB URL, `SESSION_SECRET` 등)은 `.env`에 두고 커밋하지 않는다. 필요한 키 목록은 `.env.example`로 남긴다.
