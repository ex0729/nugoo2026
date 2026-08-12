"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { passwordPolicyError } from "../../lib/password-policy";
import { createClient } from "../../lib/supabase/client";
import { PasswordRecoveryEntry, passwordRecoveryLoginPath } from "../../lib/password-recovery";

const INVALID_LINK_MESSAGE =
  "재설정 링크가 만료되었거나 올바르지 않습니다. 비밀번호 재설정 메일을 다시 요청해 주세요.";

type UpdatePasswordFormProps = {
  entry: PasswordRecoveryEntry;
  initialRecoverySession: boolean;
};

export default function UpdatePasswordForm({ entry, initialRecoverySession }: UpdatePasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [recoveryValid, setRecoveryValid] = useState(initialRecoverySession);
  const [checking, setChecking] = useState(initialRecoverySession);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!initialRecoverySession) return;
    let active = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      const valid = !error && Boolean(data.user);
      setRecoveryValid(valid);
      setChecking(false);
      if (!valid) setMessage(INVALID_LINK_MESSAGE);
    });
    return () => { active = false; };
  }, [initialRecoverySession]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !recoveryValid) return;

    const policyMessage = passwordPolicyError(password);
    if (policyMessage) {
      setMessage(policyMessage);
      return;
    }
    if (password !== confirmation) {
      setMessage("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }

    setSaving(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setSaving(false);
      setMessage("비밀번호를 변경하지 못했습니다. 재설정 메일을 다시 요청해 주세요.");
      return;
    }

    await fetch("/auth/recovery/complete", { method: "POST" }).catch(() => undefined);
    await supabase.auth.signOut({ scope: "global" });
    setPassword("");
    setConfirmation("");
    setSaving(false);
    setSuccess(true);
  }

  const loginPath = passwordRecoveryLoginPath(entry);
  const forgotPath = `/forgot-password?source=${entry}`;
  const invalid = !initialRecoverySession || (!checking && !recoveryValid);

  return (
    <main className="auth-page">
      <section className="auth-card recovery-card" aria-labelledby="update-password-title">
        <span className="brand-mark" aria-hidden="true">C</span>
        <p className="section-kicker">CLASSFLOW ACCOUNT</p>
        <h1 id="update-password-title">새 비밀번호 설정</h1>

        {success ? (
          <div className="recovery-result" role="status" aria-live="polite">
            <p className="auth-message success">비밀번호가 변경되었습니다.<br />새 비밀번호로 로그인해 주세요.</p>
            <Link className="button primary" href={loginPath}>{entry === "instructor" ? "강사" : "운영센터"} 로그인</Link>
          </div>
        ) : invalid ? (
          <div className="recovery-result">
            <p className="auth-message error" role="alert">{INVALID_LINK_MESSAGE}</p>
            <Link className="button primary" href={forgotPath}>재설정 메일 다시 요청하기</Link>
            <Link className="auth-back-link" href={loginPath}>← 로그인으로 돌아가기</Link>
          </div>
        ) : (
          <>
            <p>12자 이상, 영문 대·소문자·숫자·특수문자 중 3종 이상을 조합해 주세요.</p>
            <form onSubmit={submit}>
              <label htmlFor="new-password">새 비밀번호</label>
              <span className="password-input-wrap">
                <input id="new-password" type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={12} aria-describedby="password-policy" required />
                <button type="button" className="password-visibility" aria-label={showPassword ? "새 비밀번호 감추기" : "새 비밀번호 보기"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? "감추기" : "보기"}</button>
              </span>
              <span id="password-policy" className="field-hint">쉽게 추측할 수 있는 문구는 사용할 수 없습니다.</span>

              <label htmlFor="new-password-confirmation">새 비밀번호 확인</label>
              <span className="password-input-wrap">
                <input id="new-password-confirmation" type={showConfirmation ? "text" : "password"} value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} required />
                <button type="button" className="password-visibility" aria-label={showConfirmation ? "비밀번호 확인 감추기" : "비밀번호 확인 보기"} aria-pressed={showConfirmation} onClick={() => setShowConfirmation(value => !value)}>{showConfirmation ? "감추기" : "보기"}</button>
              </span>

              {message && <p className="auth-message error" role="alert">{message}</p>}
              <button className="button primary" disabled={saving || checking}>{saving ? "변경 중…" : checking ? "보안 링크 확인 중…" : "비밀번호 변경"}</button>
            </form>
            <Link className="auth-back-link" href={forgotPath}>재설정 메일 다시 요청하기</Link>
          </>
        )}
      </section>
    </main>
  );
}

