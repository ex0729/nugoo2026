import Link from "next/link";
import { getCurrentProfile } from "../../lib/auth";

export default async function AccessPendingPage() {
  const profile = await getCurrentProfile();
  const suspended = profile?.status === "suspended";

  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="brand-mark">C</span>
        <p className="section-kicker">ACCESS CONTROL</p>
        <h1>{suspended ? "접근이 중지되었습니다" : "관리자 승인을 기다리고 있습니다"}</h1>
        <p>{profile?.email ?? "현재 계정"}은 아직 운영센터 접근 권한이 없습니다.</p>
        <Link className="button secondary" href="/auth/signout">다른 계정으로 로그인</Link>
      </section>
    </main>
  );
}
