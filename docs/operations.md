# 운영

서버 한 대(메모리 1GB)에서 Node, PostgreSQL(Docker), Nginx가 같이 돈다. 이 문서는 백업, 배포, 알림·메일 설정, 서버 이전 방법을 적는다.

## 이번 릴리스를 서버에 올릴 때 (한 번)

새 코드를 받은 뒤 서버에서 스크립트 하나만 돌리면 된다. 의존성 설치 → 마이그레이션 전 DB 덤프(`~/daty-pre-migrate.dump`) → 마이그레이션 → 알림 키 생성(`.env`에 없을 때만) → 백업 한 번 실행 후 cron 등록 → 빌드·재시작 순서다. 다시 돌려도 이미 된 단계는 건너뛴다.

```bash
cd ~/daty && git pull && bash backend/scripts/server-setup.sh "<API를 재시작하는 명령>"
```

## DB 백업

`backend/scripts/backup.mjs`가 `pg_dump`(custom 형식) 결과를 R2 버킷의 `backups/`에 올리고, `BACKUP_KEEP_DAYS`(기본 14)일보다 오래된 덤프를 지운다. 사진과 같은 버킷을 쓰지만 `couples/`와 접두사가 달라 섞이지 않는다.

서버에서 한 번 실행해 보고 cron에 등록한다.

```bash
cd ~/daty/backend && npm run backup
```

```bash
crontab -e
# 매일 04:15 (서버 시각)
15 4 * * * cd ~/daty/backend && /usr/bin/node --env-file=.env scripts/backup.mjs >> ~/daty-backup.log 2>&1
```

- `.env`의 `DATABASE_URL`과 R2 값 4개를 쓴다. Postgres 컨테이너 이름이 `date_app_postgres`가 아니면 `BACKUP_DB_CONTAINER`로 알려 준다(빈 문자열이면 서버에 설치된 `pg_dump`를 쓴다)
- R2 API 토큰에 Object Read & Write 권한이 있어야 한다(목록 조회와 삭제에 필요)
- 실패하면 0이 아닌 코드로 끝나고 로그에 `[backup]`으로 시작하는 줄이 남는다

복원:

```bash
# R2에서 받은 덤프를 서버로 옮긴 뒤
docker exec -i date_app_postgres pg_restore -U <user> -d <db> --clean --if-exists --no-owner < daty-2026-11-11T0415.dump
```

## CI와 배포 (GitHub Actions)

- `.github/workflows/ci.yml`: PR과 `main` 푸시마다 프론트 lint·build, 백엔드 build·test(서비스 컨테이너 Postgres)를 돌린다
- `.github/workflows/deploy-backend.yml`: `main`에 `backend/**`가 바뀌면 Actions에서 빌드한 `dist/`를 서버로 보내고, 서버에서는 `git pull` → `npm install` → `prisma migrate deploy` → 재시작만 한다. 서버에서 TypeScript를 빌드하지 않는다. **저장소 변수 `DEPLOY_HOST`를 넣기 전에는 동작하지 않는다**

배포를 켜려면 GitHub 저장소 Settings → Secrets and variables → Actions에 넣는다.

| 종류 | 이름 | 값 |
|---|---|---|
| Variable | `DEPLOY_HOST` | 서버 주소 |
| Variable | `DEPLOY_USER` | SSH 사용자 |
| Variable | `DEPLOY_PATH` | 서버의 저장소 경로 (예: `/home/ubuntu/daty`) |
| Variable | `DEPLOY_RESTART_COMMAND` | API 재시작 명령. 비우면 `sudo systemctl restart daty-api` |
| Secret | `DEPLOY_SSH_KEY` | 배포 전용 ed25519 개인 키 (공개 키는 서버 `~/.ssh/authorized_keys`에) |
| Secret | `DEPLOY_KNOWN_HOSTS` | `ssh-keyscan <서버>` 출력. 비우면 배포 때마다 새로 받아 온다 |

재시작 명령에 `sudo`가 들어가면 그 명령만 비밀번호 없이 실행되도록 sudoers에 허용해 둔다. 이 워크플로는 실제 서버로 돌려 보지 못했으니 처음 한 번은 Actions 탭에서 수동 실행(`Run workflow`)으로 확인한다.

## 알림 (웹 푸시)

```bash
cd backend && npx web-push generate-vapid-keys
```

나온 두 키를 서버 `.env`의 `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`에 넣고 `VAPID_SUBJECT=mailto:<연락 메일>`을 적은 뒤 재시작한다. 키를 바꾸면 기존 구독이 모두 무효가 되니 한 번 정하면 그대로 둔다.

- 사용자는 내 정보 → 알림에서 기기마다 켠다. iPhone은 홈 화면에 추가한 앱에서만 켤 수 있다
- 아침 알림은 API 프로세스 안의 타이머(`src/lib/notifier.ts`)가 10분마다 확인해, 기기 시간대로 9시 이후 하루 한 번 보낸다: 100일 단위·주년(당일, 하루 전, 7일 전), 오늘·내일 일정, N년 전 오늘
- 짝꿍이 사진·메모에 반응이나 댓글을 남기면 바로 보낸다

## 이메일 비밀번호 재설정

[Resend](https://resend.com) 무료 플랜을 쓴다. 발신 도메인을 Resend에 등록하고 안내하는 SPF/DKIM 레코드를 DNS에 추가한 뒤, 서버 `.env`에 `RESEND_API_KEY`, `MAIL_FROM`(예: `daty <no-reply@ourdaty.com>`), `APP_URL`(예: `https://ourdaty.com`)을 넣는다. 비워 두면 `503 MAIL_DISABLED`이고 짝꿍 코드 방식만 쓴다. 설계는 `docs/password-reset.md`.

## 새 계정 가입

가입은 기본으로 닫혀 있다(`SIGNUP_ENABLED`가 `true`가 아니면 `403 SIGNUP_CLOSED`, 로그인 화면에 가입 탭이 안 보인다). 새 계정이 필요하면 서버 `.env`에 `SIGNUP_ENABLED=true`를 넣고 재시작해 가입을 마친 뒤, 줄을 지우고 다시 재시작한다.

## 무료 한도

| 서비스 | 무료 범위 | 넘기 쉬운 곳 |
|---|---|---|
| Cloudflare R2 | 저장 10GB, 전송료 없음 | 원본 그대로 올라가는 동영상. 내 정보 → 저장 공간에서 사용량을 본다 |
| Google Maps | SKU별 월 무료 호출량 | 두 사람 사용량으로는 여유 |
| Vercel Hobby | 비상업용 | 해당 없음 |
| 서버 | 아래 참고 | 체험 크레딧 종료 |

## 서버 이전 (Google Cloud 무료 체험 → Always Free)

Google Cloud는 유료 계정으로 업그레이드한 뒤에도 `e2-micro` 1대, 표준 영구 디스크 30GB, 월 1GB 송신을 계속 무료로 준다. 단 리전이 `us-west1`, `us-central1`, `us-east1` 중 하나여야 한다. 다른 리전이나 더 큰 머신은 체험이 끝나면 과금된다. 한도 숫자는 바뀔 수 있으니 [공식 문서](https://cloud.google.com/free/docs/free-cloud-features)에서 확인한다.

1. 새 VM을 만든다: `us-west1`, `e2-micro`, Ubuntu 22.04, 표준 영구 디스크 30GB, HTTP/HTTPS 허용, 고정 외부 IP
2. 새 VM에 스왑 1~2GB, Node 22, Docker, Nginx, certbot을 설치하고 저장소를 받는다
3. 기존 서버에서 `npm run backup`으로 덤프를 만들고 새 서버의 Postgres에 `pg_restore`로 넣는다
4. `.env`를 옮기고(값은 그대로, `DATABASE_URL`만 새 서버 기준) API를 띄워 `curl 127.0.0.1:4000/health`로 확인한다
5. `api.ourdaty.com`의 DNS A 레코드를 새 IP로 바꾸고 인증서를 발급한다
6. 며칠 문제없으면 기존 VM과 디스크, 고정 IP를 지운다(남겨 두면 과금된다)

API는 JSON만 주고받고 사진은 브라우저가 R2에서 직접 받으므로 미국 리전이어도 월 1GB 송신 안에 들어온다. 응답이 100~150ms쯤 느려지는 게 거슬리면 서울·도쿄 리전이 있는 Oracle Cloud Always Free(AMD Micro 1GB)가 대안이다.
