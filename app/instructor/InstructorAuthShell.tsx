import Link from "next/link";
import type { ReactNode } from "react";

type InstructorAuthShellProps = {
  mode: "login" | "signup";
  title: string;
  description: string;
  children: ReactNode;
};

export default function InstructorAuthShell({ mode, title, description, children }: InstructorAuthShellProps) {
  return (
    <main className="instructor-auth-page">
      <section className="instructor-auth-aside">
        <Link className="instructor-auth-brand" href="/instructor/login" aria-label="클래스플로우 강사센터">
          <span className="brand-mark">C</span>
          <span>클래스플로우<small>INSTRUCTOR</small></span>
        </Link>
        <div>
          <span className="instructor-auth-chip">강사 전용</span>
          <h1>수업 요청부터<br />일정 확인까지 한곳에서</h1>
          <p>나에게 맞는 수업을 확인하고, 주강사·보조강사 역할별 조건에 빠르게 응답하세요.</p>
          <ul>
            <li><span>✓</span> 역할별 수업료와 수업 정보 확인</li>
            <li><span>✓</span> 가능한 일정에 빠르게 응답</li>
            <li><span>✓</span> 확정 수업과 진행 상태 관리</li>
          </ul>
        </div>
        <small>누구나코딩교육 강사 운영 서비스</small>
      </section>

      <section className="instructor-auth-main">
        <div className="instructor-auth-card">
          <div className="instructor-auth-mobile-brand"><span className="brand-mark">C</span> 클래스플로우</div>
          <p className="section-kicker">INSTRUCTOR CENTER</p>
          <h2>{title}</h2>
          <p className="instructor-auth-description">{description}</p>
          {children}
          <p className="instructor-auth-switch">
            {mode === "login" ? "아직 강사 계정이 없으신가요?" : "이미 강사 계정이 있으신가요?"}
            <Link href={mode === "login" ? "/instructor/signup" : "/instructor/login"}>
              {mode === "login" ? "회원가입" : "로그인"}
            </Link>
          </p>
          <Link className="instructor-admin-link" href="/login">운영센터 관리자 로그인</Link>
        </div>
      </section>
    </main>
  );
}
