/* eslint-disable @next/next/no-html-link-for-pages -- Sites needs native document navigation because client-side Link transitions do not complete reliably. */
import { getCurrentProfile } from "../lib/auth";

export const dynamic = "force-dynamic";

function portalFor(profile: Awaited<ReturnType<typeof getCurrentProfile>>) {
  if (!profile) return { href: "/start", label: "시작하기" };
  if (profile.role === "instructor") return profile.status === "active"
    ? { href: "/instructor/dashboard", label: "강사센터로 이동" }
    : { href: "/instructor", label: "계정 상태 확인" };
  if (["super_admin", "service_admin"].includes(profile.role) && profile.status === "active") {
    return { href: "/operations", label: "운영센터로 이동" };
  }
  return { href: "/access-pending", label: "계정 상태 확인" };
}

export default async function LandingPage() {
  const profile = await getCurrentProfile();
  const portal = portalFor(profile);

  return <main className="landing-page">
    <header className="landing-header">
      <a className="landing-brand" href="/" aria-label="클래스플로우 홈"><span className="landing-brand-mark">C</span><span><b>클래스플로우</b><small>by NGN-X</small></span></a>
      <nav aria-label="랜딩페이지 메뉴"><a href="#benefits">서비스 소개</a><a href="#how-it-works">이용 방법</a><a className="landing-header-cta" href={portal.href}>{portal.label}<span>→</span></a></nav>
    </header>

    <section className="landing-hero">
      <div className="landing-hero-copy">
        <span className="landing-eyebrow"><i /> 운영센터와 강사를 하나로 연결하는 배정 플랫폼</span>
        <h1>수업 요청부터<br /><em>배정까지, 한곳에서.</em></h1>
        <p>흩어진 연락과 응답을 한 화면에 모으고,<br className="desktop-break" /> 역할·수업료·확정 일정까지 빠르게 연결하세요.</p>
        <div className="landing-actions"><a className="landing-primary" href={portal.href}>{profile ? portal.label : "무료로 시작하기"}<span>→</span></a><a className="landing-secondary" href="#benefits">어떻게 달라지나요?</a></div>
        <div className="landing-proof"><span><b>10초</b> 강사 응답</span><span><b>한눈에</b> 응답 현황</span><span><b>즉시</b> 배정 결과</span></div>
      </div>

      <div className="landing-visual" aria-label="클래스플로우 강사 수업 요청 화면 예시">
        <div className="landing-orbit orbit-one" /><div className="landing-orbit orbit-two" />
        <article className="floating-card floating-alert"><span>●</span><div><b>새 수업 요청</b><small>응답 마감 D-2</small></div><em>1</em></article>
        <article className="floating-card floating-calendar"><span>✓</span><div><b>일정 확정</b><small>내 일정에 자동 등록</small></div></article>
        <div className="phone-shell">
          <div className="phone-speaker" />
          <div className="phone-screen">
            <header><span>← 관리자 화면</span><b>클래스플로우</b><small>안전한 응답 링크</small></header>
            <div className="phone-request-label">새 수업 요청이 도착했어요</div>
            <h2>AI 창의융합<br />체험 수업</h2>
            <p>성수중학교 · 중학교 1~2학년</p>
            <article className="phone-class-card"><div className="phone-date"><strong>12</strong><span>8월 · 수요일</span></div><dl><div><dt>시간</dt><dd>오전 10:00~12:00</dd></div><div><dt>장소</dt><dd>서울 성동구</dd></div><div><dt>역할</dt><dd>주강사 · 300,000원</dd></div></dl></article>
            <h3>참여 가능하신가요?</h3>
            <div className="phone-response"><span className="available"><b>✓</b>가능</span><span className="conditional"><b>!</b>조건부 가능</span><span className="unavailable"><b>×</b>불가능</span></div>
          </div>
        </div>
      </div>
    </section>

    <section className="landing-benefits" id="benefits">
      <div className="landing-section-title"><span>WHY CLASSFLOW</span><h2>연락에 쓰던 시간을,<br />수업 운영에 돌려드립니다.</h2><p>운영센터에는 빠른 판단을, 강사에게는 명확한 요청과 일정을 제공합니다.</p></div>
      <div className="audience-grid">
        <article className="audience-card operations"><header><span>◎</span><div><small>FOR OPERATIONS</small><h3>운영센터</h3></div><b>연락은 줄이고<br />배정은 빠르게</b></header><ul><li><span>01</span><div><b>응답 현황을 한눈에</b><p>가능·조건부·불가능·미응답을 역할별로 바로 확인합니다.</p></div></li><li><span>02</span><div><b>필요한 강사에게만 재알림</b><p>미응답자를 찾아 개별 연락하는 시간을 줄입니다.</p></div></li><li><span>03</span><div><b>수업료까지 정확하게 확정</b><p>주·보조강사 역할과 수업료를 함께 배정하고 기록합니다.</p></div></li></ul></article>
        <article className="audience-card instructors"><header><span>♙</span><div><small>FOR INSTRUCTORS</small><h3>강사</h3></div><b>조건은 명확하게<br />일정은 간편하게</b></header><ul><li><span>01</span><div><b>요청 조건을 10초 안에 확인</b><p>일정·장소·역할·수업료를 한 화면에서 확인합니다.</p></div></li><li><span>02</span><div><b>가능 여부를 바로 응답</b><p>가능·조건부 가능·불가능 중 내 상황에 맞게 전달합니다.</p></div></li><li><span>03</span><div><b>배정 결과와 일정을 한곳에서</b><p>최종 역할과 확정 일정을 놓치지 않고 관리합니다.</p></div></li></ul></article>
      </div>
    </section>

    <section className="landing-flow" id="how-it-works"><div><span className="landing-section-kicker">SIMPLE FLOW</span><h2>등록하고, 응답받고, 확정하세요.</h2></div><ol><li><span>1</span><b>수업 등록</b><p>일정·역할·수업료 입력</p></li><li><span>2</span><b>강사 요청</b><p>내부 알림과 무료 웹 푸시</p></li><li><span>3</span><b>응답 확인</b><p>역할별 후보와 조건 비교</p></li><li><span>4</span><b>최종 배정</b><p>결과 안내와 일정 자동 등록</p></li></ol></section>

    <section className="landing-final-cta"><div><span>NGN-X · CLASSFLOW</span><h2>강사 배정,<br />이제 연락보다 흐름으로 관리하세요.</h2><p>운영센터와 강사 모두에게 더 명확한 수업 운영을 시작합니다.</p></div><a href={portal.href}>{profile ? portal.label : "클래스플로우 시작하기"}<span>→</span></a></section>
    <footer className="landing-footer"><a className="landing-brand" href="/"><span className="landing-brand-mark">C</span><span><b>클래스플로우</b><small>by NGN-X</small></span></a><p>수업 요청·응답·배정을 한곳에서 관리하는 강사 운영 플랫폼</p><small>© 2026 NGN-X. All rights reserved.</small></footer>
  </main>;
}
