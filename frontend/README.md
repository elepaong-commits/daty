# daty frontend

React 19 + Vite + TypeScript + Tailwind CSS v4. 지도(Google Maps), 캘린더, 앨범 세 탭과 장소·앨범 상세 화면.

## 실행

```bash
npm install
cp .env.example .env.local   # Google Maps 키와 지도 ID
npm run dev                  # http://localhost:5173, /api는 127.0.0.1:4000(백엔드)으로 프록시
```

백엔드와 개발 DB 띄우는 법은 저장소 루트의 `README.md`.

## 스크립트

| 명령 | 내용 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 후 `dist/`로 빌드 |
| `npm run lint` | ESLint |
| `npm test` | Vitest (`src/**/*.test.ts`, `src/lib`의 순수 로직) |
| `npm run preview` | 빌드 결과 미리 보기 |

커밋 전에 `lint`, `test`, `build`가 모두 통과해야 한다(CI도 같은 순서로 돌린다).

## 환경 변수 (`.env.local`)

| 이름 | 내용 |
|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | Maps JavaScript API + Places API(New). 사이트 referrer로 제한한다 |
| `VITE_GOOGLE_MAPS_MAP_ID` | 기본 디자인의 지도 스타일 |
| `VITE_GOOGLE_MAPS_MAP_ID_RETRO` | 도트 디자인의 지도 스타일(없으면 위 값) |
| `VITE_GOOGLE_MAPS_MAP_ID_SCRAP` | 스크랩북 디자인의 지도 스타일(없으면 기본 값) |
| `VITE_API_URL` | 운영 빌드의 API 주소. 비우면 같은 사이트의 `/api`(Vercel rewrite) |

## 구조

- `src/features/<화면>/` 화면, `src/components/` 공용 UI, `src/lib/` API·쿼리·타입·유틸
- 화면 문구는 `src/lib/messages.ts`의 `ko`·`ja` 양쪽에 넣고 `useT()`로 쓴다
- 색·글꼴은 `src/index.css`의 토큰과 `ui-*` 클래스(기본·도트 두 디자인)를 쓴다

자세한 규칙은 저장소 루트의 `CLAUDE.md`.
