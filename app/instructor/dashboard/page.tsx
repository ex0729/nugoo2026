import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function InstructorDashboardPage() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/instructor/login");
  if (profile.role !== "instructor") redirect("/");
  if (profile.status !== "active") redirect("/instructor");

  const firstName = profile.full_name.trim() || "강사";

  return (
    <main className="instructor-dashboard-page">
      <header className="instructor-dashboard-header">
        <Link className="instructor-dashboard-brand" href="/instructor/dashboard">
          <span className="brand-mark">C</span>
          <span>클래스플로우<small>INSTRUCTOR CENTER</small></span>
        </Link>
        <div className="instructor-dashboard-account">
          <span className="instructor-dashboard-avatar" aria-hidden="true">{firstName[0]}</span>
          <span><b>{firstName} 강사님</b><small>승인된 강사 계정</small></span>
          <Link href="/auth/signout?next=/instructor/login">로그아웃</Link>
        </div>
      </header>

      <div className="instructor-dashboard-shell">
        <nav className="instructor-dashboard-nav" aria-label="강사센터 메뉴">
          <a className="active" href="#overview"><span>⌂</span>홈</a>
          <a href="#requests"><span>↗</span>수업 요청</a>
          <a href="#schedule"><span>□</span>확정 일정</a>
        </nav>

        <section className="instructor-dashboard-content" id="overview">
          <div className="instructor-dashboard-welcome">
            <div>
              <p className="section-kicker">INSTRUCTOR DASHBOARD</p>
              <h1>{firstName} 강사님, 반갑습니다</h1>
              <p>새 수업 요청과 확정된 출강 일정을 한곳에서 확인할 수 있습니다.</p>
            </div>
            <span>✓ 승인된 계정</span>
          </div>

          <section className="instructor-dashboard-metrics" aria-label="강사 활동 요약">
            <article><span className="blue">↗</span><div><small>응답할 수업 요청</small><strong>0건</strong></div></article>
            <article><span className="mint">✓</span><div><small>다가오는 확정 수업</small><strong>0건</strong></div></article>
            <article><span className="purple">₩</span><div><small>이번 달 예정 수업료</small><strong>0원</strong></div></article>
          </section>

          <div className="instructor-dashboard-grid">
            <section className="instructor-dashboard-panel" id="requests">
              <header><div><p className="section-kicker">CLASS REQUESTS</p><h2>새 수업 요청</h2></div><span>0건</span></header>
              <div className="instructor-dashboard-empty">
                <span aria-hidden="true">↗</span>
                <h3>현재 응답할 수업 요청이 없습니다</h3>
                <p>관리자가 출강을 요청하면 역할, 수업료, 일정과 함께 이곳에 표시됩니다.</p>
              </div>
            </section>

            <section className="instructor-dashboard-panel" id="schedule">
              <header><div><p className="section-kicker">UPCOMING SCHEDULE</p><h2>다가오는 확정 일정</h2></div><span>0건</span></header>
              <div className="instructor-dashboard-empty compact">
                <span aria-hidden="true">□</span>
                <h3>확정된 수업이 없습니다</h3>
                <p>배정이 확정되면 역할과 수업료를 포함한 일정이 자동으로 등록됩니다.</p>
              </div>
            </section>
          </div>

          <aside className="instructor-dashboard-guide">
            <span>i</span>
            <div><b>수업 요청은 어떻게 받나요?</b><p>관리자가 배정 요청을 보내면 알림과 함께 강사센터에 표시됩니다. 마감 전까지 가능·조건부 가능·불가능으로 응답할 수 있습니다.</p></div>
          </aside>
        </section>
      </div>
    </main>
  );
}
