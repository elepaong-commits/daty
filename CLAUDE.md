# daty

데이트 기록 앱. 핵심 뷰는 지도/저널, 캘린더, 앨범 세 가지.

## 저장소 구조 (모노레포)

- `frontend/` — React 19 + Vite + TypeScript + Tailwind CSS v4 (`@tailwindcss/vite` 플러그인, PostCSS 설정 없음)
  - React Router(탭 3개: `/`, `/calendar`, `/albums` + 하위 화면 `/places/:id`, `/places/:id/edit`, `/albums/:id`. 하위 화면에서도 해당 탭이 활성 표시된다), TanStack Query(`src/lib/queries.ts`), 지도는 `@vis.gl/react-google-maps`
  - Google Maps JS는 `MapsProvider`(`src/lib/maps.tsx`)가 앱 전체에 한 번 로드한다. 지도와 장소 검색(Places API New, 자동완성 세션 토큰 사용)이 함께 쓴다
  - 디자인 토큰(색상·글꼴·그림자)은 `src/index.css`의 `@theme`에 있다. 새 색을 하드코딩하지 말고 토큰을 쓴다 (`bg-brand`, `text-muted`, `font-display` 등)
  - 화면은 `src/features/<화면>/`, 공용 UI는 `src/components/`, API·타입·날짜 유틸은 `src/lib/`
  - 한국어/일본어 지원. 화면 문구는 하드코딩하지 않고 `src/lib/messages.ts`의 `ko`와 `ja` 양쪽에 넣은 뒤 `useT()`로 쓴다(`ja`는 `Messages` 타입이라 키가 빠지면 빌드가 깨진다). 언어는 헤더 오른쪽 위 토글로 바꾸고 기기(localStorage)에 기억한다. Google 지도 타일 언어는 페이지를 처음 열 때 언어로 고정된다
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
- **Backend 배포:** Oracle Cloud Always Free AMD 인스턴스 (x86_64, **메모리 1GB**, Ubuntu 22.04). 서버에서 `git pull`로 배포. Node, PostgreSQL, Nginx가 한 대에서 같이 돌기 때문에 메모리를 아껴 쓴다 (서버에서 TypeScript 빌드나 무거운 작업은 피하고, 프로세스는 하나만 띄운다).
- **로컬 개발 DB:** Mac의 OrbStack(Docker)에서 `backend/compose.yaml`로 구동 (`npm run db:up`). `localhost:5433`, 계정 `daty`/`daty`, DB `daty_dev`. 개발과 테스트는 이 DB로 하고, 운영 DB에는 붙지 않는다.
- **DB:** PostgreSQL 15, 같은 Oracle VM의 Docker 컨테이너(`date_app_postgres`, compose 파일은 서버의 `~/app-db/`)로 구동. 포트는 `127.0.0.1:5432`에만 열려 있어 로컬에서는 SSH 터널(`ssh -L 5432:localhost:5432 oracle-server`)로 접속한다.
- **이미지 저장:** Cloudflare R2.

## 데이터 모델 (`backend/prisma/schema.prisma`)

- 커플 단위 앱: `Couple`에 `User` 두 명이 `coupleCode`로 묶이고, 모든 데이터는 `coupleId`로 소유된다.
- `Place`: 지도 핀. Google Maps 기반(`googlePlaceId`). 상태는 `WISH`(가고 싶은 곳) / `VISITED`.
- `PlaceNote`: 장소 메모(여러 개, 작성자 포함). 본문에 `{{EAT}}` `{{SEE}}` `{{DO}}` 태그 토큰이 들어가고, 프론트(`src/lib/memo.ts`)가 입력창에서는 보는 사람 언어의 문구로 풀고 저장할 때 다시 토큰으로 바꾼다. `DateRecord.memo`도 같은 토큰을 쓴다.
- `DateRecord`: 캘린더 항목. `PLAN`(일정) / `RECORD`(기록). 장소 하나와 연결되고, 앨범에 묶일 수 있다.
- `Album` / `Photo`: 앨범 탭. 하루 데이트의 여러 기록과 사진을 하나의 앨범으로 묶는다.

스키마를 바꿀 때는 로컬 개발 DB에서 `npm run db:migrate`(`prisma migrate dev`)로 마이그레이션 파일을 만들어 커밋하고, 운영 DB에는 `npx prisma migrate deploy`만 쓴다. 운영 DB에 `migrate dev`, `db push`, `migrate reset`을 실행하지 않는다.

## API (`backend/src/modules/`)

**인증:** 이메일 + 비밀번호. 로그인하면 `daty_session` 쿠키(httpOnly, SameSite=Lax, 30일, HS256 JWT)가 발급된다. 비밀번호는 `node:crypto` scrypt로 해시(`src/lib/password.ts`). 로그인·가입은 IP당 15분에 10회 실패로 제한.

- `requireAuth` → `req.userId`, `requireCouple` → `req.coupleId` (`src/middlewares/auth.ts`). 커플 데이터 라우터(places, records, albums)는 둘 다 거친다
- 커플 데이터 쿼리는 반드시 `req.coupleId`로 범위를 제한한다 (`where: { id, coupleId }`)
- 에러 응답은 `{ error, code }`. 프론트는 `code`(`UNAUTHENTICATED`, `COUPLE_REQUIRED`, `INVALID_CREDENTIALS` 등)로 분기한다

- `POST /api/auth/signup|login|logout`, `GET /api/auth/me` — 응답은 `{ user, couple | null }`
- `POST /api/couple` (기념일 → 6자리 초대 코드 발급), `POST /api/couple/join` (코드로 합류, 최대 2명)
- `GET /api/couple` — 초대 코드, 기념일(`anniversaryDate`), 두 사람 정보. D+N은 클라이언트에서 계산
- `GET|POST /api/places`, `GET|PATCH|DELETE /api/places/:id` — `?status=&category=` 필터. 응답에 방문 횟수, 평균 평점, 마지막 방문일 포함
  - 목록 응답의 `latestNote`는 가장 최근 메모. `POST`는 `note`로 첫 메모를 함께 만들 수 있고, 같은 `googlePlaceId`가 이미 있으면 `409 PLACE_EXISTS`
  - `GET /:id`는 최근 방문(`latestVisit`), 메모(`notes`, 최신순), 방문 기록이 묶인 앨범(사진 3장)을 함께 준다
  - `POST /api/places/:id/notes` (`{ content }`), `DELETE /api/places/:id/notes/:noteId`
  - `PATCH /:id`의 `visit: { scheduledAt, rating }`은 그 장소의 최근 방문 기록을 고치고, 방문 기록이 없으면 새로 만든다 (장소 자체에는 날짜·평점 컬럼이 없다)
- `GET /api/records?from=&to=` (ISO, 오프셋 포함), `POST`, `PATCH|DELETE /api/records/:id` — 생성과 수정 모두 `resolvePlace`로 장소를 찾거나 만든다. 수정 시 장소 이름이 바뀌거나 검색으로 고르면 다른 장소로 옮긴다
  - 생성 시 `placeId`(일정 등록의 "저장한 장소") 또는 `placeName`("새 장소"). 기존 장소는 `googlePlaceId` → 이름 순으로 찾아 재사용하고, 없으면 생성. 다른 장소로 옮기면 제목도 그 장소 이름이 된다
  - **지도 핀은 좌표가 있는 장소에만 생긴다.** 좌표·주소·`googlePlaceId`는 프론트의 Google 장소 검색(`PlaceSearch`)에서 온다. 이름만 있던 장소도 나중에 검색으로 고르면 좌표가 채워진다
  - `RECORD`가 되면 장소를 `VISITED`로 올린다. `PLAN`은 장소 상태를 내리지 않는다
- `GET|POST /api/albums`, `GET|PATCH|DELETE /api/albums/:id`, `DELETE /api/albums/:id/photos/:photoId` — `coverPhotoId`가 "베스트 컷"(앨범 표지). 고르지 않으면(`null`) 응답의 `coverPhoto`는 첫 번째 사진. 사진이나 앨범을 지우면 원본·썸네일 R2 객체도 지운다(실패해도 로그만 남김)
  - `POST /api/albums/:id/photos/uploads` (`{ files: [{ contentType }] }`, 최대 30장) → 업로드할 `key`, presigned `uploadUrl`(10분), 보낼 `headers`, 그리고 같은 모양의 `thumbnail`(`{uuid}.thumb.jpg`)
  - `POST /api/albums/:id/photos` (`{ photos: [{ key, thumbnailKey, takenAt }] }`) — R2에 HEAD로 실제 업로드(원본 15MB, 썸네일 2MB 이하 이미지)를 확인한 뒤 기록. 키는 `couples/{coupleId}/albums/{albumId}/{uuid}.{ext}`와 그 썸네일 키만 받는다. 썸네일 업로드만 실패하면 `thumbnailKey: null`로 보내고 원본을 쓴다

**시드:** `npx prisma db seed`는 디자인 시안과 같은 샘플 데이터와 개발 계정(`dev-a@daty.local` / `dev-b@daty.local`, 비밀번호 `daty1234`)을 넣는다. DB 이름이 `_dev`로 끝나지 않으면 실행을 거부한다. 이미 시드된 커플이 있으면 아무것도 지우지 않고 건너뛴다. 처음부터 다시 만들려면 `npx prisma db seed -- --reset`(그 커플의 장소·기록·앨범·업로드한 사진 행이 지워진다).

## 이미지 업로드 패턴

오라클 서버의 I/O 부하를 피하기 위해 이미지 파일은 백엔드를 거치지 않는다.

1. 클라이언트가 백엔드에 Presigned Upload URL을 요청
2. 클라이언트가 그 URL로 R2에 직접 PUT
3. 업로드가 끝나면 클라이언트가 백엔드에 객체 키를 알려 DB에 기록

백엔드에 multipart 업로드 엔드포인트를 만들지 않는다.

- R2 버킷은 **비공개**다. `Photo.storageKey`에 객체 키를 저장하고, 응답의 `imageUrl`은 백엔드가 매번 만든 서명 GET URL이다(`src/lib/storage.ts`). 서명 시각을 UTC 자정으로 고정하고 2일 유효라서 하루 동안 URL이 같아 브라우저 캐시가 된다. `imageUrl`만 있는 예전 행은 그 URL을 그대로 준다
- 서명은 AWS SDK 대신 `aws4fetch`로 한다(서버 메모리 절약). R2 환경 변수(`R2_ACCOUNT_ID` 등 4개)가 비어 있으면 업로드는 `503 STORAGE_DISABLED`
- 프론트는 업로드 전에 사진을 긴 변 2048px JPEG와 800px 썸네일로 줄이고 EXIF 촬영 시각(`takenAt`)을 읽는다(`src/lib/images.ts`, `useUploadPhotos`). 그리드·앨범 카드·장소 상세는 `thumbnailUrl`, 사진 뷰어는 `imageUrl`을 쓴다. 썸네일이 없는 예전 사진은 `thumbnailUrl`이 원본 URL이다
- 브라우저가 R2에 직접 PUT하므로 버킷 CORS에 프론트 origin의 `PUT`과 `Content-Type` 헤더를 허용해야 한다

## 작업 규칙

- `main`에 직접 커밋하지 않는다. 브랜치를 만들어 작업하고 PR로 병합한다.
- 커밋 전에 해당 패키지에서 `npm run build`가 통과해야 한다. `frontend/`는 `npm run lint`도 통과해야 한다.
- 비밀 값(R2 키, DB URL, `SESSION_SECRET` 등)은 `.env`에 두고 커밋하지 않는다. 필요한 키 목록은 `.env.example`로 남긴다.
