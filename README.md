# Hwalingo

영어 문장 분석, 단어장, 퀴즈, 스토리텔링 학습을 제공하는 웹 애플리케이션입니다.
React/Vite 프론트엔드와 Express/PostgreSQL 백엔드를 npm workspaces로 관리합니다.

- [PROJECT_GUIDE.md](PROJECT_GUIDE.md): 기술 구조, 디자인·개발 규칙, AI 분석과 학습 정책
- [AGENTS.md](AGENTS.md): AI 작업 지침

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
- 백엔드: http://localhost:5002/api
- DB 상태 확인: http://localhost:5002/api/health

개발 중 프론트엔드의 `/api` 요청은 Vite 프록시를 통해 백엔드(5002번 포트)로 전달됩니다.

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

Gmail은 `SMTP_PASSWORD`에 Google 계정의 앱 비밀번호를 사용합니다.

## 백엔드 운영 배포

백엔드는 PM2로 실행하고 Cloudflare Tunnel은 운영체제 서비스로 실행합니다.
`backend/.env`에는 운영용 DB 접속 정보와 충분히 긴 `JWT_SECRET`을 설정하고,
프론트엔드의 실제 주소를 `CORS_ORIGIN`에 입력하세요. Tunnel만 백엔드에
접근하도록 기본 `HOST=127.0.0.1`을 유지합니다.

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=5002
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
curl http://127.0.0.1:5002/api/health
```

상태·로그 확인은 `pm2 status`, `pm2 logs hwalingo-backend`를 사용합니다.
재시작·중지는 위의 `npm run pm2:*` 명령, 프로세스 삭제는
`pm2 delete hwalingo-backend`를 사용합니다.

Cloudflare 대시보드의 **Networking > Tunnels**에서 Tunnel을 만들고 Published
application의 Service URL을 `http://localhost:5002`로 지정합니다. 예를 들어
`api.hwalingo.example.com`을 연결한 뒤 대시보드가 제공하는 명령으로
`cloudflared` 서비스를 설치합니다.

```bash
sudo cloudflared service install <TUNNEL_TOKEN>
sudo systemctl status cloudflared
curl https://api.hwalingo.example.com/api/health
```

## 사진 글자 추출 (Google Cloud Vision)

`/study`에서 사진 촬영 또는 이미지 업로드 후 원하는 영역을 잘라 글자를 추출할 수 있습니다.
사진 위에서 영역을 이동하거나 모서리를 드래그하고, 미세 조절 슬라이더로 위치와 크기를
조정한 뒤 `선택 영역에서 글자 추출`을 누르면 바로 OCR을 시작합니다.
별도 추출 시작 화면 없이 완료 후 추출한 글 확인 화면으로 이동합니다. 자른 부분만 OCR로 전송하며,
`영역 다시 자르기`는 원본 사진에서 시작합니다. `전체 이미지 사용`을 누르면 사진 전체 영역이 선택됩니다. 선택을 확인한 뒤
`선택 영역에서 글자 추출`을 눌러 추출합니다.
JPEG, PNG, WebP 사진 한 장(최대 10MB, 4천만 화소)을 지원합니다.
추출 결과에는 Google 응답의 감지 언어와 인식 신뢰도(페이지별 점수의 산술 평균)를 표시합니다.
신뢰도는 실제 정답률이 아니며, 응답에 값이 없으면 정보 없음으로 표시합니다.
추출한 글은 확인·수정한 뒤 500자 이내로 입력창에 적용합니다.
사진은 Google로 전송되며 애플리케이션 DB나 디스크에는 저장하지 않습니다.
PDF와 HEIC는 초기 지원 대상에 포함하지 않습니다.

1. Google Cloud 프로젝트에 결제 계정을 연결하고 Cloud Vision API를 활성화합니다.
2. 서버에 Application Default Credentials(ADC)를 설정합니다. 로컬 개발에서는
   `gcloud auth application-default login`을 사용할 수 있습니다.
3. 현재처럼 Google Cloud 외부 서버에서 서비스 계정 JSON을 사용하는 경우,
   자격증명 파일을 저장소와 웹 공개 경로 밖에 보관하고 서버 사용자만 읽도록 설정합니다.
   `backend/.env`의 `GOOGLE_APPLICATION_CREDENTIALS`에 파일의 절대 경로를 설정합니다.
   JSON 내용이나 비밀 키를 프론트엔드 환경변수에 넣지 마세요.
4. 백엔드를 빌드하고 재시작합니다. 설정 변경 후에는
   `npm run pm2:restart`로 재시작합니다.
5. 로그인 후 선명한 인쇄물 사진으로 실제 추출을 확인합니다.

인증이 없거나 API가 비활성화되어 있으면 OCR 요청에서 오류를 안내하며,
다른 학습 기능은 계속 사용할 수 있습니다. OCR은 자동 재시도하지 않습니다.
사용자당 분당 최대 5회, 동시 1회로 제한합니다. 제한 상태는 서버 메모리에
있으므로 재시작하면 초기화되며 여러 서버 사이에 공유되지 않습니다.
Google Cloud 콘솔에서 사용량과 할당량을 함께 관리하세요.

공식 설정 문서: https://docs.cloud.google.com/vision/docs/setup

OCR API 자동 검증(Google 호출은 모의 응답으로 대체):

```bash
JWT_SECRET=ocr-test-secret node --import tsx --test backend/src/routes/ocr.test.ts
```

## 테스트 오답 재도전

`backend/sql/015_quiz_retries.sql`을 DB에 적용한 뒤 백엔드를 실행합니다.
오답은 테스트 맨 뒤에서 맞힐 때까지 다시 출제되며, 재도전은 숙련도·복습일·XP·첫 시도 통계를 변경하지 않습니다.
진행 중인 테스트는 페이지를 다시 열면 이어서 풀 수 있습니다.

독립 임시 PostgreSQL DB를 사용하는 API 통합 검증(실제 앱 DB는 사용하지 않음):

```bash
node --import tsx --test backend/src/routes/quizzes.test.ts
```

PostgreSQL 서버 실행 도구가 필요하며, 기본 경로는 `/usr/lib/postgresql/16/bin`입니다.
다른 위치에 설치했다면 `PG_BINDIR`로 지정합니다.
