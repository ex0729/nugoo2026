# 화면과 경로

## 현재 프로토타입

- `/`: 관리자 앱과 강사 모바일 미리보기를 전환하는 단일 인터랙티브 프로토타입
- 관리자 수업 화면은 실제 Supabase 수업의 `classId`를 기준으로 상세 → 강사 모집 → 응답 현황 → 최종 배정 단계를 연결한다.
- `/instructor/dashboard`: 실제 모집 요청을 역할별로 확인하고 가능·조건부 가능·불가능으로 응답한다.

## 상용 라우팅 목표

- `/login`, `/signup`, `/pending`
- `/admin`: 관리자 홈
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
