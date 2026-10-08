# daty

데이트 기록 앱. 핵심 뷰는 지도/저널, 캘린더, 앨범 세 가지.

## 저장소 구조 (모노레포)

- `frontend/` — React 19 + Vite + TypeScript + Tailwind CSS v4 (`@tailwindcss/vite` 플러그인, PostCSS 설정 없음)
- `backend/` — Express 5 + Prisma 7 (PostgreSQL) + TypeScript (ESM, `NodeNext`). 개발 실행은 `tsx`, 환경 변수 검증과 요청 검증은 `zod`
  - `src/server.ts` 진입점, `src/app.ts` 앱 구성, `src/routes/` 라우터, `src/middlewares/` 공통 미들웨어, `src/config/env.ts` 환경 변수
  - Prisma Client는 `prisma-client` 생성기로 `src/generated/prisma`에 생성되며 커밋하지 않는다 (`npm install` 시 자동 생성). `@prisma/adapter-pg` 드라이버 어댑터 사용
  - ESM이므로 상대 경로 import에는 `.js` 확장자를 붙인다
- 프론트와 백엔드가 같이 쓰는 API 타입이 생기면 `shared/`로 분리를 검토

각 패키지는 자기 디렉토리에서 독립적으로 `npm install` / `npm run ...` 한다. 루트에는 package.json이 없다.

## 인프라

- **Frontend 배포:** Vercel(또는 Netlify). 프로젝트 Root Directory는 `frontend`.
- **Backend 배포:** Oracle Cloud Always Free AMD 인스턴스 (x86_64, **메모리 1GB**, Ubuntu 22.04). 서버에서 `git pull`로 배포. Node, PostgreSQL, Nginx가 한 대에서 같이 돌기 때문에 메모리를 아껴 쓴다 (서버에서 TypeScript 빌드나 무거운 작업은 피하고, 프로세스는 하나만 띄운다).
- **로컬 개발 DB:** Mac의 OrbStack(Docker)에서 `backend/compose.yaml`로 구동 (`npm run db:up`). `localhost:5433`, 계정 `daty`/`daty`, DB `daty_dev`. 개발과 테스트는 이 DB로 하고, 운영 DB에는 붙지 않는다.
- **DB:** PostgreSQL 15, 같은 Oracle VM의 Docker 컨테이너(`date_app_postgres`, compose 파일은 서버의 `~/app-db/`)로 구동. 포트는 `127.0.0.1:5432`에만 열려 있어 로컬에서는 SSH 터널(`ssh -L 5432:localhost:5432 oracle-server`)로 접속한다.
- **이미지 저장:** Cloudflare R2.

## 데이터 모델 (`backend/prisma/schema.prisma`)

- 커플 단위 앱: `Couple`에 `User` 두 명이 `coupleCode`로 묶이고, 모든 데이터는 `coupleId`로 소유된다.
- `Place`: 지도 핀. Google Maps 기반(`googlePlaceId`). 상태는 `WISH`(가고 싶은 곳) / `VISITED`.
- `DateRecord`: 캘린더 항목. `PLAN`(일정) / `RECORD`(기록). 장소 하나와 연결되고, 앨범에 묶일 수 있다.
- `Album` / `Photo`: 앨범 탭. 하루 데이트의 여러 기록과 사진을 하나의 앨범으로 묶는다.

스키마를 바꿀 때는 로컬 개발 DB에서 `npm run db:migrate`(`prisma migrate dev`)로 마이그레이션 파일을 만들어 커밋하고, 운영 DB에는 `npx prisma migrate deploy`만 쓴다. 운영 DB에 `migrate dev`, `db push`, `migrate reset`을 실행하지 않는다.

## 이미지 업로드 패턴

오라클 서버의 I/O 부하를 피하기 위해 이미지 파일은 백엔드를 거치지 않는다.

1. 클라이언트가 백엔드에 Presigned Upload URL을 요청
2. 클라이언트가 그 URL로 R2에 직접 PUT
3. 업로드가 끝나면 클라이언트가 백엔드에 객체 키를 알려 DB에 기록

백엔드에 multipart 업로드 엔드포인트를 만들지 않는다.

## 작업 규칙

- `main`에 직접 커밋하지 않는다. 브랜치를 만들어 작업하고 PR로 병합한다.
- 커밋 전에 해당 패키지에서 `npm run build`가 통과해야 한다. `frontend/`는 `npm run lint`도 통과해야 한다.
- 비밀 값(R2 키, DB URL 등)은 `.env`에 두고 커밋하지 않는다. 필요한 키 목록은 `.env.example`로 남긴다.
