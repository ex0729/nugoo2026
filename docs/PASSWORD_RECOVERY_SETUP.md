# 비밀번호 복구 운영 설정

## Supabase Dashboard

### URL Configuration

`Authentication → URL Configuration`에서 다음을 설정한다.

- Site URL: 실제 대표 배포 주소(예: `https://nugoo2026.vercel.app`)
- Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `https://nugoo2026.vercel.app/auth/callback`
  - 별도 운영 도메인이 있다면 `https://운영도메인/auth/callback`

미리보기 배포를 허용해야 한다면 Supabase가 지원하는 정확한 preview wildcard 패턴을 프로젝트 범위로만 추가하고, 전체 인터넷을 허용하는 광범위한 패턴은 사용하지 않는다.

### 비밀번호 재설정 이메일

`Authentication → Email Templates → Reset Password`에서 제목과 본문을 클래스플로우 문구로 설정한다. 링크는 Supabase가 제공하는 `ConfirmationURL` 변수를 사용하고 애플리케이션이 생성한 토큰이나 이메일을 본문 URL에 직접 조합하지 않는다.

2026년 6월 이후 생성된 Free 프로젝트는 기본 SMTP 사용 중 인증 메일 템플릿을 수정할 수 없다. 맞춤 템플릿과 안정적인 운영 발송을 위해 `Project Settings → Authentication → SMTP Settings`에서 자체 SMTP를 연결한다. 기본 발송기는 테스트·초기 확인 용도이며 조직 구성원 대상 제한, 낮은 발송 한도와 전달 신뢰도 제약이 있어 실제 회원 서비스에 적합하지 않다.

### 비밀번호 정책

`Authentication → Sign In / Password Security`의 최소 길이를 애플리케이션 정책과 같은 12자로 설정한다. 애플리케이션은 영문 대·소문자, 숫자, 특수문자 중 3종 이상과 취약 문구 차단을 추가 검증한다.

## 환경변수

실제 값은 저장소나 화면에 출력하지 않는다.

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

비밀번호 복구에는 `SUPABASE_SERVICE_ROLE_KEY`가 필요하지 않으며 클라이언트에 설정해서는 안 된다. `redirectTo`는 브라우저의 현재 origin과 고정 콜백 경로로 생성되므로 허용 목록에 등록된 로컬·운영 주소에서 동일하게 작동한다.

## 운영 전 확인

1. 관리자와 강사 각각의 실제 가입 이메일로 복구 메일을 요청한다.
2. 발신자명, 스팸 분류, 링크 도메인과 만료 동작을 확인한다.
3. 링크가 `/auth/callback`을 거쳐 `/update-password`로 이동하는지 확인한다.
4. 변경 후 기존 세션이 로그아웃되고 새 비밀번호로만 다시 로그인되는지 확인한다.

