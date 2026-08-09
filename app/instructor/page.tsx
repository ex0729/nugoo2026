import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function InstructorHomePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/instructor/login");
  if (profile.role !== "instructor") redirect("/");
  if (profile.status === "active") redirect("/instructor/dashboard");
  const suspended = profile.status === "suspended";

  return (
    <main className="auth-page">
      <section className="auth-card instructor-status-card">
        <span className="brand-mark">C</span>
        <p className="section-kicker">INSTRUCTOR CENTER</p>
        <h1>{suspended ? "현재 이용이 중지된 계정입니다" : "가입 신청이 접수되었습니다"}</h1>
        <p>{suspended ? "계정 상태 확인이 필요합니다. 운영센터 관리자에게 문의해 주세요." : "관리자 승인 후 강사센터의 모든 기능을 이용할 수 있습니다."}</p>
        <div className={`instructor-status ${suspended ? "suspended" : "pending"}`}><span>{suspended ? "!" : "◷"}</span>{suspended ? "이용 중지" : "승인 대기 중"}</div>
        <Link className="button secondary" href="/auth/signout?next=/instructor/login">로그아웃</Link>
      </section>
    </main>
  );
}
