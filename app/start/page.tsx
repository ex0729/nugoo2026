/* eslint-disable @next/next/no-html-link-for-pages -- Sites needs native document navigation for public portal entry links. */
import { redirect } from "next/navigation";
import { getCurrentProfile } from "../../lib/auth";
import HardNavigationLink from "../../components/HardNavigationLink";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  const profile = await getCurrentProfile();
  if (profile?.role === "instructor") redirect(profile.status === "active" ? "/instructor/dashboard" : "/instructor");
  if (profile && ["super_admin", "service_admin"].includes(profile.role)) redirect(profile.status === "active" ? "/operations" : "/access-pending");

  return <main className="portal-select-page">
    <header><a className="landing-brand" href="/"><span className="landing-brand-mark">C</span><span><b>클래스플로우</b><small>by NGN-X</small></span></a><a href="/">← 소개 화면으로</a></header>
    <section className="portal-select-content"><span className="landing-section-kicker">GET STARTED</span><h1>어떤 목적으로<br />클래스플로우를 이용하시나요?</h1><p>이용할 센터를 선택하면 알맞은 로그인 화면으로 연결됩니다.</p>
      <div className="portal-options">
        <HardNavigationLink className="portal-option operations" href="/login"><span className="portal-icon">◎</span><small>OPERATIONS CENTER</small><h2>운영센터</h2><p>수업을 등록하고 강사 응답과<br />최종 배정을 관리합니다.</p><ul><li>수업·수업료 등록</li><li>응답 현황·재알림</li><li>최종 강사 배정</li></ul><b>운영센터 로그인 <i>→</i></b></HardNavigationLink>
        <HardNavigationLink className="portal-option instructors" href="/instructor/login"><span className="portal-icon">♙</span><small>INSTRUCTOR CENTER</small><h2>강사센터</h2><p>새 수업 요청에 응답하고<br />확정 일정을 확인합니다.</p><ul><li>역할·수업료 확인</li><li>가능 여부 응답</li><li>배정 결과·내 일정</li></ul><b>강사 로그인 <i>→</i></b></HardNavigationLink>
      </div>
      <small className="portal-help">로그인에 문제가 있나요? NGN-X 운영 담당자에게 문의해 주세요.</small>
    </section>
  </main>;
}
