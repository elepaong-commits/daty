# daty

데이트 기록 앱. 지도/저널, 캘린더, 앨범 세 가지 뷰로 데이트 일기와 사진을 기록합니다.

| 디렉토리 | 내용 |
|---|---|
| [frontend/](frontend/) | React + Vite + TypeScript + Tailwind CSS v4 |
| [backend/](backend/) | Express + Prisma 7 + PostgreSQL |

## 로컬 실행

```bash
# frontend (http://localhost:5173)
cd frontend
npm install
cp .env.example .env.local  # Google Maps 키와 지도 ID
npm run dev

# backend (http://127.0.0.1:4000)
cd backend
npm install
cp .env.example .env       # 기본값이 로컬 개발 DB. SESSION_SECRET은 openssl rand -base64 48 로 교체
npm run db:up              # 개발용 PostgreSQL (Docker, localhost:5433)
npm run db:migrate:deploy  # 마이그레이션 적용
npx prisma db seed         # 샘플 데이터 + 개발 계정 dev-a@daty.local / daty1234
npm run dev
```
