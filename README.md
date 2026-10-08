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
npm run dev

# backend (http://127.0.0.1:4000)
cd backend
npm install
cp .env.example .env   # DATABASE_URL 등 값 채우기
npm run dev
```
