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
npm run pm2:start      # 운영 백엔드 시작
npm run pm2:restart    # 빌드/환경변수 변경 후 백엔드 재시작
npm run pm2:stop       # 운영 백엔드 중지
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

## 백엔드 운영 배포

백엔드는 PM2로 실행하고 Cloudflare Tunnel은 운영체제 서비스로 실행합니다.
`backend/.env`에는 운영용 DB 접속 정보와 충분히 긴 `JWT_SECRET`을 설정하고,
프론트엔드의 실제 주소를 `CORS_ORIGIN`에 입력하세요. Tunnel만 백엔드에
접근하도록 기본 `HOST=127.0.0.1`을 유지합니다.

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=4000
CORS_ORIGIN=https://hwalingo.example.com
```

PM2를 전역 설치한 서버에서 다음 명령을 실행합니다.

```bash
npm install
npm run build -w backend
npm run pm2:start
pm2 save
pm2 startup
```

`pm2 startup`이 출력하는 `sudo ...` 명령을 한 번 실행한 뒤 `pm2 save`를
다시 실행해야 재부팅 후에도 백엔드가 복구됩니다. 이후 배포는 다음 순서로
진행합니다.

```bash
git pull
npm install
npm run build -w backend
npm run pm2:restart
curl http://127.0.0.1:4000/api/health
```

PM2 관리 명령은 다음과 같습니다.

```bash
pm2 status
pm2 logs hwalingo-backend
pm2 restart hwalingo-backend
pm2 stop hwalingo-backend
pm2 delete hwalingo-backend
```

Cloudflare 대시보드의 **Networking > Tunnels**에서 Tunnel을 만들고 Published
application의 Service URL을 `http://localhost:4000`으로 지정합니다. 예를 들어
`api.hwalingo.example.com`을 연결한 뒤 대시보드가 제공하는 명령으로
`cloudflared` 서비스를 설치합니다.

```bash
sudo cloudflared service install <TUNNEL_TOKEN>
sudo systemctl status cloudflared
curl https://api.hwalingo.example.com/api/health
```

Tunnel token은 비밀번호와 같으므로 저장소나 문서에 기록하지 마세요. Tunnel은
외부에서 4000번 포트를 열 필요가 없으므로 공유기 포트 포워딩과 해당 포트의
외부 방화벽 허용도 설정하지 않습니다.
