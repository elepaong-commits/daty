# daty

**한국어** · [日本語](README.ja.md)

커플이 함께 쓰는 데이트 기록 웹앱입니다. 가고 싶은 곳과 다녀온 곳을 지도에 모으고, 일정과 기록을 캘린더에 남기고, 그날의 사진과 동영상을 앨범으로 묶습니다. 실제로 배포해서 운영하고 있는 서비스입니다.

## 주요 기능

- **지도 / 저널:** Google 장소 검색으로 장소를 저장하고, 가고 싶은 곳과 다녀온 곳을 핀으로 봅니다. 장소마다 메모, 평점, 방문 기록, 그 장소에서 찍은 앨범을 함께 보여 줍니다
- **캘린더:** 일정(PLAN)과 기록(RECORD)을 날짜별로 남깁니다. 하루의 기록을 시간순으로 이어 "데이트 코스"로 보고, 기념일(100일 단위, 매년)을 자동으로 표시합니다
- **앨범:** 하루, 여행 기간, 월 단위로 사진·동영상을 묶습니다. 베스트 컷(표지), 설명, 순서 바꾸기, 다른 앨범으로 옮기기, 한꺼번에 저장하기를 지원합니다
- **함께 쓰기:** 사진과 메모에 이모지 반응과 댓글을 남기고, 짝꿍이 새 일정이나 사진을 올리면 웹 푸시로 알려 줍니다. 아침에는 기념일, 오늘 일정, "N년 전 오늘"을 알려 줍니다
- **연말 결산:** 한 해 동안 간 곳, 동네, 사진 수를 모아 보여 줍니다
- **한국어 / 일본어:** 화면 문구는 모두 두 언어로 준비돼 있고, 장소 이름은 그 나라 말로 저장합니다
- **디자인 두 벌:** 기본 디자인과 도트(픽셀) 디자인을 기기마다 고를 수 있고, 각각 밝은 모드와 어두운 모드를 지원합니다
- **오프라인 읽기:** 서비스 워커가 앱과 최근 데이터, 썸네일을 캐시해서 연결이 끊겨도 기록을 볼 수 있습니다

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프론트엔드 | React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, React Router, Google Maps JS API (Places API New) |
| 백엔드 | Node.js, Express 5, Prisma 7, PostgreSQL 15, Zod |
| 저장소 | Cloudflare R2 (비공개 버킷, 서명 URL) |
| 인프라 | Vercel (프론트엔드), Google Cloud VM 1GB (API + DB + Nginx), GitHub Actions (CI·배포) |
| 테스트 | Vitest (프론트엔드 로직), Node 내장 테스트 러너 + 실제 PostgreSQL (백엔드 API) |

## 설계에서 신경 쓴 점

- **메모리 1GB 서버에 맞춘 설계:** 사진과 동영상은 서버를 거치지 않고 브라우저가 presigned URL로 R2에 직접 올립니다. 서버는 R2에 HEAD를 보내 크기와 형식만 확인한 뒤 기록합니다. 서명에는 AWS SDK 대신 가벼운 `aws4fetch`를 쓰고, 알림·정리 작업도 별도 프로세스 없이 API 프로세스 안의 타이머로 돌립니다
- **브라우저에서 미리 처리하기:** 업로드 전에 사진을 줄이고 썸네일을 만들고 EXIF 촬영 시각을 읽습니다. 파일 지문(SHA-256)으로 같은 사진이 두 번 올라가지 않게 하고, 끊겨도 올라간 만큼은 남도록 한 장씩 등록합니다
- **이미지 캐시:** 사진 서명 URL의 서명 시각을 6일 단위로 고정해서 URL이 바뀌지 않게 하고, 브라우저 캐시가 그대로 쓰이게 했습니다
- **커플 단위 데이터 격리:** 모든 데이터는 커플 id로 소유되고, 모든 쿼리는 로그인한 사람의 커플로 범위를 제한합니다. 다른 커플의 id로 접근하는 경우를 테스트로 확인합니다
- **접근성:** 모달 포커스 가두기, 키보드 포커스 표시, 44px 터치 영역, 텍스트 대비 기준을 지킵니다

## 보안

- 비밀번호는 scrypt로 해시하고, 세션은 httpOnly · SameSite=Lax 쿠키(HS256 JWT)로 관리합니다. 비밀번호를 바꾸면 다른 기기의 세션은 바로 무효가 됩니다
- 로그인, 비밀번호 재설정, 초대 코드 입력 같은 곳은 IP별로 시도 횟수를 제한합니다. 해시 계산도 한 번에 몇 개만 돌려서 요청이 몰려도 서버 메모리가 바닥나지 않게 했습니다
- 가입은 기본으로 닫혀 있습니다. 요청 본문은 모두 Zod로 검증하고, 사용자가 남기는 링크는 `http(s)`만 받습니다
- R2 버킷은 비공개이고 업로드 키 형식을 서버에서 검사합니다. DB 백업은 쓰기 권한을 따로 둔 별도 버킷에 올립니다
- 비밀 값(API 키, DB 주소, 세션 키)은 저장소에 없습니다. 필요한 키 목록은 `.env.example`에 있습니다

## 저장소 구조

| 디렉토리 | 내용 |
|---|---|
| [frontend/](frontend/) | React 앱 (`src/features/` 화면, `src/components/` 공용 UI, `src/lib/` API·유틸) |
| [backend/](backend/) | API 서버 (`src/modules/` 라우터, `src/lib/` 공용 로직, `prisma/` 스키마·마이그레이션) |
| [docs/](docs/) | 운영 문서 (백업, 배포, 서버 이전), 비밀번호 재설정 설계 |

## 로컬에서 실행하기

Node.js 22와 Docker가 필요합니다.

```bash
# backend (http://127.0.0.1:4000)
cd backend
npm install
cp .env.example .env       # 기본값은 로컬 개발 DB. SESSION_SECRET은 openssl rand -base64 48 결과로 바꾼다
npm run db:up              # 개발용 PostgreSQL (Docker, localhost:5433)
npm run db:migrate:deploy  # 마이그레이션 적용
npx prisma db seed         # 샘플 데이터와 개발 계정 dev-a@daty.local / daty1234
npm run dev
```

```bash
# frontend (http://localhost:5173)
cd frontend
npm install
cp .env.example .env.local  # Google Maps API 키와 지도 ID
npm run dev
```

R2, 메일(Resend), 웹 푸시 키는 비워 두면 그 기능만 꺼진 채로 실행됩니다.

테스트:

```bash
cd backend && npm test             # 별도 DB daty_test를 만들어 쓴다
cd frontend && npm run lint && npm test
```
