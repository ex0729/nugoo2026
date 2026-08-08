# 클래스플로우

소규모 교육업체를 위한 강사 출강 요청·응답·배정 운영 플랫폼입니다.

운영 인증·데이터는 Supabase, 애플리케이션 배포는 Vercel을 사용합니다. 최고관리자는 사전 생성된 이메일·비밀번호 계정으로 로그인합니다.

## 현재 제공하는 프로토타입

- 관리자 홈과 즉시 조치 업무
- 수업 목록, 검색, 상태 필터
- 역할별 필요 인원과 수업료를 포함한 수업 등록
- 주강사·보조강사 후보 응답 현황
- 조건부 응답과 일정 충돌 경고
- 최종 배정 후보 선택
- 주간 일정, 강사 관리, 회원 승인, 알림 이력
- 모바일 강사 응답과 완료 흐름

## 실행

```bash
pnpm install
pnpm dev
```

## 검증

```bash
pnpm build        # Vercel용 Next.js 빌드
pnpm build:sites  # Sites용 Vinext 빌드
pnpm lint
pnpm test
```

## 환경변수

`.env.example`을 기준으로 `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 설정합니다. 비밀키나 서비스 역할 키는 브라우저 환경변수에 넣지 않습니다.

제품 요구사항은 `prd(1).md`, 현재 구현 상태와 다음 작업은 `docs/CURRENT_STATE.md`를 확인하세요.
