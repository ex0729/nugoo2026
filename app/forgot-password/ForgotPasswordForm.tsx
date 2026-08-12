"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { PasswordRecoveryEntry, passwordRecoveryLoginPath } from "../../lib/password-recovery";

const RESULT_MESSAGE =
  "입력하신 이메일이 가입되어 있다면 재설정 링크를 보내드렸습니다. 메일이 보이지 않으면 스팸함을 확인해 주세요.";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_SECONDS = 30;

export default function ForgotPasswordForm({ entry }: { entry: PasswordRecoveryEntry }) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setEmailError("올바른 이메일 주소를 입력해 주세요.");
      setSent(false);
      return;
    }

    if (sending || cooldown > 0) return;
    setEmailError("");
    setSending(true);

    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", "/update-password");
      callbackUrl.searchParams.set("flow", "password_recovery");
      callbackUrl.searchParams.set("source", entry);

      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: callbackUrl.toString(),
      });
    } finally {
      // 계정 존재 여부와 Supabase의 상세 응답을 노출하지 않는다.
      setSending(false);
      setSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }

  const loginPath = passwordRecoveryLoginPath(entry);

  return (
    <main className="auth-page">
      <section className="auth-card recovery-card" aria-labelledby="forgot-password-title">
        <span className="brand-mark" aria-hidden="true">C</span>
        <p className="section-kicker">CLASSFLOW ACCOUNT</p>
        <h1 id="forgot-password-title">비밀번호 찾기</h1>
        <p>가입한 이메일로 안전한 비밀번호 재설정 링크를 보내드립니다.</p>

        <form onSubmit={submit} noValidate>
          <label htmlFor="recovery-email">이메일</label>
          <input
            id="recovery-email"
            type="email"
            value={email}
            onChange={event => {
              setEmail(event.target.value);
              if (emailError) setEmailError("");
            }}
            autoComplete="email"
            inputMode="email"
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? "recovery-email-error" : undefined}
            placeholder="name@example.com"
            required
          />
          {emailError && <p id="recovery-email-error" className="field-error" role="alert">{emailError}</p>}
          <button className="button primary" disabled={sending || cooldown > 0}>
            {sending ? "전송 중…" : cooldown > 0 ? `${cooldown}초 후 재전송` : sent ? "재설정 링크 다시 보내기" : "재설정 링크 보내기"}
          </button>
        </form>

        {sent && <p className="auth-message" role="status" aria-live="polite">{RESULT_MESSAGE}</p>}
        <Link className="auth-back-link" href={loginPath}>← {entry === "instructor" ? "강사" : "운영센터"} 로그인으로 돌아가기</Link>
      </section>
    </main>
  );
}

