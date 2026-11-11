# Hwalingo

React·TypeScript·Vite PWA와 Express·PostgreSQL로 구성된 언어 학습 앱이다.
개발 규칙과 기능 정책은 [PROJECT_GUIDE.md](PROJECT_GUIDE.md)에서 관리한다.

## 개발 실행

저장소 루트에서 의존성을 설치한다.

```bash
npm ci
cp backend/.env.example backend/.env
```

`backend/.env`에 DB 연결 정보, `JWT_SECRET`, 사용할 AI·OCR·SMTP 인증 정보를 설정한다.
환경 변수 목록과 예시는 [backend/.env.example](backend/.env.example)을 참고한다.

로컬 PostgreSQL 컨테이너는 다음 명령으로 시작한다. 기본 포트는 `5434`다.

```bash
docker compose up -d postgres
```

**DB 스키마와 테스트 SQL:** [docs/db.sql](docs/db.sql)은 테스트용 기준 스키마이고,
[backend/sql](backend/sql)은 변경 이력을 담은 마이그레이션이다.
[docs/sql](docs/sql)의 학습 그래프 시드·정리 SQL은 통합 테스트의 데이터 검증에도 사용한다.
이 파일들은 DB 통합 테스트에 필요하므로 보존한다. 파일 복원만으로 앱 DB가 변경되지는 않는다.

기존 앱 DB에는 적용 이력과 스키마를 확인한 뒤 필요한 변경만 적용한다.
`docs/db.sql`에는 일부 과거 변경이 이미 반영되어 있으므로 전체 마이그레이션을
무조건 순서대로 재실행하면 안 된다. 특히 `007`은 과거 즐겨찾기 구조를 전제로 하며,
`013`·`017`과 `docs/sql`에는 데이터 변경이 포함된다. 테스트 SQL 목록은 각 테스트가 관리한다.

```bash
npm run dev
```

- 프론트엔드: `http://localhost:5173`
- 백엔드: `http://localhost:5002`, 상태 확인: `/api/health`
- Vite가 `/api` 요청을 로컬 백엔드로 전달한다.
- 개별 실행: `npm run dev:frontend`, `npm run dev:backend`

## 검증

```bash
npm run lint
npm run build
node --import tsx --test frontend/tests/*.test.ts
node --import tsx --test backend/src/domain/learning/*.test.ts backend/src/config/*.test.ts backend/src/services/*.test.ts
```

학습 리포트와 오답 집중 연습의 브라우저 검사는 빌드된 프론트엔드와 모의 API를 사용한다.
앱 DB에 연결하지 않으며 임시 로컬 서버와 Chrome을 실행할 수 있어야 한다.
기본 Chrome 경로는 `/usr/bin/google-chrome`이며 `CHROME_BIN`으로 변경할 수 있다.
성공 시 스크린샷 디렉터리와 검사 결과를 출력한다.

```bash
node frontend/tests/learningAnalytics.browser.mjs
```

API와 DB 통합 테스트는 다음 명령으로 실행한다.
DB 테스트는 임시 PostgreSQL 클러스터를 생성·삭제하며 앱 DB에는 연결하지 않는다.
로컬 서버와 임시 DB를 실행할 수 있는 환경이 필요하다.
PostgreSQL 실행 파일의 기본 위치는 `/usr/lib/postgresql/16/bin`이며 `PG_BINDIR`로 변경할 수 있다.
일부 테스트는 `TEST_MIGRATION_DIR`로 마이그레이션 디렉터리를 변경할 수 있다.
SQL 파일 누락은 테스트 실패로 처리하며 자동으로 제외하지 않는다.

```bash
JWT_SECRET=local-integration-test node --import tsx --test backend/src/routes/*.test.ts
```

핵심 어휘 예문 언어 검증만 확인할 때는 다음 명령을 사용한다.
정책은 [프로젝트 가이드](PROJECT_GUIDE.md#ai-문장-분석-언어-정책)를 참고한다.

```bash
node --import tsx --test backend/src/services/vocabularyLanguage.test.ts backend/src/services/sentenceVocabularyLanguages.test.ts
```

## 운영 및 배포

- `npm start`: 백엔드 `prestart`가 최신 소스를 빌드한 뒤 `backend/dist/server.js`를 실행한다.
- `npm run pm2:start`: [ecosystem.config.cjs](ecosystem.config.cjs)로 백엔드와 터널을 시작한다. 시작 전에 `npm run build -w backend`로 빌드한다.
- `npm run pm2:restart`: 백엔드를 빌드한 뒤 PM2 프로세스를 갱신한다. `pm2 restart`만 실행하면 소스 변경이 빌드에 반영되지 않는다.
- `npm run pm2:stop`: 백엔드 프로세스를 중지한다.
- 프론트엔드: [netlify.toml](netlify.toml)의 빌드 명령은 `npm run build -w frontend`, 게시 디렉터리는 `frontend/dist`다. `/api/*` 프록시와 SPA 경로 재작성도 이 파일에서 관리한다.
- 터널 설정: [deploy/cloudflared-hwalingo.yml](deploy/cloudflared-hwalingo.yml). 운영 서버에 cloudflared와 해당 인증 파일이 필요하다.

스토리 제목 번역 누락 등 최신 응답 필드 관련 오류가 나면 실행 중인 백엔드에 최신 빌드가 반영됐는지 확인한다.
핵심 어휘 예문 언어 검증 변경은 백엔드 재시작으로 반영하며, 해당 검증 자체를 위한 추가 SQL은 없다.

## 비동기 문장 분석

기본 문장 분석은 `POST /api/analysis`에서 HTTP 202와 `job.id`를 즉시 반환한다.
프론트엔드는 `GET /api/analysis/jobs/:id`를 2초 간격으로 조회하며,
`GET /api/analysis/jobs/latest`로 로그인한 사용자의 최근 작업을 복원한다.
다른 사용자의 작업은 조회할 수 없다. 이전 프론트엔드의 동기 응답 형식과 호환되지 않으므로
백엔드와 프론트엔드를 함께 반영한다.

기존 DB에는 **백엔드 재시작 전에** 다음 마이그레이션만 적용한다.
인증 정보는 기존 DB 접속 방식을 사용한다. `docs/db.sql` 전체를 운영 DB에 실행하지 않는다.

```bash
psql -v ON_ERROR_STOP=1 -f backend/sql/020_sentence_analysis_jobs.sql
```

`npm start`, 개발 서버, PM2 백엔드 프로세스가 내부 작업자를 함께 실행하므로 별도 큐 서비스는 필요 없다.
PostgreSQL 세션 잠금으로 전체 백엔드에서 기본 분석은 한 번에 하나씩 실행하고,
사용자별 대기·실행 중 작업은 하나로 제한한다. 동일 요청 재전송은 기존 작업 ID를 반환하며,
다른 요청은 진행 중 작업을 먼저 확인하도록 HTTP 409를 반환한다.
대기 작업이 많으면 결과 대기 시간도 늘어나므로 사용자 증가 시 작업자 병렬화가 필요하다.

분석 중 화면을 닫아도 서버 작업은 계속된다. 다시 문장 분석 화면을 열어
**이전 분석 이어보기**를 누르면 진행 중 작업이나 완료 결과를 확인할 수 있다.
학습 활동과 결과 저장은 하나의 트랜잭션으로 완료하며, AI 처리 대기 시간을 학습 시간으로 기록하지 않는다.
재시작 시 중단된 작업은 복구하고 반복 중단은 최대 3회 실행 후 실패로 처리한다.
AI 작업에는 전체 120초 제한이 있으며, 일반 AI 실패는 자동 재실행하지 않고 사용자에게 재시도를 안내한다.
프로세스 중단 시 이미 전송한 외부 AI 요청의 과금까지 취소되는 것은 아니다.
완료·실패 작업의 입력과 결과는 7일 후 작업자의 시간별 정리에서 삭제하며, 계정 삭제 시에도 삭제한다.
상세 어휘와 패러프레이징 API는 기존 요청 방식을 유지한다.

검증은 앱 DB와 실제 AI를 사용하지 않는 다음 테스트로 실행한다.

```bash
node --import tsx --test backend/src/routes/analysisJobs.test.ts frontend/tests/analysisJobs.test.ts
```
