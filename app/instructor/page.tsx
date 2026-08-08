import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function InstructorHomePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/instructor/login");
  if (profile.role !== "instructor") redirect("/");
  const active = profile.status === "active";

  return (
    <main className="auth-page">
      <section className="auth-card instructor-status-card">
        <span className="brand-mark">C</span>
        <p className="section-kicker">INSTRUCTOR CENTER</p>
        <h1>{active ? `${profile.full_name} 강사님, 반갑습니다` : "가입 신청이 접수되었습니다"}</h1>
        <p>{active ? "배정된 수업과 새 수업 요청을 확인할 수 있습니다." : "관리자 승인 후 강사센터의 모든 기능을 이용할 수 있습니다."}</p>
        <div className={`instructor-status ${active ? "active" : "pending"}`}><span>{active ? "✓" : "◷"}</span>{active ? "승인 완료" : "승인 대기 중"}</div>
        <Link className="button secondary" href="/auth/signout">로그아웃</Link>
      </section>
    </main>
  );
}
