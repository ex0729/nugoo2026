# 도메인 모델

## 주요 엔티티

- Company: 교육업체
- User: 회원, 역할, 승인 상태, 소속 상태
- InstructorProfile: 과목, 학년, 활동 지역
- Institution / Contact: 기관과 담당자
- Class: 수업, 일정, 장소, 필요 인원, 역할별 수업료
- AssignmentRequest: 마감, 발송 상태, 요청 버전
- RequestRecipient: 강사와 모집 역할
- InstructorResponse: 역할별 응답, 조건, 최종 응답 시각
- ResponseHistory: 변경 전·후 응답
- Assignment: 최종 역할, 배정 당시 수업료 스냅샷
- ConfirmedSchedule: 확정 일정
- NotificationDelivery: 알림 유형, 공급자 키, 성공·실패
- AuditLog: 관리자 작업과 변경 이력

## 핵심 값

- InstructorRole: `LEAD`, `ASSISTANT`
- RequestedRole: `LEAD`, `ASSISTANT`, `BOTH`
- ResponseStatus: `AVAILABLE`, `CONDITIONAL`, `UNAVAILABLE`, `PENDING`
- ClassStatus: `DRAFT`, `READY`, `WAITING`, `NEEDS_ASSIGNMENT`, `ASSIGNED`, `CANCELLED`

## 무결성 규칙

- `leadRequiredCount = 1`
- `assistantRequiredCount`는 0~2
- 확정 Assignment 총합은 1~3
- 같은 `classId + instructorId`는 하나의 활성 Assignment만 허용
- 역할별 가능 또는 조건부 가능 응답이 있어야 해당 역할로 배정 가능
- 조건부 가능 응답의 `condition`은 공백이 아닌 값
- 보조강사가 필요하면 `assistantFee` 필수
- Assignment는 `feeSnapshot`을 저장해 이후 수업료 변경과 분리
- 시간 구간 충돌은 `startA < endB && startB < endA`

## 상태 전이

```text
작성 중 → 배정 요청 전 → 응답 대기 → 배정 필요 → 배정 완료
   └────────────── 수업 취소 ──────────────┘
```

