"use client";

import { FormEvent, useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    });

    setSending(false);
    setMessage(error ? "로그인 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요." : "로그인 링크를 보냈습니다. 이메일을 확인해 주세요.");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="brand-mark">C</span>
        <p className="section-kicker">CLASSFLOW ADMIN</p>
        <h1>운영센터 로그인</h1>
        <p>등록된 관리자 이메일로 안전한 일회용 로그인 링크를 보내드립니다.</p>
        <form onSubmit={submit}>
          <label>
            관리자 이메일
            <input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required placeholder="admin@example.com" />
          </label>
          <button className="button primary" disabled={sending}>{sending ? "전송 중…" : "로그인 링크 받기"}</button>
        </form>
        {message && <p className="auth-message" role="status">{message}</p>}
        <small>승인되지 않은 계정은 운영 화면에 접근할 수 없습니다.</small>
      </section>
    </main>
  );
}
