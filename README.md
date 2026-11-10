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
