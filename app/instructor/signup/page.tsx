"use client";

import { FormEvent, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import InstructorAuthShell from "../InstructorAuthShell";

export default function InstructorSignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [signingUp, setSigningUp] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");
    if (password !== passwordConfirm) {
      setErrorMessage("비밀번호가 서로 일치하지 않습니다.");
      return;
    }

    setSigningUp(true);
    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback?next=/instructor`,
        data: { full_name: fullName.trim(), role: "instructor" },
      },
    });

    setSigningUp(false);
    if (error) {
      setErrorMessage(error.message.includes("already registered") ? "이미 가입된 이메일입니다." : "회원가입을 완료하지 못했습니다. 입력 내용을 확인해 주세요.");
      return;
    }
    if (data.session) {
      window.location.assign("/instructor");
      return;
    }
    setMessage("인증 메일을 보냈습니다. 이메일 인증 후 관리자 승인을 기다려 주세요.");
  }

  return (
    <InstructorAuthShell mode="signup" title="강사 회원가입" description="기본 정보를 등록하면 담당자 확인 후 강사 활동을 시작할 수 있습니다.">
      <form className="instructor-auth-form" onSubmit={submit}>
        <label>이름<input type="text" value={fullName} onChange={event => setFullName(event.target.value)} autoComplete="name" placeholder="실명을 입력하세요" minLength={2} required /></label>
        <label>이메일<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" placeholder="name@example.com" required /></label>
        <div className="instructor-auth-form-grid">
          <label>비밀번호<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" placeholder="8자 이상" minLength={8} required /></label>
          <label>비밀번호 확인<input type="password" value={passwordConfirm} onChange={event => setPasswordConfirm(event.target.value)} autoComplete="new-password" placeholder="한 번 더 입력" minLength={8} required /></label>
        </div>
        <label className="instructor-auth-consent"><input type="checkbox" required /><span>개인정보 수집 및 서비스 이용에 동의합니다.</span></label>
        <button className="button primary" disabled={signingUp}>{signingUp ? "가입 처리 중…" : "강사로 가입하기"}</button>
      </form>
      {message && <p className="auth-message" role="status">{message}</p>}
      {errorMessage && <p className="auth-message error" role="alert">{errorMessage}</p>}
    </InstructorAuthShell>
  );
}
