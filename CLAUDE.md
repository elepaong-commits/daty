# daty

데이트 기록 앱. 핵심 뷰는 지도/저널, 캘린더, 앨범 세 가지.

## 저장소 구조 (모노레포)

- `frontend/` — React 19 + Vite + TypeScript + Tailwind CSS v4 (`@tailwindcss/vite` 플러그인, PostCSS 설정 없음)
- `backend/` — Express + TypeScript + Prisma (아직 없음)
- 프론트와 백엔드가 같이 쓰는 API 타입이 생기면 `shared/`로 분리를 검토

각 패키지는 자기 디렉토리에서 독립적으로 `npm install` / `npm run ...` 한다. 루트에는 package.json이 없다.

## 인프라

- **Frontend 배포:** Vercel(또는 Netlify). 프로젝트 Root Directory는 `frontend`.
- **Backend 배포:** Oracle Cloud Always Free ARM 인스턴스 (Ubuntu). 서버에서 `git pull`로 배포.
- **DB:** PostgreSQL, 같은 Oracle VM에서 구동.
- **이미지 저장:** Cloudflare R2.

## 이미지 업로드 패턴

오라클 서버의 I/O 부하를 피하기 위해 이미지 파일은 백엔드를 거치지 않는다.

1. 클라이언트가 백엔드에 Presigned Upload URL을 요청
2. 클라이언트가 그 URL로 R2에 직접 PUT
3. 업로드가 끝나면 클라이언트가 백엔드에 객체 키를 알려 DB에 기록

백엔드에 multipart 업로드 엔드포인트를 만들지 않는다.

## 작업 규칙

- `main`에 직접 커밋하지 않는다. 브랜치를 만들어 작업하고 PR로 병합한다.
- 커밋 전에 해당 패키지에서 `npm run build`와 `npm run lint`가 통과해야 한다.
- 비밀 값(R2 키, DB URL 등)은 `.env`에 두고 커밋하지 않는다. 필요한 키 목록은 `.env.example`로 남긴다.
