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
npm run pm2:restart    # 백엔드를 새로 빌드한 뒤 재시작
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

`npm run pm2:restart`는 최신 백엔드 소스를 빌드한 뒤 PM2를 재시작합니다.
`pm2 restart hwalingo-backend`만 직접 실행하면 기존 `backend/dist` 파일을 그대로 실행하므로 소스 변경이 반영되지 않을 수 있습니다.
개발 서버와 PM2 백엔드를 동시에 실행하면 같은 API 포트(5002)를 사용할 수 없으므로 한 방식만 사용하세요.

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

## 오답 단어 테스트

`backend/sql/016_quiz_modes.sql`을 DB에 적용한 뒤 백엔드를 실행합니다.
단어장 `오답단어` 탭의 **오답 단어 테스트**에서 누적 오답 이력이 있는 단어만 기존 테스트 화면으로 학습합니다.
일반 테스트와 오답 테스트는 각각 진행 중인 세션을 이어 풉니다.

## 학습 날짜 기준

학습일·연속 학습·주간 통계·오늘의 테스트는 한국 시간(`Asia/Seoul`)의 자정을
기준으로 계산합니다. 사용자 시간대 설정은 제공하지 않습니다.
배포 전 `backend/sql/017_fixed_learning_day.sql`을 적용하면 과거 다른 시간대를
선택한 사용자의 일별 집계를 한국 시간으로 재구성합니다.

## 학습 시간 측정

백엔드 배포 전에 `backend/sql/018_learning_time.sql`을 DB에 적용합니다.
기존 `learning_activities.duration_seconds`와 분리해 활성 학습 구간을 기록합니다.
분석 결과·단어 상세·테스트(재도전 포함)·생성된 스토리에서만 측정하며,
백그라운드/포커스 이탈 시 중지합니다. 테스트 2분, 읽기 화면 3분 무활동 시
일시 정지하고 스크롤·터치·키 입력으로 재개합니다. 브라우저 정지로 발생한
5초 초과 타이머 공백은 제외합니다. 실제 집중도를 직접 측정하는 값은 아닙니다.

약 20초마다 사용자별 로컬 대기열에 저장하고 서버에 전송합니다.
오프라인 대기열은 최대 30일/10,000개 구간을 보관하며 저장 공간이 차거나
브라우저 저장소가 차단/삭제되면 미전송 기록이 유실될 수 있습니다.
서버는 이벤트 ID로 재전송을 중복 제거하고 최근 7일 조회 시 여러 탭·기기의
겹친 구간을 합쳐 한 번만 계산합니다. 활동 종류는 원본 구간에 보존합니다.
기존 학습일·활동 횟수·XP는 변경하지 않습니다.

- `POST /api/learning-time/events`: 로그인 사용자와 일치하는 사용자 ID 및 최대 100개 구간 저장
- `GET /api/learning-time/me`: 측정 시작 시각과 한국 시간 기준 최근 7일의 합산 초 조회
- 과거 서버 처리 시간/문제 응답 시간은 학습 시간으로 변환하지 않습니다.
- 학습 현황 페이지 상단에 최근 7일 시간 그래프와 오늘·7일 합계·평균을 표시합니다. 날짜를 누르면 상세 시간을 확인할 수 있으며 측정 전 날짜는 별도로 표시합니다. 화면이 열려 있는 동안 20초마다 갱신합니다.

독립 임시 PostgreSQL을 사용하는 검증:

```bash
node --import tsx --test backend/src/routes/learningTime.test.ts
```

## 학습량 그래프

학습 현황 페이지의 학습량 카드는 `GET /api/progress/activity`에서 최근 7일의
첫 답안 기록을 조회합니다. 기존 테이블을 사용하므로 추가 마이그레이션은 없습니다.
새 단어는 사용자별 보존 답안 이력의 최초 정오답 답안, 복습은 이후 답안입니다.
오답 재도전·pass/revealed 기록은 제외하고 예정일 전 연습은 복습에 포함합니다.
현재 단어 삭제 여부와 관계없이 보존된 풀이 기록을 집계합니다.
일별 단어 수와 기간 전체 단어 수는 각각 중복을 제거하므로 일별 합계가 다를 수 있습니다.
날짜를 선택하면 풀이 구성·단어 수·첫 시도 정답률을 볼 수 있습니다.

```bash
node --import tsx --test backend/src/routes/progressActivity.test.ts
```

## 첫 시도 정답률 그래프

학습 현황의 첫 시도 정답률 카드는 학습량과 같은 `/api/progress/activity` 데이터와 캐시를 사용합니다.
최근 7일의 일별 정답률을 0~100% 고정 축의 선으로 표시하며 미응시 날짜는 선을 끊습니다.
기간 정답률은 일별 비율의 평균이 아닌 전체 정답 수 / 전체 첫 답안 수로 계산합니다.
오답 재도전은 제외하며, 스와이프 테스트는 사용자가 선택한 정오답 기준입니다.
날짜를 선택하면 정답·오답 수를 확인할 수 있습니다. 추가 SQL·백엔드 변경은 없습니다.

## 학습 잔디

`GET /api/progress/calendar`에서 한국 시간 기준 오늘까지 최근 365일의
일별 활동 수·첫 답안 풀이 수·XP를 조회합니다. 기존 `user_learning_days`를
사용하며 추가 SQL 적용은 없습니다. 백엔드 재시작으로 API 변경을 반영합니다.
화면은 최근 12주(이번 주 포함, 월요일 시작)를 기본으로 표시하고 최근 1년으로
전환할 수 있습니다. 미래 날짜는 빈칸으로 표시하며, 연간 보기는 가로 스크롤을 제공합니다.
색 농도는 활동 0회 / 1~4회 / 5~14회 / 15~29회 / 30회 이상 기준입니다.
날짜를 누르면 활동 수·첫 답안 풀이 수·XP를 확인할 수 있습니다.
활동 수는 시간과 별개이며 기존 스트릭 인정 정책을 그대로 따릅니다.
검증은 `backend/src/routes/progressActivity.test.ts`에 포함됩니다.

## 그래프 확인용 임시 데이터

[생성 SQL](docs/sql/seed_learning_graph_demo.sql)을 앱 DB에서 실행한 뒤 아래 전용 계정으로
로그인하여 마이페이지 > 학습 현황을 엽니다. 기존 계정의 데이터는 변경하지 않습니다.
실제 DB에는 자동 적용하지 않으며, 이 SQL은 번호 마이그레이션에 포함하지 않습니다.

- 이메일: `graph-demo@example.test`
- 비밀번호: `GraphDemo!2026`
- 재실행: 전용 계정의 기존 학습 데이터를 초기화한 뒤 실행일 기준으로 재생성
- 삭제: [삭제 SQL](docs/sql/cleanup_learning_graph_demo.sql) 실행
- 선행 조건: 기존 앱 스키마와 `018_learning_time.sql` 적용

| 날짜 | 새 단어 문제 | 복습 문제 | 정답률 | 학습 시간 |
| --- | ---: | ---: | --- | --- |
| 6일 전 | 4 | 0 | 0% | 측정 전 |
| 5일 전 | 3 | 5 | 100% | 2분 |
| 4일 전 | 0 | 0 | 기록 없음 | 0분 |
| 3일 전 | 2 | 8 | 70% | 7분 30초 |
| 2일 전 | 1 | 3 | 50% | 15분 |
| 어제 | 0 | 6 | 50% | 1분 10초 |
| 오늘 | 5 | 5 | 90% | 3분 10초 |

최근 7일 합계는 **42문제 / 새 단어 15문제 / 복습 27문제 / 중복 제외 23단어 / 정답 29개 / 정답률 69%**입니다.
학습 시간 합계는 **28분 50초**입니다. 자정 직후 약 3분 20초 이내에 실행하면
오늘의 시간은 실제 경과 시간 이내로 줄어듭니다. 겹치는 시간 구간이 있어도 합계는 늘지 않아야 합니다.
측정 전 날짜·미응시일·0%·100%·연간 잔디 5단계 농도를 비교할 수 있습니다.
전용 계정으로 실제 학습을 수행하면 값이 달라지므로 재실행하여 초기화할 수 있습니다.

SQL 재실행·네 그래프 API 기대값·삭제 검증은 `backend/src/routes/progressActivity.test.ts`에 포함됩니다.
테스트용 이전 마이그레이션을 별도로 보관한 경우 `TEST_MIGRATION_DIR`로 해당 폴더를 지정할 수 있습니다.

### 기존 계정에 그래프 샘플 추가

`jishuya3015@naver.com` 계정에는 [계정 지정 SQL](docs/sql/seed_learning_graph_jishu.sql)을 사용합니다.
기존 단어·답안·비밀번호·설정은 유지하고 샘플 기록·XP·일별 통계를 합산합니다.
실제 영어 단어 50개가 추가되며 단어장과 테스트 출제에도 나타날 수 있습니다. 기존 단어와 중복되면 다른 실제 단어를 고릅니다.
최종 그래프는 기존 기록과 합산되므로 위 전용 계정 예상값과 다릅니다.
이미 샘플 단어가 있으면 중복 실행을 차단합니다. 전용 테스트 계정 삭제 SQL은 이 계정에 적용하지 않습니다.
전체 작업은 하나의 트랜잭션이며 실제 DB에는 수동으로 실행합니다.

## 숙련도 분포 그래프

학습 현황에 0~7단계 이름·단어 수·전체 보관 단어 중 비중을 표시합니다.
마스터 합계는 6~7단계이며, 막대를 누르면 공통 바텀시트에서 해당 단계의
단어·뜻·언어를 확인할 수 있습니다. 기존 `/api/progress/me`와 단어장 API를
재사용하므로 추가 SQL 적용이나 백엔드 재시작은 필요하지 않습니다.

## 복습 예정 그래프

학습 현황에서 오늘부터 7일간 복습 예정 단어와 어제까지 밀린 복습을 구분합니다.
현재 보관 중이며 답안 이력이 있는 단어만 포함하고 마스터도 포함합니다.
오늘 예정에는 아직 시각이 되지 않은 단어도 포함되며, 지금 복습 가능한 단어 수는
현재 시각까지 기한이 된 단어만 셉니다. 날짜·밀린 복습을 누르면 예정 시각 순으로
단어 목록을 확인할 수 있습니다. 오늘의 테스트 버튼은 기존 일반 테스트로 이동합니다.
기존 단어장 API를 재사용하므로 추가 SQL·백엔드 재시작은 필요하지 않습니다.

한국 시간 경계·미학습 단어 제외·마스터 포함 검증:

```bash
node --import tsx --test frontend/tests/reviewSchedule.test.ts
```

## 자주 틀리는 단어 TOP 5

현재 보관 중인 단어의 누적 첫 답안 통계로 오답 횟수 내림차순, 오답률 내림차순,
마지막 학습이 오래된 순으로 정렬합니다. 동일하면 단어 ID로 순서를 고정합니다.
오답 재도전은 기존 단어별 집계에서 제외되며, 응답 수와 오답률을 함께 표시합니다.
단어를 누르면 뜻·예문·기억 팁을 공통 바텀시트에서 확인합니다.
오답 단어 테스트 버튼은 기존 오답 모드로 이동하며 TOP 5뿐 아니라 전체 오답 단어가 대상입니다.
집중 학습 자동 포함·제외 정책과는 별개인 누적 통계입니다. 추가 SQL·백엔드 재시작은 필요하지 않습니다.

```bash
node --import tsx --test frontend/tests/weakWords.test.ts
```

## 오답 재학습 완료 그래프

`GET /api/progress/relearning`은 최근 7일에 첫 오답을 제출한 기본 문제를
한국 시간 날짜별로 집계합니다. 재도전 정답이 하나라도 있으면 해당 원래 문제를
완료 1건으로 계산하며 반복 재도전은 분모에 넣지 않습니다. 완료 시점은 현재 기준입니다.
진행 중인 테스트에서 보관 단어의 재도전이 대기 중이면 남은 재도전으로 분류합니다.
재도전 기록이 없는 과거 답안·삭제된 단어의 미완료 문제·중단된 테스트는
확인·재개 불가로 표시합니다. 이미 재학습을 완료한 기록은 단어 삭제 후에도 완료로 유지합니다.
같은 단어도 다른 테스트에서 틀렸으면 별도 문제로 셉니다.
일반·오답 테스트 이어하기는 해당 모드의 기존 진행 중 테스트를 여는 방식입니다.
기존 첫 시도 정답률·XP·숙련도를 변경하지 않습니다.
기존 표를 사용하므로 추가 SQL은 없지만 API 반영을 위해 백엔드 재시작이 필요합니다.
이전 그래프용 예시 SQL에는 재도전 세션이 없으므로 해당 오답은 확인·재개 불가로 표시됩니다.
검증은 `backend/src/routes/progressActivity.test.ts`에 포함됩니다.

## 전체 학습 통계 화면

학습 현황은 11개 그래프를 다음 세 탭으로 제공한다.
디자인은 학습 기록 탭의 `docs/report01.html`, 어휘와 복습 탭의 `docs/report02.html`을 기준으로 요약 카드·목표 링·기간 선택·그래프를 구성하며, 모바일·데스크톱과 다크 모드를 지원한다.

- 학습 기록: 학습 시간·학습량·첫 시도 정답률·학습 잔디·요일 패턴
- 어휘와 복습: 숙련도·복습 예정·취약 단어 TOP 5·오답 재학습·언어별 현황
- 성장: 현재 화랑이 등급 및 누적 XP 성장 곡선

주(최근 7일)·월·년·전체 기간을 선택하고 이전/다음 기간으로 이동할 수 있다.
기간별 API는 `from=YYYY-MM-DD&to=YYYY-MM-DD` 또는 `period=all`을 받는다.
미래 날짜는 오늘까지로 제한하며 62일 이하는 일별, 730일 이하는 월별, 그 이상은 연별이다.
첫 답안 집계는 기간을 자르기 전에 전체 이력에서 새 단어 여부를 판정한다.
시간 평균은 측정 시작 전 날짜를 제외하며, 월별 집계에서도 실제 측정 일수로 계산한다.
활동별 시간의 겹침은 테스트→분석→단어→스토리 순으로 한 번만 배정한다.
`GET /api/progress/insights`는 요일 패턴·활동 구성·언어별 통계·XP 성장을 제공한다.
스토리 생성 건수는 저장된 `ai_stories` 기준이며 시간·활동·실력을 혼합하지 않는다.
요일 패턴은 최근 56일 고정이다. 풀이 수는 요일별 8일 평균이고 시간은 측정 가능 일수로 나눈다.
기존 숙련도·복습 일정·잔디의 기준은 각 카드에 별도 표시한다.

추가 SQL 적용은 없으며 최신 백엔드 반영을 위해 `npm run pm2:restart`를 실행한다.
프론트엔드가 별도 호스팅 중이면 최신 프론트엔드도 배포해야 한다.

```bash
npm run build
npm run lint
node --import tsx --test frontend/tests/*.test.ts
node --import tsx --test backend/src/routes/progressActivity.test.ts backend/src/routes/learningTime.test.ts
# Google Chrome 필요. 모의 API 사용, 실제 DB 연결 없음.
node frontend/tests/learningAnalytics.browser.mjs
```

브라우저 검증은 390px/1440px 화면, 모든 탭과 기간 선택, 상세 모달, 빈 기록·오류 상태,
런타임 오류와 가로 넘침을 확인하고 임시 폴더에 PNG를 저장한다.
Chrome 경로는 `CHROME_BIN`으로 바꿀 수 있다. 임시 DB 테스트의 기존 마이그레이션이
별도 경로에 있으면 `TEST_MIGRATION_DIR`을 지정한다.

### 나머지 그래프용 추가 예시 데이터

[추가 예시 SQL](docs/sql/seed_learning_graph_remaining_jishu.sql)은 `jishuya3015@naver.com`의
기존 기록을 유지하고 실제 단어 40개를 추가합니다. 이전 예시 SQL과
별개이며 기존 예시를 다시 실행할 필요가 없습니다. 재실행은 중복 방지를 위해 차단합니다.

- 5개 언어 × 숙련도 0~7단계: 단계별 5개, 언어별 8개, 마스터 이상 총 10개 추가
- 밀린 복습·오늘·앞으로 7일과 그 이후 복습 예정일, 첫 답안 없는 단어 구분
- 누적 오답 횟수와 오답률이 다른 TOP 5 후보
- 최근 7일 첫 오답 10문제: 재학습 완료 6개·대기 최대 3개·중단 1개
- 기존 진행 중 테스트가 있는 모드는 예시 대기를 중단 상태로 넣어 기존 재개를 보호
- 최근 8주 요일별 풀이·시간·분석 활동과 5개 스토리 생성 이력
- 과거 12개월 XP 원장과 누적 XP 추가: 화랑이 레벨·등급도 실제로 변함

최종 화면 수치는 기존 기록과 합산됩니다. 생성한 행의 ID는 0 XP 원장의
`metadata.purpose = fixture-manifest`에 보관하므로 나중에 예시 행을 식별할 수 있습니다.
실행 결과의 언어별 추가 단어·세션·추가 XP와 마지막 `COMMIT`을 확인합니다.
앱이 쓰는 DB가 `hwalingo`, 로컬 포트가 `5434`인 현재 환경에서는 다음처럼 실행합니다.

```bash
sudo -u postgres psql -d hwalingo -p 5434 -v ON_ERROR_STOP=1 < docs/sql/seed_learning_graph_remaining_jishu.sql
```

실제 DB에는 자동 실행하지 않습니다. 생성 SQL 실행·중복 차단·기존 데이터 보존·진행 테스트
보호 검증은 `backend/src/routes/progressActivity.test.ts`에 포함됩니다.

### 기존 가짜 예시 단어를 실제 어휘로 교체

[보정 SQL](docs/sql/repair_learning_graph_words_jishu.sql)은 `jishuya3015@naver.com` 계정에서
이전에 넣은 `graph-preview-001` 형식의 영어 예시 50개와 `graph-extra-v1-zh-0`
형식의 숙련도 예시 40개를 실제 단어·한국어 뜻·학습언어 예문으로 교체합니다.
예: 영어 resilience, 프랑스어 apprendre, 일본어 学ぶ, 중국어 学习, 한국어 성취.
기존에 같은 단어가 있으면 후보 중 다른 실제 단어를 선택하며, 후보가 부족하면 전체 작업을 취소합니다.
단어 ID·숙련도·복습일·정오답·XP·활동·시간 기록은 유지합니다. 예시 문제와 스토리의 단어 내용도 맞춥니다.
재실행해도 이미 교체된 단어는 다시 바꾸지 않습니다. 기존 사용자가 저장한 실제 단어는 수정하지 않습니다.
새로 실행하는 계정 지정 생성 SQL 두 개도 실제 어휘를 사용하도록 수정했습니다.
기존 예시를 이미 적용했다면 생성 SQL을 다시 실행하지 말고 보정 SQL만 실행합니다.

```bash
sudo -u postgres psql -d hwalingo -p 5434 -v ON_ERROR_STOP=1 < docs/sql/repair_learning_graph_words_jishu.sql
```

마지막 `COMMIT` 확인 후 앱을 새로고침합니다. 백엔드 재시작은 필요 없습니다.
