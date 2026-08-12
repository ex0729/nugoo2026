"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";
import { passwordPolicyError } from "../../lib/password-policy";

export default function AdminInviteForm({ email, token }: { email: string; token: string }) {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    if (!email || !token) { setError("유효하지 않은 관리자 초대 링크입니다."); return; }
    const policyError = passwordPolicyError(password);
    if (policyError) { setError(policyError); return; }
    if (password !== passwordConfirm) { setError("비밀번호가 서로 일치하지 않습니다."); return; }
    setSubmitting(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
        data: { full_name: fullName.trim(), admin_invitation_token: token },
      },
    });
    setSubmitting(false);
    if (signUpError) { setError("초대를 수락하지 못했습니다. 링크 만료 여부를 확인해 주세요."); return; }
    if (data.session) { window.location.assign("/"); return; }
    setMessage("관리자 계정을 만들었습니다. 이메일 확인 후 운영센터에 로그인해 주세요.");
  }

  return <main className="auth-page"><section className="auth-card admin-invite-card"><span className="brand-mark">C</span><p className="section-kicker">ADMIN INVITATION</p><h1>운영 관리자 초대</h1><p>초대받은 이메일로 운영 관리자 계정을 만듭니다. 링크는 발급 후 7일 동안 사용할 수 있습니다.</p>{!message ? <form onSubmit={submit}><label>이름<input value={fullName} onChange={event => setFullName(event.target.value)} autoComplete="name" required minLength={2} /></label><label>초대 이메일<input type="email" value={email} readOnly aria-readonly="true" /></label><label>비밀번호<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={12} required placeholder="12자 이상" /></label><label>비밀번호 확인<input type="password" value={passwordConfirm} onChange={event => setPasswordConfirm(event.target.value)} autoComplete="new-password" minLength={12} required /></label><button className="button primary" disabled={submitting}>{submitting ? "계정 생성 중…" : "운영 관리자로 가입"}</button></form> : <div className="auth-message">{message}</div>}{error && <p className="auth-message error" role="alert">{error}</p>}<Link className="instructor-entry-link" href="/login">운영센터 로그인으로 이동 →</Link></section></main>;
}
