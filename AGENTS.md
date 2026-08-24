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
