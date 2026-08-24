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

기본 본문과 폼 입력값은 `16px`을 기준으로 하고, 다음 크기 체계를 사용한다.

| 토큰 | 크기 | 주요 용도 |
| --- | ---: | --- |
| `--font-xs` | `12px` | 캡션, 메타데이터, 아주 작은 보조 정보 |
| `--font-sm` | `14px` | 입력 라벨, 보조 설명, 옵션, 링크 |
| `--font-md` | `16px` | 기본 본문, 입력값, 버튼 문구 |
| `--font-lg` | `18px` | 카드 및 섹션 제목 |
| `--font-xl` | `24px` | 페이지 및 모달 제목 |
| `--font-2xl` | `32px` | 주요 강조 제목 |

- 본문 줄 높이는 폰트 크기의 `1.5~1.7배`, 제목은 `1.2~1.35배`를 사용한다.
- 모바일의 본문과 입력값은 `16px` 이상으로 작성한다. 모바일 Safari의 입력 시 자동 확대를 방지하기 위해 입력값을 `16px` 미만으로 설정하지 않는다.
- 버튼 문구는 `14~16px`, 입력 라벨과 옵션은 `13~14px`, 모바일 내비게이션은 `11~12px` 범위에서 사용한다.
- `11px` 이하 글자는 저작권이나 중요도가 낮은 보조 정보에만 제한적으로 사용한다.
- 화면 너비에 따라 제목 크기는 조절할 수 있지만 본문과 입력값의 가독성을 우선한다.

### 공통 Dialog

- 안내, 확인, 상세 설정에는 `frontend/src/components/ui/Dialog.tsx`의 `AlertDialog`, `ConfirmDialog`, `Modal` 공통 컴포넌트를 사용한다.
- `AlertDialog`의 디자인 기준은 `docs/alert.html`이다.
- `ConfirmDialog`의 디자인 기준은 `docs/confirm.html`이다.
- `Modal`의 디자인 기준은 `docs/modal.html`이며 화면 하단에서 올라오는 바텀시트 형태로 사용한다.
- 세 컴포넌트에서는 일반 타이포그래피 토큰보다 각 `docs` 시안의 제목 `20px`, 설명 `14px`, 버튼 `14px` 기준을 우선한다.
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
