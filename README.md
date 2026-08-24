# Hwalingo

React/Vite 프론트엔드와 Express/PostgreSQL 백엔드를 npm workspaces로 관리합니다.

## 구조

```text
hwalingo/
├── frontend/       # React + TypeScript + Vite
├── backend/        # Express + TypeScript + PostgreSQL
├── docs/           # 기존 기획/화면 문서
└── docker-compose.yml
```

## 로컬 실행

필요 조건: Node.js 20 이상, Docker(로컬 PostgreSQL을 사용할 경우)

```bash
npm install
cp backend/.env.example backend/.env
docker compose up -d postgres
npm run dev
```

- 프론트엔드: http://localhost:5173
- 백엔드: http://localhost:4000/api
- DB 상태 확인: http://localhost:4000/api/health

개발 중 프론트엔드의 `/api` 요청은 Vite 프록시를 통해 백엔드(4000번 포트)로 전달됩니다.

## 명령어

```bash
npm run dev            # 프론트엔드와 백엔드 동시 실행
npm run dev:frontend   # 프론트엔드만 실행
npm run dev:backend    # 백엔드만 실행
npm run build          # 전체 빌드
npm run lint           # 전체 정적 검사
```

DB 연결은 `backend/.env`의 `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`,
`PGPASSWORD`로 설정합니다. 운영 환경에서 TLS가 필요하면 `DB_SSL=true`를
추가하세요.

## 비밀번호 재설정 이메일

비밀번호 재설정 인증코드는 SMTP로 발송됩니다. `backend/.env`에 다음 값을
설정한 후 백엔드를 다시 시작하세요.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
MAIL_FROM="Hwalingo <your-email@gmail.com>"
```

Gmail을 사용하는 경우 일반 계정 비밀번호가 아니라 Google 계정에서 만든
앱 비밀번호를 `SMTP_PASSWORD`에 입력해야 합니다.
