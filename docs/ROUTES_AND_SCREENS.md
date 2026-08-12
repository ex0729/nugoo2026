# 화면과 경로

## 현재 서비스 라우팅

- `/`: 운영센터와 강사 모두를 대상으로 하는 공개 랜딩. 활성 세션에는 역할별 센터 이동 버튼을 표시한다.
- `/start`: 익명 사용자의 운영센터·강사센터 선택 화면. 활성 세션은 역할별 대시보드로 즉시 이동한다.
- `/operations`: 최고관리자·운영관리자 전용 운영 대시보드
- `/login`: 운영센터 로그인
- `/instructor/login`, `/instructor/signup`: 강사 로그인·회원가입
- `/forgot-password`: 운영센터·강사 공용 비밀번호 재설정 메일 요청
- `/auth/callback`: PKCE 인증 코드 교환. 허용된 내부 경로만 이동하며 복구 흐름은 `/update-password`로 연결한다.
- `/update-password`: 유효한 복구 세션에서만 새 비밀번호 저장
- 관리자 수업 화면은 실제 Supabase 수업의 `classId`를 기준으로 상세 → 강사 모집 → 응답 현황 → 최종 배정 단계를 연결한다.
- `/instructor/dashboard`: 실제 모집 요청을 역할별로 확인하고 가능·조건부 가능·불가능으로 응답한다.

## 상용 라우팅 목표

- `/login`, `/signup`, `/pending`
- `/operations`: 현재 통합 관리자 홈·수업·배정·일정·강사·승인·알림 화면
- `/admin/classes`, `/admin/classes/new`, `/admin/classes/:id`
- `/admin/classes/:id/recipients`, `/responses`, `/assignment`
- `/admin/schedule`, `/admin/instructors`, `/admin/instructors/:id`
- `/admin/approvals`, `/admin/notifications`, `/admin/settings`
- `/respond/:token`: 강사 보안 응답
- `/instructor/schedule`, `/instructor/requests/:id`

## 권한

- 최고 관리자: 모든 관리자 경로
- 운영 관리자: 설정과 최고 관리자 권한 이관을 제외한 운영 경로
- 강사: 자신의 응답 링크, 요청 결과, 확정 일정
