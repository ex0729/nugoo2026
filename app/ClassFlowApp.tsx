"use client";
/* eslint-disable jsx-a11y/aria-role, jsx-a11y/no-autofocus -- `role` is a domain prop on RoleBadge; conditional autofocus follows a direct user action. */

import { useEffect, useMemo, useState } from "react";

type Screen = "home" | "classes" | "requests" | "schedule" | "instructors" | "approvals" | "notifications";
type ResponseChoice = "available" | "conditional" | "unavailable" | null;
type AdminIdentity = { name: string; email: string; role: "service_admin" | "super_admin" };

const navItems: { id: Screen; label: string; icon: string; badge?: number }[] = [
  { id: "home", label: "홈", icon: "⌂" },
  { id: "classes", label: "수업", icon: "▣" },
  { id: "requests", label: "배정 요청", icon: "↗", badge: 3 },
  { id: "schedule", label: "일정", icon: "□" },
  { id: "instructors", label: "강사", icon: "◎" },
  { id: "approvals", label: "회원 승인", icon: "✓", badge: 2 },
  { id: "notifications", label: "알림 이력", icon: "◷" },
];

const classes = [
  { id: 1, title: "AI 창의융합 체험 수업", institution: "성수중학교", date: "8월 12일 (수)", time: "10:00–12:00", place: "서울 성동구", status: "응답 대기", tone: "blue", replies: "8/12", lead: "후보 3명", assistant: "후보 2명", deadline: "오늘 18:00", urgent: true },
  { id: 2, title: "로봇 코딩 진로 캠프", institution: "한빛초등학교", date: "8월 13일 (목)", time: "09:30–12:30", place: "경기 고양시", status: "배정 필요", tone: "amber", replies: "9/10", lead: "후보 4명", assistant: "후보 3명", deadline: "마감 지남", urgent: true },
  { id: 3, title: "메타버스 콘텐츠 제작", institution: "서울미디어고", date: "8월 15일 (토)", time: "13:00–16:00", place: "서울 용산구", status: "배정 완료", tone: "green", replies: "7/7", lead: "김민준", assistant: "이지아", deadline: "완료", urgent: false },
  { id: 4, title: "디지털 리터러시 특강", institution: "마포청소년센터", date: "8월 18일 (화)", time: "14:00–16:00", place: "서울 마포구", status: "요청 전", tone: "gray", replies: "0/8", lead: "미확보", assistant: "미확보", deadline: "8월 14일", urgent: false },
];

const candidates = [
  { name: "김민준", initials: "김", role: "주강사", status: "가능", time: "오늘 10:24", subject: "AI · 코딩", region: "서울 전역", conflict: false, condition: "" },
  { name: "박서연", initials: "박", role: "주강사", status: "조건부", time: "오늘 09:48", subject: "AI · 메이커", region: "서울 동부", conflict: false, condition: "수업 시작 시간을 10시 30분으로 조정하면 가능합니다." },
  { name: "최현우", initials: "최", role: "보조강사", status: "가능", time: "어제 21:06", subject: "코딩 · 로봇", region: "서울·경기", conflict: true, condition: "" },
  { name: "이지아", initials: "이", role: "보조강사", status: "가능", time: "어제 19:42", subject: "AI · 콘텐츠", region: "서울 서부", conflict: false, condition: "" },
  { name: "정유진", initials: "정", role: "주강사", status: "불가능", time: "어제 18:30", subject: "AI · 데이터", region: "서울 전역", conflict: false, condition: "" },
  { name: "한도윤", initials: "한", role: "두 역할", status: "미응답", time: "최근 알림 어제 16:00", subject: "코딩 · 메이커", region: "서울 동부", conflict: false, condition: "" },
];

const instructors = [
  { name: "김민준", subjects: "AI · 파이썬 · 데이터", region: "서울 전역", classes: 18, rate: "94%", state: "활성" },
  { name: "박서연", subjects: "AI · 메이커 · 로봇", region: "서울 동부", classes: 14, rate: "88%", state: "활성" },
  { name: "최현우", subjects: "코딩 · 로봇", region: "서울·경기", classes: 11, rate: "91%", state: "활성" },
  { name: "이지아", subjects: "AI · 콘텐츠 제작", region: "서울 서부", classes: 9, rate: "86%", state: "활성" },
  { name: "한도윤", subjects: "코딩 · 메이커", region: "서울 동부", classes: 6, rate: "72%", state: "승인 대기" },
  { name: "정유진", subjects: "AI · 데이터", region: "서울 전역", classes: 12, rate: "89%", state: "활성" },
];

function StatusBadge({ children, tone = "gray" }: { children: React.ReactNode; tone?: string }) {
  const icons: Record<string, string> = { green: "✓", amber: "!", red: "!", blue: "◷", gray: "·", mint: "✓" };
  return <span className={`status status-${tone}`}><span aria-hidden="true">{icons[tone] || "·"}</span>{children}</span>;
}

function RoleBadge({ role }: { role: string }) {
  return <span className={`role-badge ${role.includes("보조") ? "assistant" : role.includes("두") ? "both" : "lead"}`}>{role}</span>;
}

function Topbar({ screen, onInstructor, onCreate, admin }: { screen: Screen; onInstructor: () => void; onCreate: () => void; admin: AdminIdentity }) {
  const labels: Record<Screen, string> = { home: "홈", classes: "수업 관리", requests: "배정 요청", schedule: "전체 일정", instructors: "강사 관리", approvals: "회원 승인", notifications: "알림 발송 이력" };
  return (
    <header className="topbar">
      <div><p className="eyebrow">클래스플로우 운영센터</p><h1>{labels[screen]}</h1></div>
      <div className="top-actions">
        <button className="icon-btn" aria-label="알림"><span aria-hidden="true">♢</span><i /></button>
        <button className="button secondary instructor-preview" onClick={onInstructor}>강사 화면 보기 <span>→</span></button>
        <button className="button primary" onClick={onCreate}><span aria-hidden="true">＋</span> 수업 등록</button>
        <a className="profile" aria-label="로그아웃" href="/auth/signout" title={`${admin.email} · 로그아웃`}><span>{admin.name}</span><b>{admin.name[0]}</b></a>
      </div>
    </header>
  );
}

function Sidebar({ screen, setScreen, canManageMembers }: { screen: Screen; setScreen: (s: Screen) => void; canManageMembers: boolean }) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => setScreen("home")}><span className="brand-mark">C</span><span>클래스플로우<small>Instructor Ops</small></span></button>
      <nav aria-label="주 메뉴">
        {navItems.filter(item => item.id !== "approvals" || canManageMembers).map(item => <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => setScreen(item.id)}><span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.label}{item.badge ? <em>{item.badge}</em> : null}</button>)}
      </nav>
      <div className="sidebar-help"><span aria-hidden="true">?</span><div><b>도움이 필요하신가요?</b><small>운영 가이드 확인하기</small></div></div>
      <button className="settings"><span aria-hidden="true">⚙</span> 설정</button>
    </aside>
  );
}

function MetricCard({ icon, label, value, detail, tone }: { icon: string; label: string; value: string; detail: string; tone: string }) {
  return <article className="metric-card"><div className={`metric-icon ${tone}`} aria-hidden="true">{icon}</div><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div><button aria-label={`${label} 자세히 보기`}>→</button></article>;
}

function HomeScreen({ go, adminName }: { go: (s: Screen) => void; adminName: string }) {
  return <div className="screen-stack">
    <section className="welcome-row"><div><h2>좋은 오전이에요, {adminName}님 <span aria-hidden="true">☀</span></h2><p>오늘 바로 확인해야 할 배정 업무를 모아봤어요.</p></div><div className="today-chip"><span>오늘</span><b>2026년 8월 8일 토요일</b></div></section>
    <section className="metrics-grid">
      <MetricCard icon="◷" label="응답 대기 수업" value="3건" detail="미응답 강사 8명" tone="blue" />
      <MetricCard icon="!" label="마감 임박" value="2건" detail="24시간 이내 마감" tone="amber" />
      <MetricCard icon="↗" label="배정 필요" value="1건" detail="후보 검토가 필요해요" tone="red" />
      <MetricCard icon="✓" label="오늘 확정 수업" value="4건" detail="배정 강사 7명" tone="mint" />
    </section>
    <section className="dashboard-grid">
      <div className="panel action-panel">
        <div className="panel-head"><div><span className="section-kicker">ACTION NEEDED</span><h3>지금 확인이 필요한 수업</h3></div><button className="text-button" onClick={() => go("classes")}>전체 보기 →</button></div>
        <div className="action-list">
          {classes.slice(0, 3).map((item, idx) => <button className="action-item" key={item.id} onClick={() => go(idx === 2 ? "schedule" : "requests")}>
            <div className={`date-tile ${idx === 1 ? "urgent" : ""}`}><b>{item.date.split(" ")[1].replace("일", "")}</b><span>{idx === 0 ? "수" : idx === 1 ? "목" : "토"}</span></div>
            <div className="action-main"><div><StatusBadge tone={item.tone}>{item.status}</StatusBadge>{item.urgent && <span className="deadline">{item.deadline}</span>}</div><h4>{item.title}</h4><p>{item.institution} · {item.time} · {item.place}</p></div>
            <div className="candidate-count"><span>주강사 <b>{item.lead}</b></span><span>보조강사 <b>{item.assistant}</b></span></div><span className="chevron">›</span>
          </button>)}
        </div>
      </div>
      <div className="panel response-summary">
        <div className="panel-head"><div><span className="section-kicker">LIVE RESPONSE</span><h3>응답 현황</h3></div><span className="live-dot">실시간</span></div>
        <div className="donut-row"><div className="donut"><div><strong>75%</strong><span>응답률</span></div></div><div className="legend"><span><i className="green" /> 가능 <b>14</b></span><span><i className="amber" /> 조건부 <b>4</b></span><span><i className="red" /> 불가능 <b>6</b></span><span><i className="gray" /> 미응답 <b>8</b></span></div></div>
        <div className="response-note"><span aria-hidden="true">↗</span><p><b>지난주보다 12% 빨라졌어요</b><small>최초 알림 후 평균 3시간 24분 내 응답</small></p></div>
      </div>
    </section>
    <section className="panel recent-panel"><div className="panel-head"><div><span className="section-kicker">RECENT ACTIVITY</span><h3>최근 강사 응답</h3></div><button className="text-button" onClick={() => go("requests")}>응답 현황 열기 →</button></div>
      <div className="activity-table"><div className="table-head"><span>강사</span><span>수업</span><span>모집 역할</span><span>응답</span><span>응답 시각</span></div>{candidates.slice(0, 4).map((c, i) => <div className="table-row" key={c.name}><span className="person"><b>{c.initials}</b><span>{c.name}<small>{c.subject}</small></span></span><span>{i % 2 ? "로봇 코딩 진로 캠프" : "AI 창의융합 체험"}</span><span><RoleBadge role={c.role} /></span><span><StatusBadge tone={c.status === "가능" ? "green" : c.status === "조건부" ? "amber" : c.status === "불가능" ? "red" : "gray"}>{c.status}</StatusBadge></span><span>{c.time}</span></div>)}</div>
    </section>
  </div>;
}

function ClassesScreen({ onCreate, goRequests }: { onCreate: () => void; goRequests: () => void }) {
  const [filter, setFilter] = useState("전체");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const visible = classes.filter(c => {
    const matchesStatus = filter === "전체" || c.status === filter;
    const matchesQuery = !normalizedQuery || [c.title, c.institution, c.place].some(value => value.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
    return matchesStatus && matchesQuery;
  });
  return <div className="screen-stack"><section className="toolbar"><div className="search"><span aria-hidden="true">⌕</span><input aria-label="수업 검색" placeholder="기관명 또는 수업명 검색" value={query} onChange={event => setQuery(event.target.value)} /></div><div className="filter-tabs">{["전체", "응답 대기", "배정 필요", "배정 완료"].map(f => <button className={filter === f ? "active" : ""} onClick={() => setFilter(f)} key={f}>{f}</button>)}</div><button className="button primary" onClick={onCreate}>＋ 새 수업</button></section>
    <section className="panel class-table-panel"><div className="list-summary"><p>검색 결과 <b>{visible.length}</b></p><div><button className="view-toggle active">목록</button><button className="view-toggle">주간 일정</button></div></div><div className="class-table"><div className="class-table-head"><span>수업 정보</span><span>일정·장소</span><span>모집 현황</span><span>응답 마감</span><span>상태</span><span /></div>{visible.map(item => <div className="class-row" key={item.id}><span><b>{item.title}</b><small>{item.institution}</small></span><span><b>{item.date} · {item.time}</b><small>{item.place}</small></span><span><small>주강사 {item.lead}</small><small>보조강사 {item.assistant}</small></span><span className={item.deadline.includes("지남") ? "text-red" : ""}>{item.deadline}</span><span><StatusBadge tone={item.tone}>{item.status}</StatusBadge></span><span><button className="row-action" onClick={goRequests}>{item.status === "응답 대기" || item.status === "배정 필요" ? "현황 보기" : "상세"}</button></span></div>)}{visible.length === 0 && <div className="empty-state">검색 조건에 맞는 수업이 없습니다.</div>}</div></section>
  </div>;
}

function RequestsScreen() {
  const [statusFilter, setStatusFilter] = useState("전체");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [assigned, setAssigned] = useState<string[]>(["김민준"]);
  const [reminderSent, setReminderSent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const filtered = candidates.filter(c => {
    const matchesStatus = statusFilter === "전체" || c.status === statusFilter;
    const matchesQuery = !normalizedQuery || [c.name, c.subject, c.region, c.role].some(value => value.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
    return matchesStatus && matchesQuery;
  });
  const toggleSelected = (name: string) => setSelected(v => v.includes(name) ? v.filter(n => n !== name) : [...v, name]);
  const toggleAssign = (name: string) => {
    setConfirmed(false);
    setAssigned(v => v.includes(name) ? v.filter(n => n !== name) : [...v, name]);
  };
  const sendReminder = () => {
    setReminderSent(true);
    setSelected([]);
  };
  return <div className="request-layout">
    {confirmed && <section className="notice-banner"><span>✓</span><div><b>강사 배정이 완료됐어요</b><p>선택한 주강사 1명과 보조강사 2명에게 확정 알림을 보냈습니다.</p></div></section>}
    {reminderSent && !confirmed && <section className="notice-banner"><span>✓</span><div><b>재알림을 전송했어요</b><p>선택한 미응답 강사에게 카카오 알림톡을 다시 보냈습니다.</p></div></section>}
    <section className="panel request-hero"><div className="request-title"><button className="back-button">‹</button><div><span className="section-kicker">성수중학교 · 2026-0812-01</span><h2>AI 창의융합 체험 수업</h2><p>8월 12일 (수) 10:00–12:00 · 서울 성동구</p></div></div><div className="request-deadline"><span>응답 마감까지</span><strong>6시간 18분</strong><small>오늘 18:00 마감</small></div></section>
    <section className="role-requirements"><article><div><RoleBadge role="주강사" /><strong>1명 모집</strong></div><b>300,000원</b><span>후보 3명 확보</span></article><article><div><RoleBadge role="보조강사" /><strong>2명 모집</strong></div><b>1인당 150,000원</b><span>후보 2명 확보</span></article><article className="progress-card"><div><span>전체 응답</span><b>8 / 12명</b></div><div className="progress-track"><i style={{ width: "67%" }} /></div><small>미응답 4명 · 최근 알림 어제 16:00</small></article></section>
    <section className="panel response-board"><div className="board-head"><div className="filter-tabs">{["전체", "가능", "조건부", "불가능", "미응답"].map(f => <button className={statusFilter === f ? "active" : ""} onClick={() => setStatusFilter(f)} key={f}>{f}{f === "미응답" ? " 4" : ""}</button>)}</div><div className="board-actions">{selected.length > 0 && <button className="button secondary" onClick={sendReminder}>선택 {selected.length}명 재알림</button>}<div className="search compact"><span>⌕</span><input aria-label="강사 검색" placeholder="강사 검색" value={query} onChange={event => setQuery(event.target.value)} /></div></div></div>
      <div className="candidate-table"><div className="candidate-head"><span><input type="checkbox" aria-label="전체 선택" checked={filtered.length > 0 && filtered.every(c => selected.includes(c.name))} onChange={() => setSelected(filtered.every(c => selected.includes(c.name)) ? [] : filtered.map(c => c.name))} /></span><span>강사</span><span>모집 역할</span><span>응답 상태</span><span>조건·충돌</span><span>배정 후보</span></div>{filtered.map(c => <div className="candidate-row" key={c.name}><span><input type="checkbox" aria-label={`${c.name} 선택`} checked={selected.includes(c.name)} onChange={() => toggleSelected(c.name)} /></span><span className="person"><b>{c.initials}</b><span>{c.name}<small>{c.subject} · {c.region}</small></span></span><span><RoleBadge role={c.role} /></span><span><StatusBadge tone={c.status === "가능" ? "green" : c.status === "조건부" ? "amber" : c.status === "불가능" ? "red" : "gray"}>{c.status}</StatusBadge><small className="cell-note">{c.time}</small></span><span>{c.conflict ? <span className="conflict">! 확정 일정과 30분 겹침</span> : c.condition ? <span className="condition-text">“{c.condition}”</span> : <span className="muted">특이사항 없음</span>}</span><span>{c.status === "가능" || c.status === "조건부" ? <button className={`assign-toggle ${assigned.includes(c.name) ? "selected" : ""}`} onClick={() => toggleAssign(c.name)}>{assigned.includes(c.name) ? "✓ 선택됨" : "후보 선택"}</button> : <span className="muted">—</span>}</span></div>)}{filtered.length === 0 && <div className="empty-state">검색 조건에 맞는 강사가 없습니다.</div>}</div>
    </section>
    <section className="assignment-bar"><div><span>현재 배정 후보</span><div className="selected-people">{assigned.map((name, i) => <b key={name}>{name}<small>{i === 0 ? "주강사" : "보조강사"}</small></b>)}</div></div><p><span>주강사 <b>1/1</b></span><span>보조강사 <b>{Math.max(0, assigned.length - 1)}/2</b></span></p><button className="button primary" disabled={assigned.length < 3 || confirmed} onClick={() => setConfirmed(true)}>{confirmed ? "✓ 배정 완료" : "최종 배정 확인"}</button></section>
  </div>;
}

function ScheduleScreen() {
  const days = ["8월 10일 월", "8월 11일 화", "8월 12일 수", "8월 13일 목", "8월 14일 금"];
  return <div className="screen-stack"><section className="toolbar"><div><h2 className="content-title">8월 2주</h2><p className="content-subtitle">확정 수업 8건 · 배정 강사 13명</p></div><div className="calendar-controls"><button>‹</button><button>오늘</button><button>›</button></div><div className="filter-tabs"><button className="active">주간</button><button>월간</button></div></section><section className="panel calendar"><div className="calendar-grid"><div className="time-column head" />{days.map((d, i) => <div className={`day-head ${i === 2 ? "today" : ""}`} key={d}><b>{d.split(" ").slice(2).join(" ")}</b><span>{10 + i}</span></div>)}{["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"].map((time, row) => <div className="calendar-row" key={time} style={{ gridRow: row + 2 }}><div className="time-label">{time}</div>{days.map((_, col) => <div className="calendar-cell" key={col} />)}</div>)}<article className="calendar-event blue" style={{ gridColumn: 4, gridRow: "3 / span 2" }}><b>AI 창의융합 체험</b><span>성수중학교</span><small>김민준 외 2명</small></article><article className="calendar-event mint" style={{ gridColumn: 5, gridRow: "2 / span 3" }}><b>로봇 코딩 캠프</b><span>한빛초등학교</span><small>박서연 외 2명</small></article><article className="calendar-event purple" style={{ gridColumn: 2, gridRow: "7 / span 2" }}><b>디지털 리터러시</b><span>동작청소년센터</span><small>이지아 외 1명</small></article></div></section></div>;
}

function InstructorsScreen() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("전체");
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const visible = instructors.filter(p => {
    const matchesState = filter === "전체" || p.state === filter;
    const matchesQuery = !normalizedQuery || [p.name, p.subjects, p.region].some(value => value.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
    return matchesState && matchesQuery;
  });
  return <div className="screen-stack"><section className="toolbar"><div className="search"><span>⌕</span><input aria-label="강사 검색" placeholder="강사명, 과목, 지역 검색" value={query} onChange={event => setQuery(event.target.value)} /></div><div className="filter-tabs">{["전체", "활성", "승인 대기"].map(value => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value} {value === "전체" ? instructors.length : instructors.filter(p => p.state === value).length}</button>)}</div><button className="button secondary">강사 초대</button></section><section className="instructor-grid">{visible.map((p, i) => <article className="panel instructor-card" key={p.name}><div className="instructor-card-head"><span className={`avatar avatar-${i % 4}`}>{p.name[0]}</span><div><h3>{p.name}</h3><p>{p.subjects}</p></div><StatusBadge tone={p.state === "활성" ? "green" : "amber"}>{p.state}</StatusBadge></div><dl><div><dt>활동 지역</dt><dd>{p.region}</dd></div><div><dt>확정 수업</dt><dd>{p.classes}회</dd></div><div><dt>응답률</dt><dd>{p.rate}</dd></div></dl><div className="instructor-card-actions"><button>프로필 보기</button><button>일정 확인</button></div></article>)}{visible.length === 0 && <div className="panel empty-state">검색 조건에 맞는 강사가 없습니다.</div>}</section></div>;
}

type MemberRecord = {
  user_id: string;
  email: string;
  full_name: string;
  role: "instructor" | "company_member" | "service_admin" | "super_admin";
  status: "pending" | "active" | "suspended";
  created_at: string;
};

function ApprovalsScreen({ currentRole }: { currentRole: AdminIdentity["role"] }) {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [roles, setRoles] = useState<Record<string, MemberRecord["role"]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/members")
      .then(async response => {
        if (!response.ok) throw new Error("members_unavailable");
        return response.json() as Promise<{ members: MemberRecord[] }>;
      })
      .then(data => {
        setMembers(data.members);
        setRoles(Object.fromEntries(data.members.map(member => [member.user_id, member.role])));
      })
      .catch(() => setError("회원 정보를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  async function updateMember(member: MemberRecord, status: MemberRecord["status"]) {
    setError("");
    const response = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: member.user_id, role: roles[member.user_id], status }),
    });

    if (!response.ok) {
      setError("권한을 변경하지 못했습니다. 최고관리자 권한을 확인해 주세요.");
      return;
    }

    setMembers(current => current.map(item => item.user_id === member.user_id ? { ...item, role: roles[member.user_id], status } : item));
  }

  const pending = members.filter(member => member.status === "pending");
  const roleLabel: Record<MemberRecord["role"], string> = { instructor: "소속 강사", company_member: "업체 운영자", service_admin: "운영 관리자", super_admin: "최고관리자" };

  return <div className="screen-stack">
    <section className="notice-banner"><span>✓</span><div><b>승인 대기 회원이 {pending.length}명 있어요</b><p>실제 Supabase 회원 정보와 서버 권한 정책을 기준으로 처리됩니다.</p></div></section>
    {error && <section className="notice-banner error-banner"><span>!</span><div><b>처리할 수 없습니다</b><p>{error}</p></div></section>}
    <section className="panel approval-list"><div className="panel-head"><div><span className="section-kicker">MEMBER APPROVAL</span><h3>가입 승인 요청</h3></div></div>
      {loading && <div className="empty-state">회원 정보를 불러오는 중입니다.</div>}
      {!loading && pending.length === 0 && <div className="empty-state">현재 승인 대기 회원이 없습니다.</div>}
      {pending.map(member => <article className="approval-item" key={member.user_id}><span className="avatar">{member.full_name[0]}</span><div className="approval-info"><h3>{member.full_name}</h3><p>{member.email}</p><small>가입 요청 {new Date(member.created_at).toLocaleDateString("ko-KR")} · 이메일 인증 완료</small></div><div className="role-select"><label>부여 역할<select aria-label={`${member.full_name} 역할`} value={roles[member.user_id] ?? member.role} onChange={event => setRoles(value => ({ ...value, [member.user_id]: event.target.value as MemberRecord["role"] }))}><option value="instructor">소속 강사</option><option value="company_member">업체 운영자</option>{currentRole === "super_admin" && <option value="service_admin">운영 관리자</option>}</select></label></div><div className="approval-actions"><button className="button ghost" onClick={() => updateMember(member, "suspended")}>거절</button><button className="button primary" onClick={() => updateMember(member, "active")}>승인</button></div></article>)}
    </section>
    <section className="panel approval-list"><div className="panel-head"><div><span className="section-kicker">ACTIVE MEMBERS</span><h3>현재 계정과 권한</h3></div></div>{members.filter(member => member.status !== "pending").map(member => <article className="approval-item" key={member.user_id}><span className="avatar">{member.full_name[0]}</span><div className="approval-info"><h3>{member.full_name}</h3><p>{member.email}</p></div><StatusBadge tone={member.status === "active" ? "green" : "red"}>{member.status === "active" ? "활성" : "중지"}</StatusBadge><strong className="member-role-label">{roleLabel[member.role]}</strong></article>)}</section>
  </div>;
}

function NotificationsScreen() {
  return <div className="screen-stack"><section className="metrics-grid compact-metrics"><MetricCard icon="↗" label="오늘 발송" value="24건" detail="성공 23 · 실패 1" tone="blue" /><MetricCard icon="✓" label="발송 성공률" value="98.7%" detail="최근 30일 기준" tone="mint" /><MetricCard icon="◷" label="재알림" value="4건" detail="오늘 선택 발송" tone="amber" /></section><section className="panel notification-list"><div className="panel-head"><div><span className="section-kicker">DELIVERY LOG</span><h3>알림 발송 이력</h3></div><div className="filter-tabs"><button className="active">전체</button><button>요청</button><button>재알림</button><button>결과</button></div></div>{["배정 요청", "재알림", "배정 확정", "미선택 안내", "일정 변경"].map((type, i) => <article className="notification-item" key={type}><span className={`notification-type nt-${i}`}>{i === 0 ? "↗" : i === 1 ? "◷" : "✓"}</span><div><b>{type} · {i < 2 ? "AI 창의융합 체험 수업" : "로봇 코딩 진로 캠프"}</b><p>{i === 1 ? "한도윤 외 3명" : "김민준 외 7명"} · 카카오 알림톡</p></div><span>오늘 {10 + i}:2{i}</span><StatusBadge tone={i === 4 ? "red" : "green"}>{i === 4 ? "실패" : "성공"}</StatusBadge>{i === 4 && <button className="row-action">재발송</button>}</article>)}</section></div>;
}

function ClassForm({ close }: { close: () => void }) {
  const [assistants, setAssistants] = useState(2);
  const [step, setStep] = useState(1);
  return <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="form-title"><button className="overlay-bg" onClick={close} aria-label="닫기" /><section className="drawer"><header><div><span className="section-kicker">NEW CLASS</span><h2 id="form-title">새 수업 등록</h2></div><button className="close-button" onClick={close} aria-label="닫기">×</button></header><div className="stepper"><span className="active">1 <b>수업 정보</b></span><i /><span className={step === 2 ? "active" : ""}>2 <b>강사·수업료</b></span><i /><span>3 <b>확인</b></span></div>{step === 1 ? <div className="form-body"><div className="form-section"><h3>기본 정보</h3><div className="form-grid"><label className="wide">수업명<input defaultValue="AI 창의융합 체험 수업" /></label><label>기관명<input defaultValue="성수중학교" /></label><label>담당자<input placeholder="담당자명 · 연락처" /></label><label>수업 날짜<input type="date" defaultValue="2026-08-12" /></label><label>수업 시간<div className="split-input"><input type="time" defaultValue="10:00" /><span>–</span><input type="time" defaultValue="12:00" /></div></label><label className="wide">장소·주소<input defaultValue="서울 성동구 성수이로 32" /></label></div></div><div className="form-section"><h3>수업 상세</h3><div className="form-grid thirds"><label>대상<select defaultValue="중학생"><option>중학생</option><option>초등학생</option><option>고등학생</option></select></label><label>학년<select><option>1~2학년</option></select></label><label>참여 인원<input type="number" defaultValue="24" /></label><label className="wide">수업 내용<textarea defaultValue="생성형 AI의 원리를 이해하고 팀별 창작 프로젝트를 진행합니다." /></label></div></div></div> : <div className="form-body"><div className="form-section"><h3>역할별 필요 인원</h3><div className="role-setting"><article><div><RoleBadge role="주강사" /><p>수업을 총괄하고 진행합니다.</p></div><strong>1명 <small>필수</small></strong></article><article><div><RoleBadge role="보조강사" /><p>실습과 모둠 활동을 지원합니다.</p></div><div className="counter"><button onClick={() => setAssistants(Math.max(0, assistants - 1))}>−</button><b>{assistants}명</b><button onClick={() => setAssistants(Math.min(2, assistants + 1))}>＋</button></div></article></div></div><div className="form-section"><h3>역할별 수업료</h3><div className="fee-fields"><label><span><RoleBadge role="주강사" /> 1인 지급액</span><div><input inputMode="numeric" defaultValue="300,000" /><b>원</b></div></label><label className={assistants === 0 ? "disabled" : ""}><span><RoleBadge role="보조강사" /> 1인당 지급액</span><div><input inputMode="numeric" defaultValue={assistants ? "150,000" : ""} disabled={assistants === 0} /><b>원</b></div></label></div><label className="full-label">수업료 안내사항<textarea defaultValue="교통비 포함, 원천징수 후 수업일 기준 익월 10일 지급" /></label><p className="info-callout"><span>i</span> 입력한 금액은 모집 안내와 최종 배정 알림에 역할별로 표시됩니다.</p></div><div className="form-section"><h3>응답 마감</h3><div className="form-grid"><label>마감 날짜<input type="date" defaultValue="2026-08-08" /></label><label>마감 시간<input type="time" defaultValue="18:00" /></label></div></div></div>}<footer><button className="button ghost" onClick={step === 1 ? close : () => setStep(1)}>{step === 1 ? "취소" : "이전"}</button><button className="button primary" onClick={() => step === 1 ? setStep(2) : close()}>{step === 1 ? "다음: 강사·수업료" : "저장하고 대상 선택"} →</button></footer></section></div>;
}

function InstructorMobile({ onBack }: { onBack: () => void }) {
  const [choice, setChoice] = useState<ResponseChoice>(null);
  const [condition, setCondition] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const canSubmit = Boolean(choice) && (choice !== "conditional" || condition.trim().length > 0);
  if (submitted) return <div className="mobile-stage"><div className="mobile-top"><button onClick={onBack}>← 관리자 화면</button><span>클래스플로우</span></div><main className="success-mobile"><div className="success-check">✓</div><span className="section-kicker">RESPONSE COMPLETE</span><h1>응답을 보냈어요</h1><p>관리자가 후보를 확인한 뒤<br />배정 결과를 알림톡으로 안내해 드릴게요.</p><article><span>선택한 응답</span><b>{choice === "available" ? "가능" : choice === "conditional" ? "조건부 가능" : "불가능"}</b><small>AI 창의융합 체험 수업 · 주강사</small></article><button className="button primary mobile-primary" onClick={() => setSubmitted(false)}>응답 내용 확인하기</button><button className="text-button" onClick={onBack}>관리자 데모로 돌아가기</button></main></div>;
  return <div className="mobile-stage"><div className="mobile-top"><button onClick={onBack}>← 관리자 화면</button><span>클래스플로우</span><small>안전한 응답 링크</small></div><main className="mobile-content"><section className="mobile-intro"><span className="request-label">출강 요청이 도착했어요</span><h1>AI 창의융합<br />체험 수업</h1><p>성수중학교에서 진행하는 수업입니다.<br />아래 내용을 확인하고 응답해 주세요.</p></section><section className="mobile-class-card"><div className="mobile-date"><b>12</b><span>8월 · 수요일</span></div><dl><div><dt>시간</dt><dd>오전 10:00–12:00</dd></div><div><dt>장소</dt><dd>서울 성동구 성수이로 32</dd></div><div><dt>대상</dt><dd>중학교 1–2학년 · 24명</dd></div></dl><button className="detail-toggle" onClick={() => setExpanded(!expanded)}>{expanded ? "상세 정보 접기" : "수업 상세 보기"} <span>{expanded ? "⌃" : "⌄"}</span></button>{expanded && <div className="expanded-detail"><b>수업 내용</b><p>생성형 AI의 원리를 이해하고 팀별 창작 프로젝트를 진행합니다.</p><b>안내사항</b><p>개인 노트북 지참 · 수업 20분 전 도착</p></div>}</section><section className="mobile-role-section"><div className="mobile-section-title"><span>요청받은 역할</span><small>역할별로 응답할 수 있어요</small></div><article className="mobile-role-card selected"><div><RoleBadge role="주강사" /><b>300,000원</b></div><p>수업 전체 진행과 팀별 활동을 총괄합니다.</p><small>교통비 포함 · 원천징수 후 익월 10일 지급</small></article><article className="mobile-role-card"><div><RoleBadge role="보조강사" /><b>1인당 150,000원</b></div><p>실습 환경 세팅과 모둠 활동을 지원합니다.</p></article></section><section className="mobile-response"><div className="mobile-section-title"><span>주강사로 참여 가능하신가요?</span><small><b>오늘 오후 6시</b>까지 응답해 주세요</small></div><div className="response-choices"><button className={choice === "available" ? "selected available" : ""} onClick={() => { setChoice("available"); setCondition(""); }}><span>✓</span><b>가능해요</b><small>일정과 조건 모두 괜찮아요</small></button><button className={choice === "conditional" ? "selected conditional" : ""} onClick={() => setChoice("conditional")}><span>i</span><b>조건부 가능</b><small>조정이 필요한 내용이 있어요</small></button><button className={choice === "unavailable" ? "selected unavailable" : ""} onClick={() => { setChoice("unavailable"); setCondition(""); }}><span>×</span><b>어려워요</b><small>이번 수업은 참여하기 어려워요</small></button></div>{choice === "conditional" && <label className="conditional-input">필요한 조건을 알려주세요<textarea autoFocus required value={condition} onChange={event => setCondition(event.target.value)} placeholder="예: 시작 시간을 30분 늦추면 가능합니다." /><small>{condition.trim() ? "관리자가 후보를 비교할 때 확인합니다." : "조건부 응답을 제출하려면 조건을 입력해 주세요."}</small></label>}<div className="mobile-conflict"><span>!</span><p><b>겹치는 확정 일정은 없어요</b><small>클래스플로우에 등록된 일정 기준</small></p></div></section></main><div className="mobile-bottom"><button className="button primary mobile-primary" disabled={!canSubmit} onClick={() => canSubmit && setSubmitted(true)}>{!choice ? "응답을 선택해 주세요" : choice === "conditional" && !condition.trim() ? "조건을 입력해 주세요" : "이 응답으로 제출하기"}</button><p>마감 전까지 언제든 응답을 변경할 수 있어요.</p></div></div>;
}

export default function ClassFlowApp({ currentAdmin }: { currentAdmin: AdminIdentity }) {
  const [screen, setScreen] = useState<Screen>("home");
  const [showForm, setShowForm] = useState(false);
  const [instructorMode, setInstructorMode] = useState(false);
  const content = useMemo(() => {
    if (screen === "home") return <HomeScreen go={setScreen} adminName={currentAdmin.name} />;
    if (screen === "classes") return <ClassesScreen onCreate={() => setShowForm(true)} goRequests={() => setScreen("requests")} />;
    if (screen === "requests") return <RequestsScreen />;
    if (screen === "schedule") return <ScheduleScreen />;
    if (screen === "instructors") return <InstructorsScreen />;
    if (screen === "approvals") return <ApprovalsScreen currentRole={currentAdmin.role} />;
    return <NotificationsScreen />;
  }, [currentAdmin.name, currentAdmin.role, screen]);
  if (instructorMode) return <InstructorMobile onBack={() => setInstructorMode(false)} />;
  return <div className="app-shell"><Sidebar screen={screen} setScreen={setScreen} canManageMembers /><div className="main-shell"><Topbar screen={screen} onInstructor={() => setInstructorMode(true)} onCreate={() => setShowForm(true)} admin={currentAdmin} /><main className="main-content">{content}</main></div>{showForm && <ClassForm close={() => setShowForm(false)} />}</div>;
}
