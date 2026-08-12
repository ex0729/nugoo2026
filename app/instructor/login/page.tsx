"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";
import InstructorAuthShell from "../InstructorAuthShell";

export default function InstructorLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSigningIn(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });

    if (error) {
      setSigningIn(false);
      setMessage("이메일 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    window.location.assign("/instructor");
  }

  return (
    <InstructorAuthShell mode="login" title="강사 로그인" description="등록한 이메일과 비밀번호로 강사센터에 로그인하세요.">
      <form className="instructor-auth-form" onSubmit={submit}>
        <label>이메일<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" placeholder="name@example.com" required /></label>
        <label><span className="auth-label-row"><span>비밀번호</span><Link href="/forgot-password?source=instructor">비밀번호를 잊으셨나요?</Link></span><span className="password-input-wrap"><input type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" placeholder="비밀번호를 입력하세요" required /><button type="button" className="password-visibility" aria-label={showPassword ? "비밀번호 감추기" : "비밀번호 보기"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? "감추기" : "보기"}</button></span></label>
        <button className="button primary" disabled={signingIn}>{signingIn ? "로그인 중…" : "로그인"}</button>
      </form>
      {message && <p className="auth-message error" role="alert">{message}</p>}
    </InstructorAuthShell>
  );
}
