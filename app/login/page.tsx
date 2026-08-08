"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";

const ADMIN_EMAIL = "nugoona2021@naver.com";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSigningIn(true);
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password,
    });

    if (error) {
      setSigningIn(false);
      setMessage("이메일 또는 비밀번호가 올바르지 않습니다.");
      return;
    }

    window.location.assign("/");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="brand-mark">C</span>
        <p className="section-kicker">CLASSFLOW ADMIN</p>
        <h1>운영센터 로그인</h1>
        <p>최고관리자 계정의 비밀번호로 로그인합니다. 별도의 이메일 인증은 필요하지 않습니다.</p>
        <form onSubmit={submit}>
          <label>
            관리자 이메일
            <input type="email" value={ADMIN_EMAIL} autoComplete="username" readOnly aria-readonly="true" />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              minLength={8}
            />
          </label>
          <button className="button primary" disabled={signingIn}>
            {signingIn ? "로그인 중…" : "로그인"}
          </button>
        </form>
        {message && <p className="auth-message error" role="alert">{message}</p>}
        <small>승인된 최고관리자 계정만 운영 화면에 접근할 수 있습니다.</small>
        <Link className="instructor-entry-link" href="/instructor/login">강사 로그인으로 이동 →</Link>
      </section>
    </main>
  );
}
