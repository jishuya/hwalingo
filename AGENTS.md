# Hwalingo 프로젝트 가이드

## 프로젝트 소개

Hwalingo는 영어 문장 분석과 단어 복습을 돕는 웹 애플리케이션이다. 문장 분석, 단어장, 퀴즈, 스토리텔링 학습 기능을 제공하며 모든 화면은 반응형 디자인으로 개발한다.

## 기술 및 구조

- 프론트엔드: React, TypeScript, Vite, PWA
- 백엔드: Express, TypeScript, PostgreSQL
- 상태 및 데이터: TanStack Query, Zustand, Dexie
- `frontend/src/pages`: 페이지 컴포넌트
- `frontend/src/components`: 공통 UI
- `backend/src`: API와 데이터베이스
- `docs`: 초기 HTML 화면 시안

주요 경로는 `/study`, `/analysis`, `/vocabulary`, `/quiz`, `/story`, `/profile`, `/login`이다. 데스크톱은 상단, 모바일은 하단 내비게이션을 사용한다.

## 디자인

- 대표 색상: `#008C44`, `#FFD95A`, `#18332A`, `#F7F7F2`
- 아이콘 라이브러리: **Phosphor Icons**
- 밝은 배경, 둥근 카드, 충분한 여백과 절제된 그림자를 사용한다.
- 모든 화면은 데스크톱, 태블릿, 모바일에 대응하는 반응형 디자인으로 개발한다.

### 타이포그래피

정보 밀도가 높은 학습 화면을 고려해 기본 본문은 `15px`을 기준으로 한다. 폼 입력값은 모바일 Safari 자동 확대 방지를 위해 `16px`을 유지하고, 다음 크기 체계를 사용한다.

| 토큰 | 크기 | 주요 용도 |
| --- | ---: | --- |
| `--font-xs` | `11px` | 캡션, 메타데이터, 난이도 배지, 아주 작은 보조 정보 |
| `--font-sm` | `13px` | 입력 라벨, 보조 설명, 옵션, 링크, 카드 세부 내용 |
| `--font-md` | `15px` | 기본 본문, 버튼 문구, 주요 학습 내용 |
| `--font-lg` | `17px` | 카드 및 섹션 제목 |
| `--font-xl` | `22px` | 페이지 및 모달 제목 |
| `--font-2xl` | `28px` | 주요 강조 제목 |

- 본문 줄 높이는 폰트 크기의 `1.45~1.6배`, 제목은 `1.2~1.35배`를 사용한다.
- 모바일의 일반 본문은 중요도에 따라 `14~15px`을 사용한다. 입력값만 모바일 Safari 자동 확대 방지를 위해 `16px` 미만으로 설정하지 않는다.
- 버튼 문구는 `13~15px`, 입력 라벨과 옵션은 `12~13px`, 모바일 내비게이션은 `11px`을 기준으로 사용한다.
- `11px`은 캡션, 배지, 메타데이터 같은 보조 정보에만 사용하고 핵심 학습 내용에는 사용하지 않는다.
- 화면 너비에 따라 제목 크기는 조절할 수 있지만 본문과 입력값의 가독성을 우선한다.

### 공통 Dialog

- 안내, 확인, 상세 설정에는 `frontend/src/components/ui/Dialog.tsx`의 `AlertDialog`, `ConfirmDialog`, `Modal` 공통 컴포넌트를 사용한다.
- `AlertDialog`의 디자인 기준은 `docs/alert.html`이다.
- `ConfirmDialog`의 디자인 기준은 `docs/confirm.html`이다.
- `Modal`의 디자인 기준은 `docs/modal.html`이며 화면 하단에서 올라오는 바텀시트 형태로 사용한다.
- 세 컴포넌트는 공통 타이포그래피 토큰을 사용한다. 제목은 `--font-xl`(`22px`), 설명과 버튼은 `--font-sm`(`13px`)을 적용하되 나머지 시각 디자인은 각 `docs` 시안을 따른다.
- 페이지마다 별도의 Alert, Confirm, Modal 스타일을 만들지 말고 공통 컴포넌트를 재사용한다.

## 개발 원칙

- TypeScript 타입을 명확히 작성한다.
- 기존 컴포넌트와 디자인 패턴을 우선 재사용한다.
- 페이지는 `pages`, 재사용 UI는 `components`에 작성한다.
- API 경로는 `/api` 아래에 작성한다.
- 아이콘은 Phosphor Icons를 사용하고 아이콘 버튼에는 `aria-label`을 제공한다.

## 명령어

```bash
npm run dev
npm run lint
npm run build
```
