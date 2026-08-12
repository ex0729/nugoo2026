"use client";
/* eslint-disable jsx-a11y/aria-role, jsx-a11y/no-autofocus, jsx-a11y/no-noninteractive-element-to-interactive-role, react-hooks/refs -- domain role labels and keyboard-enabled operational rows are intentional; form refs preserve values across steps. */

import { useEffect, useMemo, useRef, useState } from "react";

type Screen = "home" | "classes" | "requests" | "schedule" | "instructors" | "approvals" | "notifications";
type ResponseChoice = "available" | "conditional" | "unavailable" | null;
type AdminIdentity = { name: string; email: string; role: "service_admin" | "super_admin" };

const navItems: { id: Screen; label: string; icon: string }[] = [
  { id: "home", label: "홈", icon: "⌂" },
  { id: "classes", label: "수업", icon: "▣" },
  { id: "requests", label: "배정 요청", icon: "↗" },
  { id: "schedule", label: "일정", icon: "□" },
  { id: "instructors", label: "강사", icon: "◎" },
  { id: "approvals", label: "회원 승인", icon: "✓" },
  { id: "notifications", label: "알림 이력", icon: "◷" },
];

type ClassListItem = {
  id: number | string;
  title: string;
  institution: string;
  date: string;
  time: string;
  place: string;
  status: string;
  tone: string;
  replies: string;
  lead: string;
  assistant: string;
  deadline: string;
  urgent: boolean;
};

type StoredClass = {
  id: string;
  title: string;
  institution: string;
  contact: string | null;
  class_date: string;
  start_time: string;
  end_time: string;
  address: string;
  target_group: string;
  grade: string;
  participant_count: number;
  description: string;
  lead_count: number;
  assistant_count: number;
  lead_fee: number;
  assistant_fee: number;
  fee_notes: string;
  response_deadline: string;
  status: ClassStatus;
  operational_status: ClassStatus;
  target_count: number;
  lead_response_count: number;
  assistant_response_count: number;
  conditional_count: number;
  instructor_names: string[];
  recruitment_targets: RecruitmentTarget[];
  assignments: Assignment[];
};

type ClassStatus = "registered" | "recruiting" | "reviewing" | "assignment_needed" | "assigned" | "completed" | "cancelled";
type ResponseStatus = "pending" | "available" | "conditional" | "unavailable";
type InstructorProfile = { user_id: string; full_name: string; email: string; status: string };
type RecruitmentResponse = { id: string; target_id: string; role: "lead" | "assistant"; status: ResponseStatus; condition: string | null; responded_at: string | null };
type RecruitmentTarget = { id: string; class_id: string; instructor_id: string; requested_role: "lead" | "assistant" | "both"; last_reminded_at: string | null; instructor: InstructorProfile | null; responses: RecruitmentResponse[] };
type Assignment = { id: string; instructor_id: string; role: "lead" | "assistant"; fee_snapshot: number; acknowledged_at: string | null; instructor: InstructorProfile | null };
type AdminNotification = { id: string; user_id: string; class_id: string | null; type: "class_request" | "class_reminder" | "assignment_confirmed" | "class_changed" | "class_cancelled"; title: string; body: string; action_url: string; read_at: string | null; created_at: string; recipient: { user_id: string; full_name: string; email: string } | null; class: { id: string; institution: string; title: string } | null };

const classStatusMeta: Record<ClassStatus, { label: string; tone: string; priority: number; description: string }> = {
  assignment_needed: { label: "배정 필요", tone: "red", priority: 0, description: "필요 인원을 확정해 주세요" },
  reviewing: { label: "응답 확인", tone: "amber", priority: 1, description: "조건부 응답을 확인해 주세요" },
  recruiting: { label: "모집 중", tone: "blue", priority: 2, description: "강사 응답을 기다리는 중" },
  registered: { label: "등록됨", tone: "gray", priority: 3, description: "모집 대상을 선택해 주세요" },
  assigned: { label: "배정 완료", tone: "green", priority: 4, description: "강사 배정이 완료됨" },
  completed: { label: "수업 완료", tone: "gray", priority: 5, description: "추가 작업 없음" },
  cancelled: { label: "취소", tone: "gray", priority: 6, description: "취소된 수업" },
};

const demoClasses: ClassListItem[] = [
  { id: 1, title: "AI 창의융합 체험 수업", institution: "성수중학교", date: "8월 12일 (수)", time: "10:00–12:00", place: "서울 성동구", status: "응답 대기", tone: "blue", replies: "8/12", lead: "후보 3명", assistant: "후보 2명", deadline: "오늘 18:00", urgent: true },
  { id: 2, title: "로봇 코딩 진로 캠프", institution: "한빛초등학교", date: "8월 13일 (목)", time: "09:30–12:30", place: "경기 고양시", status: "배정 필요", tone: "amber", replies: "9/10", lead: "후보 4명", assistant: "후보 3명", deadline: "마감 지남", urgent: true },
  { id: 3, title: "메타버스 콘텐츠 제작", institution: "서울미디어고", date: "8월 15일 (토)", time: "13:00–16:00", place: "서울 용산구", status: "배정 완료", tone: "green", replies: "7/7", lead: "김민준", assistant: "이지아", deadline: "완료", urgent: false },
  { id: 4, title: "디지털 리터러시 특강", institution: "마포청소년센터", date: "8월 18일 (화)", time: "14:00–16:00", place: "서울 마포구", status: "요청 전", tone: "gray", replies: "0/8", lead: "미확보", assistant: "미확보", deadline: "8월 14일", urgent: false },
];

const won = (value: number) => `${new Intl.NumberFormat("ko-KR").format(value)}원`;
const classDateLabel = (value: string) => new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${value}T00:00:00`));
const localDate = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const defaultClassDates = () => {
  const now = new Date();
  const classDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const deadlineDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return { classDate: localDate(classDate), deadlineDate: localDate(deadlineDate) };
};
const deadlineInputs = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "";
  return { deadlineDate: `${get("year")}-${get("month")}-${get("day")}`, deadlineTime: `${get("hour")}:${get("minute")}` };
};

const candidates = [
  { name: "김민준", initials: "김", role: "주강사", status: "가능", time: "오늘 10:24", subject: "AI · 코딩", region: "서울 전역", conflict: false, condition: "" },
  { name: "박서연", initials: "박", role: "주강사", status: "조건부", time: "오늘 09:48", subject: "AI · 메이커", region: "서울 동부", conflict: false, condition: "수업 시작 시간을 10시 30분으로 조정하면 가능합니다." },
  { name: "최현우", initials: "최", role: "보조강사", status: "가능", time: "어제 21:06", subject: "코딩 · 로봇", region: "서울·경기", conflict: true, condition: "" },
  { name: "이지아", initials: "이", role: "보조강사", status: "가능", time: "어제 19:42", subject: "AI · 콘텐츠", region: "서울 서부", conflict: false, condition: "" },
  { name: "정유진", initials: "정", role: "주강사", status: "불가능", time: "어제 18:30", subject: "AI · 데이터", region: "서울 전역", conflict: false, condition: "" },
  { name: "한도윤", initials: "한", role: "두 역할", status: "미응답", time: "최근 알림 어제 16:00", subject: "코딩 · 메이커", region: "서울 동부", conflict: false, condition: "" },
];

function recordAdminActivity(action: string, details: Record<string, unknown> = {}) {
  void fetch("/api/admin/activity", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, details }),
  });
}

function StatusBadge({ children, tone = "gray" }: { children: React.ReactNode; tone?: string }) {
  const icons: Record<string, string> = { green: "✓", amber: "!", red: "!", blue: "◷", gray: "·", mint: "✓" };
  return <span className={`status status-${tone}`}><span aria-hidden="true">{icons[tone] || "·"}</span>{children}</span>;
}

function RoleBadge({ role }: { role: string }) {
  return <span className={`role-badge ${role.includes("보조") ? "assistant" : role.includes("두") ? "both" : "lead"}`}>{role}</span>;
}

function Topbar({ screen, onInstructor, onCreate, onNotifications, notificationCount, admin }: { screen: Screen; onInstructor: () => void; onCreate: () => void; onNotifications: () => void; notificationCount: number; admin: AdminIdentity }) {
  const labels: Record<Screen, string> = { home: "홈", classes: "수업 관리", requests: "배정 요청", schedule: "전체 일정", instructors: "강사 관리", approvals: "회원 승인", notifications: "알림 발송 이력" };
  return (
    <header className="topbar">
      <div><p className="eyebrow">클래스플로우 운영센터</p><h1>{labels[screen]}</h1></div>
      <div className="top-actions">
        <button className="icon-btn" aria-label={notificationCount ? `알림 이력, 미확인 ${notificationCount}건` : "알림 이력"} onClick={onNotifications}><span aria-hidden="true">♢</span>{notificationCount > 0 && <i />}</button>
        <button className="button secondary instructor-preview" onClick={onInstructor}>강사 화면 보기 <span>→</span></button>
        <button className="button primary" onClick={onCreate}><span aria-hidden="true">＋</span> 수업 등록</button>
        <div className="profile" title={admin.email}><span>{admin.name}</span><b>{admin.name[0]}</b></div>
        <a className="button ghost top-settings-button" href="/settings">설정</a>
        <a className="button ghost logout-button" href="/auth/signout">로그아웃</a>
      </div>
    </header>
  );
}

function Sidebar({ screen, setScreen, canManageMembers, badges }: { screen: Screen; setScreen: (s: Screen) => void; canManageMembers: boolean; badges: Partial<Record<Screen, number>> }) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => setScreen("home")}><span className="brand-mark">C</span><span>클래스플로우<small>Instructor Ops</small></span></button>
      <nav aria-label="주 메뉴">
        {navItems.filter(item => item.id !== "approvals" || canManageMembers).map(item => { const badge = badges[item.id] ?? 0; return <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => setScreen(item.id)}><span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.label}{badge > 0 ? <em>{badge}</em> : null}</button>; })}
      </nav>
      <div className="sidebar-help"><span aria-hidden="true">?</span><div><b>도움이 필요하신가요?</b><small>운영 가이드 확인하기</small></div></div>
      <a className="settings" href="/settings"><span aria-hidden="true">⚙</span> 설정</a>
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
          {demoClasses.slice(0, 3).map((item, idx) => <button className="action-item" key={item.id} onClick={() => go(idx === 2 ? "schedule" : "requests")}>
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

type PeriodFilter = "all" | "today" | "week" | "month" | "custom";

function ClassesScreen({ onCreate, openClass, onDeleted, classItems, loading, error }: { onCreate: () => void; openClass: (item: StoredClass, tab?: "detail" | "recruitment" | "responses" | "assignment") => void; onDeleted: (classId: string) => void; classItems: StoredClass[]; loading: boolean; error: string }) {
  const [filter, setFilter] = useState("전체");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(today); endOfWeek.setDate(today.getDate() + 6);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const filterStatus: Record<string, ClassStatus[]> = { "모집 중": ["recruiting", "reviewing"], "배정 필요": ["assignment_needed"], "배정 완료": ["assigned"], "완료": ["completed"], "취소": ["cancelled"] };
  const visible = classItems.filter(item => {
    const matchesStatus = filter === "전체" || filterStatus[filter]?.includes(item.operational_status);
    const matchesQuery = !normalizedQuery || [item.title, item.institution, item.address, ...item.instructor_names].some(value => value.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
    const date = new Date(`${item.class_date}T00:00:00`);
    const matchesPeriod = period === "all" || period === "today" && date.getTime() === today.getTime() || period === "week" && date >= today && date <= endOfWeek || period === "month" && date >= today && date <= endOfMonth || period === "custom" && (!from || item.class_date >= from) && (!to || item.class_date <= to);
    return matchesStatus && matchesQuery && matchesPeriod;
  }).sort((a, b) => classStatusMeta[a.operational_status].priority - classStatusMeta[b.operational_status].priority || a.class_date.localeCompare(b.class_date));

  async function deleteClass(item: StoredClass) {
    if (!window.confirm(`“${item.institution} · ${item.title}” 수업을 삭제할까요?\n삭제한 수업은 복구할 수 없습니다.`)) return;
    setDeletingId(item.id);
    setDeleteError("");
    const response = await fetch(`/api/admin/classes/${item.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    setDeletingId(null);
    if (!response.ok) {
      setDeleteError(result?.error === "class_delete_locked" ? "모집 또는 배정이 시작된 수업은 기록 보호를 위해 삭제할 수 없습니다. 수업 취소를 사용해 주세요." : "수업을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    onDeleted(item.id);
  }

  return <div className="screen-stack class-console">
    <section className="class-console-heading"><div><span className="section-kicker">CLASS OPERATIONS</span><h2>수업 운영 콘솔</h2><p>지금 처리가 필요한 수업부터 확인하고 모집과 배정을 이어가세요.</p></div><button className="button primary" onClick={onCreate}>＋ 새 수업 등록</button></section>
    <section className="panel class-console-filters"><div className="search"><span aria-hidden="true">⌕</span><input aria-label="수업 검색" placeholder="기관명 / 수업명 / 강사명 검색" value={query} onChange={event => setQuery(event.target.value)} /></div><div className="filter-tabs">{["전체", "모집 중", "배정 필요", "배정 완료", "완료", "취소"].map(value => <button className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{value}</button>)}</div><div className="period-filter"><span>기간</span>{([['all','전체'],['today','오늘'],['week','이번 주'],['month','이번 달'],['custom','직접 선택']] as const).map(([value,label]) => <button className={period === value ? "active" : ""} onClick={() => setPeriod(value)} key={value}>{label}</button>)}</div>{period === "custom" && <div className="custom-period"><label>시작일<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><span>–</span><label>종료일<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div>}</section>
    <section className="panel class-operations-list"><header><p><b>{visible.length}개 수업</b><span>처리 필요 상태 → 가까운 수업일 순</span></p></header>{deleteError && <div className="class-list-error" role="alert">{deleteError}</div>}{loading && <div className="empty-state">실제 수업 정보를 불러오는 중입니다.</div>}{error && <div className="empty-state error-state">{error}</div>}{!loading && !error && visible.map(item => { const meta = classStatusMeta[item.operational_status]; return <article className={`class-operation-row status-${meta.tone}`} key={item.id} role="button" tabIndex={0} onClick={() => openClass(item)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openClass(item); } }}><div className="class-operation-main"><div className="class-operation-status"><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge><small>{meta.description}</small></div><h3>{item.institution} · {item.title}</h3><p>{classDateLabel(item.class_date)} {item.start_time.slice(0,5)}~{item.end_time.slice(0,5)}<span>·</span>{item.address}</p><div className="class-operation-fees"><b>주강사 {item.lead_count}명 · {won(item.lead_fee)}</b><b>보조강사 {item.assistant_count}명 · {item.assistant_count ? `1인당 ${won(item.assistant_fee)}` : "모집 없음"}</b></div></div><div className="class-operation-progress"><span>모집 현황</span><strong>주강사 {item.lead_response_count}명 응답 · 보조강사 {item.assistant_response_count}명 응답</strong><small>모집 대상 {item.target_count}명 · 응답 마감 {new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(item.response_deadline))}</small></div><div className="class-operation-actions"><button className="button secondary" onClick={event => { event.stopPropagation(); openClass(item, item.target_count ? "responses" : "recruitment"); }}>{item.target_count ? "응답 현황" : "강사 모집"}</button><button className="button primary" disabled={item.operational_status !== "assignment_needed" && item.operational_status !== "reviewing"} onClick={event => { event.stopPropagation(); openClass(item, "assignment"); }}>배정하기</button><button className="button danger class-delete-button" disabled={deletingId === item.id || item.status !== "registered" || item.target_count > 0} title={item.status === "registered" && item.target_count === 0 ? "수업 삭제" : "모집 전 등록 상태에서만 삭제할 수 있습니다"} onClick={event => { event.stopPropagation(); void deleteClass(item); }}>{deletingId === item.id ? "삭제 중…" : "삭제"}</button></div></article>; })}{!loading && !error && visible.length === 0 && <div className="empty-state"><b>조건에 맞는 수업이 없습니다.</b><p>새 수업을 등록하거나 검색·필터 조건을 바꿔보세요.</p></div>}</section>
  </div>;
}

type ClassWorkspaceTab = "detail" | "recruitment" | "responses" | "assignment";
type RecruitableInstructor = { user_id: string; full_name: string; email: string };

function targetResponseStatus(target: RecruitmentTarget): ResponseStatus {
  const statuses = target.responses.map(response => response.status);
  if (statuses.includes("conditional")) return "conditional";
  if (statuses.includes("available")) return "available";
  if (statuses.length > 0 && statuses.every(status => status === "unavailable")) return "unavailable";
  return "pending";
}

function ResponseOperations({ classItem, onAssignment }: { classItem: StoredClass; onAssignment: () => void }) {
  const [filter, setFilter] = useState<"all" | ResponseStatus>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const availableLead = classItem.recruitment_targets.filter(target => target.responses.some(response => response.role === "lead" && ["available", "conditional"].includes(response.status))).length;
  const availableAssistant = classItem.recruitment_targets.filter(target => target.responses.some(response => response.role === "assistant" && ["available", "conditional"].includes(response.status))).length;
  const counts = classItem.recruitment_targets.reduce((result, target) => ({ ...result, [targetResponseStatus(target)]: result[targetResponseStatus(target)] + 1 }), { pending: 0, available: 0, conditional: 0, unavailable: 0 });
  const visible = classItem.recruitment_targets.filter(target => filter === "all" || targetResponseStatus(target) === filter);
  const responseLabel: Record<ResponseStatus, string> = { pending: "미응답", available: "가능", conditional: "조건부 가능", unavailable: "불가능" };

  const toggle = (targetId: string) => setSelectedIds(current => current.includes(targetId) ? current.filter(id => id !== targetId) : [...current, targetId]);

  async function sendReminder() {
    if (!selectedIds.length) return;
    setSending(true); setError(""); setFeedback("");
    const response = await fetch(`/api/admin/classes/${classItem.id}/reminders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetIds: selectedIds, requestKey: crypto.randomUUID() }),
    });
    const data = await response.json() as { internal?: number; push?: { sent: number; failed: number; unavailable: number }; error?: string };
    setSending(false);
    if (!response.ok) { setError(data.error === "pending_target_required" ? "미응답 역할이 남아 있는 강사만 재알림할 수 있습니다." : "재알림을 저장하지 못했습니다."); return; }
    setFeedback(`내부 알림 ${data.internal ?? selectedIds.length}건을 저장했고 웹 푸시 ${data.push?.sent ?? 0}건을 전송했습니다.${data.push?.unavailable ? ` 푸시 미등록 ${data.push.unavailable}명은 내부 알림으로 확인할 수 있습니다.` : ""}`);
    setSelectedIds([]);
  }

  async function shareToKakao() {
    const text = [`[NGN-X 강사 모집]`, `${classItem.institution} · ${classItem.title}`, `${classDateLabel(classItem.class_date)} ${classItem.start_time.slice(0,5)}~${classItem.end_time.slice(0,5)}`, `주강사 ${classItem.lead_count}명 · ${won(classItem.lead_fee)} / 보조강사 ${classItem.assistant_count}명 · 1인당 ${won(classItem.assistant_fee)}`, `응답 마감 ${new Date(classItem.response_deadline).toLocaleString("ko-KR")}`, `${location.origin}/instructor/dashboard`].join("\n");
    try {
      if (navigator.share) await navigator.share({ title: `${classItem.title} 강사 모집`, text });
      else { await navigator.clipboard.writeText(text); setFeedback("모집 안내를 복사했습니다. 카카오톡 대화방에 붙여 넣어 주세요."); }
    } catch (shareError) {
      if ((shareError as Error).name !== "AbortError") setError("공유 내용을 준비하지 못했습니다.");
    }
  }

  return <section className="panel response-operations">
    <header><div><h3>실시간 응답 현황</h3><p>요청 {classItem.target_count}명 · 가능 {counts.available} · 조건부 {counts.conditional} · 불가능 {counts.unavailable} · 미응답 {counts.pending}</p></div><div className="response-header-actions"><button className="button secondary" onClick={shareToKakao}>카카오톡으로 공유</button><button className="button primary" disabled={availableLead < 1 || availableAssistant < classItem.assistant_count} onClick={onAssignment}>배정 후보 선택 →</button></div></header>
    <div className="response-readiness"><article className={availableLead >= 1 ? "ready" : "shortage"}><span>주강사 1명 필요</span><b>가능 후보 {availableLead}명 확보 {availableLead >= 1 ? "✓" : "필요"}</b></article><article className={availableAssistant >= classItem.assistant_count ? "ready" : "shortage"}><span>보조강사 {classItem.assistant_count}명 필요</span><b>가능 후보 {availableAssistant}명 확보 {availableAssistant >= classItem.assistant_count ? "✓" : "필요"}</b></article></div>
    {feedback && <div className="response-feedback success">{feedback}</div>}{error && <div className="response-feedback error">{error}</div>}
    <div className="response-toolbar"><div className="filter-tabs">{([['all','전체'],['available','가능'],['conditional','조건부'],['unavailable','불가능'],['pending','미응답']] as const).map(([value,label]) => <button className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{label} {value === "all" ? classItem.target_count : counts[value]}</button>)}</div><button className="button secondary" disabled={!selectedIds.length || sending} onClick={sendReminder}>{sending ? "전송 중…" : `선택 ${selectedIds.length}명 재알림`}</button></div>
    <div className="response-operations-table"><div className="response-operations-head real"><span>선택</span><span>강사</span><span>모집 역할</span><span>응답</span><span>조건</span><span>응답 시각</span></div>{visible.map(target => { const pending = target.responses.some(response => response.status === "pending"); const status = targetResponseStatus(target); const latest = target.responses.map(response => response.responded_at).filter((value): value is string => Boolean(value)).sort().at(-1); const roleResponses = target.responses.map(response => `${response.role === "lead" ? "주" : "보"} ${responseLabel[response.status]}`).join(" · "); const conditional = target.responses.find(response => response.condition); return <div className="response-operations-row real" key={target.id}><span><input aria-label={`${target.instructor?.full_name ?? "강사"} 재알림 선택`} type="checkbox" disabled={!pending} checked={selectedIds.includes(target.id)} onChange={() => toggle(target.id)} /></span><span><b>{target.instructor?.full_name ?? "강사"}</b><small>{target.instructor?.email}</small></span><span><RoleBadge role={target.requested_role === "lead" ? "주강사" : target.requested_role === "assistant" ? "보조강사" : "두 역할"} /></span><span><StatusBadge tone={status === "available" ? "green" : status === "conditional" ? "amber" : status === "unavailable" ? "red" : "gray"}>{roleResponses || "미응답"}</StatusBadge></span><span>{conditional?.condition || "—"}</span><span>{latest ? new Date(latest).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}{target.last_reminded_at && <small>재알림 {new Date(target.last_reminded_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small>}</span></div>; })}{classItem.recruitment_targets.length === 0 && <div className="empty-state">아직 모집 대상이 없습니다. 강사 모집 단계에서 대상을 선택해 주세요.</div>}</div>
  </section>;
}

function ClassWorkspace({ classItem, initialTab, onBack, onUpdated }: { classItem: StoredClass; initialTab: ClassWorkspaceTab; onBack: () => void; onUpdated: (item: StoredClass) => void }) {
  const [tab, setTab] = useState<ClassWorkspaceTab>(initialTab);
  const [instructors, setInstructors] = useState<RecruitableInstructor[]>([]);
  const [selected, setSelected] = useState<Record<string, "lead" | "assistant" | "both">>(Object.fromEntries(classItem.recruitment_targets.map(target => [target.instructor_id, target.requested_role])));
  const [leadId, setLeadId] = useState(classItem.assignments.find(item => item.role === "lead")?.instructor_id ?? "");
  const [assistantIds, setAssistantIds] = useState<string[]>(classItem.assignments.filter(item => item.role === "assistant").map(item => item.instructor_id));
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/members", { cache: "no-store" }).then(response => response.ok ? response.json() : Promise.reject()).then((data: { members: Array<RecruitableInstructor & { role: string; status: string }> }) => setInstructors(data.members.filter(item => item.role === "instructor" && item.status === "active"))).catch(() => setError("모집 가능한 강사를 불러오지 못했습니다."));
  }, []);

  const availableLead = classItem.recruitment_targets.filter(target => target.responses.some(response => response.role === "lead" && ["available", "conditional"].includes(response.status)));
  const availableAssistants = classItem.recruitment_targets.filter(target => target.responses.some(response => response.role === "assistant" && ["available", "conditional"].includes(response.status)));

  async function saveRecruitment() {
    const targets = Object.entries(selected).map(([instructorId, requestedRole]) => ({ instructorId, requestedRole }));
    if (targets.length === 0) { setError("최소 한 명의 모집 대상 강사를 선택해 주세요."); return; }
    setSaving(true); setError(""); setMessage("");
    const response = await fetch(`/api/admin/classes/${classItem.id}/recruitment`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targets }) });
    const data = await response.json() as { class?: StoredClass; error?: string };
    setSaving(false);
    if (!response.ok || !data.class) { setError(data.error === "responses_already_exist" ? "이미 응답이 시작되어 모집 대상을 바꿀 수 없습니다." : "강사 모집을 시작하지 못했습니다."); return; }
    onUpdated(data.class); setMessage("선택한 강사를 모집 대상으로 저장했습니다."); setTab("responses");
  }

  async function finalizeAssignment() {
    if (!leadId) { setError("주강사 1명을 선택해 주세요."); return; }
    if (assistantIds.length !== classItem.assistant_count) { setError(`보조강사 ${classItem.assistant_count}명을 선택해 주세요.`); return; }
    setSaving(true); setError(""); setMessage("");
    const response = await fetch(`/api/admin/classes/${classItem.id}/assignments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadInstructorId: leadId, assistantInstructorIds: assistantIds }) });
    const data = await response.json() as { class?: StoredClass; error?: string };
    setSaving(false);
    if (!response.ok || !data.class) { setError(data.error === "assignment_unchanged" ? "변경된 강사가 없습니다." : "배정을 저장하지 못했습니다. 역할별 응답과 필요 인원을 확인해 주세요."); return; }
    onUpdated(data.class); setMessage(classItem.status === "assigned" ? "강사 배정을 변경하고 관련 강사에게 결과를 알렸습니다." : "주강사와 보조강사 배정을 확정했습니다.");
  }

  async function changeStatus(status: "completed" | "cancelled") {
    if (status === "cancelled" && !window.confirm("이 수업을 취소할까요? 모집·배정된 강사에게 취소 알림이 저장됩니다.")) return;
    setSaving(true); setError(""); setMessage("");
    const response = await fetch(`/api/admin/classes/${classItem.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    const data = await response.json() as { class?: StoredClass; error?: string };
    setSaving(false);
    if (!response.ok || !data.class) { setError("수업 상태를 변경하지 못했습니다."); return; }
    onUpdated(data.class); setMessage(status === "cancelled" ? "수업을 취소하고 관련 강사에게 알림을 저장했습니다." : "수업을 완료 처리했습니다.");
  }

  return <div className="screen-stack class-workspace">
    <button className="text-button workspace-back" onClick={onBack}>← 수업 목록으로</button>
    <section className="panel class-workspace-hero"><div><span className="section-kicker">{classItem.institution} · {classItem.id.slice(0,8).toUpperCase()}</span><h2>{classItem.title}</h2><p>{classDateLabel(classItem.class_date)} {classItem.start_time.slice(0,5)}~{classItem.end_time.slice(0,5)} · {classItem.address}</p></div><div><StatusBadge tone={classStatusMeta[classItem.operational_status].tone}>{classStatusMeta[classItem.operational_status].label}</StatusBadge><small>{classStatusMeta[classItem.operational_status].description}</small></div></section>
    <nav className="panel class-workspace-tabs" aria-label="수업 운영 단계">{([['detail','수업 상세'],['recruitment','강사 모집'],['responses','응답 현황'],['assignment','최종 배정']] as const).map(([value,label], index) => <button className={tab === value ? "active" : ""} onClick={() => setTab(value)} key={value}><span>{index + 1}</span>{label}</button>)}</nav>
    {message && <div className="notice-banner"><span>✓</span><div><b>{message}</b></div></div>}{error && <div className="notice-banner error-banner"><span>!</span><div><b>{error}</b></div></div>}
    {tab === "detail" && <><div className="class-detail-actions"><button className="button secondary" disabled={saving || ["completed","cancelled"].includes(classItem.status)} onClick={() => setEditing(true)}>수업 정보 수정</button><button className="button secondary" disabled={saving || classItem.status !== "assigned"} onClick={() => changeStatus("completed")}>수업 완료</button><button className="button danger" disabled={saving || ["completed","cancelled"].includes(classItem.status)} onClick={() => changeStatus("cancelled")}>수업 취소</button></div><div className="class-detail-grid"><section className="panel class-detail-card"><header><h3>수업 정보</h3></header><dl><div><dt>기관·담당자</dt><dd>{classItem.institution}<small>{classItem.contact || "담당자 정보 없음"}</small></dd></div><div><dt>일정</dt><dd>{classDateLabel(classItem.class_date)} {classItem.start_time.slice(0,5)}~{classItem.end_time.slice(0,5)}</dd></div><div><dt>장소</dt><dd>{classItem.address}</dd></div><div><dt>대상</dt><dd>{classItem.target_group} · {classItem.grade} · {classItem.participant_count}명</dd></div><div className="wide"><dt>수업 내용</dt><dd>{classItem.description || "등록된 설명이 없습니다."}</dd></div></dl></section><section className="panel class-detail-card"><header><h3>강사·수업료</h3></header><div className="detail-role-fee"><article><RoleBadge role="주강사" /><b>{classItem.lead_count}명</b><strong>{won(classItem.lead_fee)}</strong></article><article><RoleBadge role="보조강사" /><b>{classItem.assistant_count}명</b><strong>{classItem.assistant_count ? `1인당 ${won(classItem.assistant_fee)}` : "모집 없음"}</strong></article></div><p>{classItem.fee_notes || "추가 수업료 안내 없음"}</p>{classItem.assignments.length > 0 && <div className="assignment-confirmation-list">{classItem.assignments.map(assignment => <p key={assignment.id}><b>{assignment.instructor?.full_name} · {assignment.role === "lead" ? "주강사" : "보조강사"}</b><span>{assignment.acknowledged_at ? `확인 완료 ${new Date(assignment.acknowledged_at).toLocaleString("ko-KR")}` : "확인 대기"}</span></p>)}</div>}<button className="button primary" disabled={["completed","cancelled"].includes(classItem.status)} onClick={() => setTab("recruitment")}>{classItem.target_count ? "모집 대상 확인" : "강사 모집 시작"} →</button></section></div></>}
    {tab === "recruitment" && <section className="panel recruitment-picker"><header><div><h3>모집 대상 강사 선택</h3><p>강사마다 주강사·보조강사·두 역할 모두 중 하나를 지정합니다.</p></div><button className="button primary" disabled={saving} onClick={saveRecruitment}>{saving ? "저장 중…" : `선택 ${Object.keys(selected).length}명 모집 시작`}</button></header><div className="recruitment-list">{instructors.map(instructor => { const role = selected[instructor.user_id]; return <article key={instructor.user_id}><label><input type="checkbox" checked={Boolean(role)} onChange={() => setSelected(current => { const next = { ...current }; if (next[instructor.user_id]) delete next[instructor.user_id]; else next[instructor.user_id] = "both"; return next; })} /><span className="avatar">{instructor.full_name[0]}</span><span><b>{instructor.full_name}</b><small>{instructor.email}</small></span></label><select aria-label={`${instructor.full_name} 모집 역할`} disabled={!role} value={role ?? "both"} onChange={event => setSelected(current => ({ ...current, [instructor.user_id]: event.target.value as "lead" | "assistant" | "both" }))}><option value="lead">주강사</option><option value="assistant">보조강사</option><option value="both">두 역할 모두</option></select></article>; })}{instructors.length === 0 && <div className="empty-state">현재 모집 가능한 활성 강사가 없습니다.</div>}</div></section>}
    {tab === "responses" && <ResponseOperations classItem={classItem} onAssignment={() => setTab("assignment")} />}
    {tab === "assignment" && <section className="panel assignment-picker"><header><div><h3>최종 배정</h3><p>{classItem.status === "assigned" ? "확정 강사를 변경하면 기존 강사와 새 강사 모두에게 결과가 안내됩니다." : "가능 또는 조건부 가능으로 응답한 강사만 배정할 수 있습니다."}</p></div><button className="button primary" disabled={saving || !leadId || assistantIds.length !== classItem.assistant_count} onClick={finalizeAssignment}>{saving ? "저장 중…" : classItem.status === "assigned" ? "배정 변경 저장" : "최종 배정 확정"}</button></header><div className="assignment-role-grid"><section><h4><RoleBadge role="주강사" /> 1명 선택 · {won(classItem.lead_fee)}</h4>{availableLead.map(target => <label className={leadId === target.instructor_id ? "selected" : ""} key={target.id}><input type="radio" name="lead" checked={leadId === target.instructor_id} onChange={() => setLeadId(target.instructor_id)} /><span>{target.instructor?.full_name}<small>{target.responses.find(response => response.role === "lead")?.condition || "가능 응답"}</small></span></label>)}{availableLead.length === 0 && <p>배정 가능한 주강사 응답이 없습니다.</p>}</section><section><h4><RoleBadge role="보조강사" /> {classItem.assistant_count}명 선택 · 1인당 {won(classItem.assistant_fee)}</h4>{availableAssistants.map(target => <label className={assistantIds.includes(target.instructor_id) ? "selected" : ""} key={target.id}><input type="checkbox" checked={assistantIds.includes(target.instructor_id)} onChange={() => setAssistantIds(current => current.includes(target.instructor_id) ? current.filter(id => id !== target.instructor_id) : current.length < classItem.assistant_count ? [...current, target.instructor_id] : current)} /><span>{target.instructor?.full_name}<small>{target.responses.find(response => response.role === "assistant")?.condition || "가능 응답"}</small></span></label>)}{classItem.assistant_count === 0 && <p>이 수업은 보조강사를 모집하지 않습니다.</p>}{classItem.assistant_count > 0 && availableAssistants.length === 0 && <p>배정 가능한 보조강사 응답이 없습니다.</p>}</section></div></section>}
    {editing && <ClassEditForm classItem={classItem} close={() => setEditing(false)} onSaved={item => { onUpdated(item); setEditing(false); setMessage("수업 정보를 수정하고 관련 강사에게 변경 알림을 저장했습니다."); }} />}
  </div>;
}

function RequestsScreen() {
  const [statusFilter, setStatusFilter] = useState("전체");
  const [query, setQuery] = useState("");
  const [assigned, setAssigned] = useState<string[]>(["김민준"]);
  const [confirmed, setConfirmed] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const filtered = candidates.filter(c => {
    const matchesStatus = statusFilter === "전체" || c.status === statusFilter;
    const matchesQuery = !normalizedQuery || [c.name, c.subject, c.region, c.role].some(value => value.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
    return matchesStatus && matchesQuery;
  });
  const assignable = filtered.filter(c => c.status === "가능" || c.status === "조건부");
  const toggleAssign = (name: string) => {
    setConfirmed(false);
    setAssigned(v => v.includes(name) ? v.filter(n => n !== name) : [...v, name]);
  };
  const toggleAllAssignable = () => {
    setConfirmed(false);
    const visibleNames = assignable.map(candidate => candidate.name);
    const allSelected = visibleNames.length > 0 && visibleNames.every(name => assigned.includes(name));
    setAssigned(current => allSelected ? current.filter(name => !visibleNames.includes(name)) : [...new Set([...current, ...visibleNames])]);
  };
  const confirmAssignment = () => {
    recordAdminActivity("assignment_confirmed", { class_name: "AI 창의융합 체험 수업", instructors: assigned });
    setConfirmed(true);
  };
  return <div className="request-layout">
    {confirmed && <section className="notice-banner"><span>✓</span><div><b>강사 배정이 완료됐어요</b><p>선택한 주강사 1명과 보조강사 2명에게 확정 알림을 보냈습니다.</p></div></section>}
    <section className="panel request-hero"><div className="request-title"><button className="back-button">‹</button><div><span className="section-kicker">성수중학교 · 2026-0812-01</span><h2>AI 창의융합 체험 수업</h2><p>8월 12일 (수) 10:00–12:00 · 서울 성동구</p></div></div><div className="request-deadline"><span>응답 마감까지</span><strong>6시간 18분</strong><small>오늘 18:00 마감</small></div></section>
    <section className="role-requirements"><article><div><RoleBadge role="주강사" /><strong>1명 모집</strong></div><b>300,000원</b><span>후보 3명 확보</span></article><article><div><RoleBadge role="보조강사" /><strong>2명 모집</strong></div><b>1인당 150,000원</b><span>후보 2명 확보</span></article><article className="progress-card"><div><span>전체 응답</span><b>8 / 12명</b></div><div className="progress-track"><i style={{ width: "67%" }} /></div><small>미응답 4명 · 최근 알림 어제 16:00</small></article></section>
    <section className="panel response-board"><div className="board-head"><div className="filter-tabs">{["전체", "가능", "조건부", "불가능", "미응답"].map(f => <button className={statusFilter === f ? "active" : ""} onClick={() => setStatusFilter(f)} key={f}>{f}{f === "미응답" ? " 4" : ""}</button>)}</div><div className="board-actions"><div className="search compact"><span>⌕</span><input aria-label="강사 검색" placeholder="강사 검색" value={query} onChange={event => setQuery(event.target.value)} /></div></div></div>
      <div className="candidate-table"><div className="candidate-head"><span><input type="checkbox" aria-label="배정 가능 후보 전체 선택" disabled={assignable.length === 0} checked={assignable.length > 0 && assignable.every(c => assigned.includes(c.name))} onChange={toggleAllAssignable} /></span><span>강사</span><span>모집 역할</span><span>응답 상태</span><span>조건·충돌</span><span>배정 후보</span></div>{filtered.map(c => { const canAssign = c.status === "가능" || c.status === "조건부"; const isAssigned = assigned.includes(c.name); return <div className="candidate-row" key={c.name}><span><input type="checkbox" aria-label={`${c.name} 배정 후보 선택`} disabled={!canAssign} checked={canAssign && isAssigned} onChange={() => toggleAssign(c.name)} /></span><span className="person"><b>{c.initials}</b><span>{c.name}<small>{c.subject} · {c.region}</small></span></span><span><RoleBadge role={c.role} /></span><span><StatusBadge tone={c.status === "가능" ? "green" : c.status === "조건부" ? "amber" : c.status === "불가능" ? "red" : "gray"}>{c.status}</StatusBadge><small className="cell-note">{c.time}</small></span><span>{c.conflict ? <span className="conflict">! 확정 일정과 30분 겹침</span> : c.condition ? <span className="condition-text">“{c.condition}”</span> : <span className="muted">특이사항 없음</span>}</span><span>{canAssign ? <button className={`assign-toggle ${isAssigned ? "selected" : ""}`} aria-pressed={isAssigned} onClick={() => toggleAssign(c.name)}>{isAssigned ? "✓ 선택됨" : "후보 선택"}</button> : <span className="muted">—</span>}</span></div>; })}{filtered.length === 0 && <div className="empty-state">검색 조건에 맞는 강사가 없습니다.</div>}</div>
    </section>
    <section className="assignment-bar"><div><span>현재 배정 후보</span><div className="selected-people">{assigned.map((name, i) => <b key={name}>{name}<small>{i === 0 ? "주강사" : "보조강사"}</small></b>)}</div></div><p><span>주강사 <b>1/1</b></span><span>보조강사 <b>{Math.max(0, assigned.length - 1)}/2</b></span></p><button className="button primary" disabled={assigned.length < 3 || confirmed} onClick={confirmAssignment}>{confirmed ? "✓ 배정 완료" : "최종 배정 확인"}</button></section>
  </div>;
}

function ScheduleScreen({ classItems }: { classItems: StoredClass[] }) {
  const [view, setView] = useState<"week" | "month">("week");
  const [cursor, setCursor] = useState(() => new Date());
  const todayKey = localDate(new Date());
  const scheduledClasses = classItems.filter(item => item.status === "assigned" || item.status === "completed");
  const assignedInstructorCount = new Set(scheduledClasses.flatMap(item => item.assignments.map(assignment => assignment.instructor_id))).size;
  const weekStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 5 }, (_, index) => { const day = new Date(weekStart); day.setDate(weekStart.getDate() + index); return day; });
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthGridStart = new Date(monthStart); monthGridStart.setDate(1 - monthStart.getDay());
  const monthDays = Array.from({ length: 42 }, (_, index) => { const day = new Date(monthGridStart); day.setDate(monthGridStart.getDate() + index); return day; });
  const dateKey = (date: Date) => localDate(date);
  const classesForDate = (date: Date) => scheduledClasses.filter(item => item.class_date === dateKey(date));
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 4);
  const periodClasses = view === "week" ? scheduledClasses.filter(item => item.class_date >= dateKey(weekStart) && item.class_date <= dateKey(weekEnd)) : scheduledClasses.filter(item => item.class_date.startsWith(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`));
  const title = view === "week"
    ? `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일 – ${weekEnd.getMonth() + 1}월 ${weekEnd.getDate()}일`
    : `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;
  const movePeriod = (amount: number) => setCursor(current => view === "week" ? new Date(current.getFullYear(), current.getMonth(), current.getDate() + amount * 7) : new Date(current.getFullYear(), current.getMonth() + amount, 1));

  return <div className="screen-stack"><section className="toolbar"><div><h2 className="content-title">{title}</h2><p className="content-subtitle">확정 수업 {periodClasses.length}건 · 전체 배정 강사 {assignedInstructorCount}명</p></div><div className="calendar-controls"><button aria-label={view === "week" ? "이전 주" : "이전 달"} onClick={() => movePeriod(-1)}>‹</button><button onClick={() => setCursor(new Date())}>오늘</button><button aria-label={view === "week" ? "다음 주" : "다음 달"} onClick={() => movePeriod(1)}>›</button></div><div className="filter-tabs" role="group" aria-label="일정 보기"><button className={view === "week" ? "active" : ""} aria-pressed={view === "week"} onClick={() => setView("week")}>주간</button><button className={view === "month" ? "active" : ""} aria-pressed={view === "month"} onClick={() => setView("month")}>월간</button></div></section>{view === "week" ? <section className="panel calendar"><div className="calendar-grid"><div className="time-column head" />{weekDays.map(day => <div className={`day-head ${dateKey(day) === todayKey ? "today" : ""}`} key={dateKey(day)}><b>{new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(day)}</b><span>{day.getDate()}</span></div>)}{["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"].map((time, row) => <div className="calendar-row" key={time} style={{ gridRow: row + 2 }}><div className="time-label">{time}</div>{weekDays.map(day => <div className="calendar-cell" key={dateKey(day)} />)}</div>)}{weekDays.flatMap((day, dayIndex) => classesForDate(day).map((item, itemIndex) => { const startHour = Number(item.start_time.slice(0, 2)); const startMinute = Number(item.start_time.slice(3, 5)); const endHour = Number(item.end_time.slice(0, 2)); const endMinute = Number(item.end_time.slice(3, 5)); const duration = Math.max(1, Math.ceil((endHour * 60 + endMinute - startHour * 60 - startMinute) / 60)); return <article className={`calendar-event ${["blue", "mint", "purple"][itemIndex % 3]}`} style={{ gridColumn: dayIndex + 2, gridRow: `${Math.max(2, startHour - 7)} / span ${duration}` }} key={item.id}><b>{item.title}</b><span>{item.institution}</span><small>{item.start_time.slice(0,5)}~{item.end_time.slice(0,5)} · {item.instructor_names.join(" · ") || "강사 확인 중"}</small></article>; }))}</div>{periodClasses.length === 0 && <div className="calendar-empty">이 기간에 배정 완료된 수업이 없습니다.</div>}</section> : <section className="panel month-calendar"><div className="month-weekdays">{["일", "월", "화", "수", "목", "금", "토"].map(day => <span key={day}>{day}</span>)}</div><div className="month-grid">{monthDays.map(day => { const events = classesForDate(day); const key = dateKey(day); return <article className={`${day.getMonth() !== cursor.getMonth() ? "outside" : ""} ${key === todayKey ? "today" : ""}`} key={key}><header><span>{day.getDate()}</span>{key === todayKey && <small>오늘</small>}</header><div>{events.slice(0, 3).map(item => <p className={`month-event ${item.status}`} key={item.id}><time>{item.start_time.slice(0,5)}</time><b>{item.title}</b><small>{item.institution}</small></p>)}{events.length > 3 && <button className="month-more">+{events.length - 3}건 더 보기</button>}</div></article>; })}</div></section>}</div>;
}

function InstructorsScreen({ onPendingResolved }: { onPendingResolved: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"전체" | "활성" | "승인 대기" | "비활성">("전체");
  const [instructorMembers, setInstructorMembers] = useState<MemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/members", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("instructors_unavailable");
        return response.json() as Promise<{ members: MemberRecord[] }>;
      })
      .then(data => setInstructorMembers(data.members.filter(member => member.role === "instructor")))
      .catch(() => setError("가입 강사 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."))
      .finally(() => setLoading(false));
  }, []);

  async function toggleInstructor(member: MemberRecord) {
    const nextStatus: MemberRecord["status"] = member.status === "active" ? "suspended" : "active";
    if (nextStatus === "suspended" && !window.confirm(`${member.full_name} 강사 계정을 비활성화할까요?\n비활성 계정은 강사센터에 로그인할 수 없습니다.`)) return;
    setSavingId(member.user_id);
    setError("");
    setFeedback("");
    const response = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: member.user_id, role: "instructor", status: nextStatus }),
    });
    setSavingId(null);
    if (!response.ok) {
      setError("강사 계정 상태를 변경하지 못했습니다. 관리자 권한을 확인해 주세요.");
      return;
    }
    setInstructorMembers(current => current.map(item => item.user_id === member.user_id ? { ...item, status: nextStatus } : item));
    if (member.status === "pending" && nextStatus === "active") onPendingResolved();
    setFeedback(`${member.full_name} 강사 계정을 ${nextStatus === "active" ? "활성화" : "비활성화"}했습니다.`);
  }

  const statusLabel: Record<MemberRecord["status"], "활성" | "승인 대기" | "비활성"> = {
    active: "활성",
    pending: "승인 대기",
    suspended: "비활성",
  };
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const visible = instructorMembers.filter(member => {
    const matchesState = filter === "전체" || statusLabel[member.status] === filter;
    const matchesQuery = !normalizedQuery || [member.full_name, member.email].some(value => value.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
    return matchesState && matchesQuery;
  });
  const filters = ["전체", "활성", "승인 대기", "비활성"] as const;
  return <div className="screen-stack"><section className="toolbar"><div className="search"><span>⌕</span><input aria-label="강사 검색" placeholder="강사명 또는 이메일 검색" value={query} onChange={event => setQuery(event.target.value)} /></div><div className="filter-tabs">{filters.map(value => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value} {value === "전체" ? instructorMembers.length : instructorMembers.filter(member => statusLabel[member.status] === value).length}</button>)}</div></section>{feedback && <section className="notice-banner"><span>✓</span><div><b>{feedback}</b></div></section>}{error && <section className="notice-banner error-banner"><span>!</span><div><b>강사 계정 상태를 변경할 수 없습니다</b><p>{error}</p></div></section>}<section className="instructor-grid">{loading && <div className="panel empty-state">실제 가입 강사 정보를 불러오는 중입니다.</div>}{!loading && visible.map((member, i) => <article className="panel instructor-card" key={member.user_id}><div className="instructor-card-head"><span className={`avatar avatar-${i % 4}`}>{member.full_name[0]}</span><div><h3>{member.full_name}</h3><p>{member.email}</p></div><StatusBadge tone={member.status === "active" ? "green" : member.status === "pending" ? "amber" : "red"}>{statusLabel[member.status]}</StatusBadge></div><dl><div><dt>가입일</dt><dd>{new Date(member.created_at).toLocaleDateString("ko-KR")}</dd></div><div><dt>회원 유형</dt><dd>강사</dd></div><div><dt>계정 상태</dt><dd>{statusLabel[member.status]}</dd></div></dl><button className={`button instructor-status-button ${member.status === "active" ? "danger" : "secondary"}`} disabled={savingId === member.user_id} onClick={() => void toggleInstructor(member)}>{savingId === member.user_id ? "변경 중…" : member.status === "active" ? "비활성화" : "활성화"}</button></article>)}{!loading && !error && visible.length === 0 && <div className="panel empty-state">검색 조건에 맞는 실제 가입 강사가 없습니다.</div>}</section></div>;
}

type MemberRecord = {
  user_id: string;
  email: string;
  full_name: string;
  role: "instructor" | "company_member" | "service_admin" | "super_admin";
  status: "pending" | "active" | "suspended";
  created_at: string;
};

function ApprovalsScreen({ currentRole, onPendingCountChange }: { currentRole: AdminIdentity["role"]; onPendingCountChange: (count: number) => void }) {
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
        onPendingCountChange(data.members.filter(member => member.status === "pending").length);
      })
      .catch(() => setError("회원 정보를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [onPendingCountChange]);

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

    setMembers(current => {
      const next = current.map(item => item.user_id === member.user_id ? { ...item, role: roles[member.user_id], status } : item);
      onPendingCountChange(next.filter(item => item.status === "pending").length);
      return next;
    });
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

function NotificationsScreen({ notifications, loading, error }: { notifications: AdminNotification[]; loading: boolean; error: string }) {
  const [filter, setFilter] = useState<"전체" | "요청" | "재알림" | "결과">("전체");
  const today = new Date().toDateString();
  const todayCount = notifications.filter(item => new Date(item.created_at).toDateString() === today).length;
  const unreadCount = notifications.filter(item => !item.read_at).length;
  const readRate = notifications.length ? Math.round((notifications.length - unreadCount) / notifications.length * 100) : 0;
  const visible = notifications.filter(item => filter === "전체" || filter === "요청" && item.type === "class_request" || filter === "재알림" && item.type === "class_reminder" || filter === "결과" && !["class_request", "class_reminder"].includes(item.type));
  const typeMeta: Record<AdminNotification["type"], { label: string; icon: string; tone: string }> = {
    class_request: { label: "수업 요청", icon: "↗", tone: "blue" },
    class_reminder: { label: "재알림", icon: "◷", tone: "amber" },
    assignment_confirmed: { label: "배정 확정", icon: "✓", tone: "mint" },
    class_changed: { label: "수업 변경", icon: "◇", tone: "purple" },
    class_cancelled: { label: "수업 취소", icon: "×", tone: "red" },
  };
  return <div className="screen-stack"><section className="metrics-grid compact-metrics"><MetricCard icon="↗" label="오늘 발송" value={`${todayCount}건`} detail="플랫폼 내부 알림 기준" tone="blue" /><MetricCard icon="✓" label="강사 확인률" value={`${readRate}%`} detail={`확인 ${notifications.length - unreadCount} · 미확인 ${unreadCount}`} tone="mint" /><MetricCard icon="◷" label="미확인 알림" value={`${unreadCount}건`} detail="강사 확인 대기" tone="amber" /></section><section className="panel notification-list"><div className="panel-head"><div><span className="section-kicker">DELIVERY LOG</span><h3>실제 알림 발송 이력</h3><p>강사에게 저장된 플랫폼 내부 알림을 최신순으로 표시합니다.</p></div><div className="filter-tabs">{(["전체", "요청", "재알림", "결과"] as const).map(value => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value}</button>)}</div></div>{loading && <div className="empty-state">알림 이력을 불러오는 중입니다.</div>}{error && <div className="empty-state">{error}</div>}{!loading && !error && visible.map(item => { const meta = typeMeta[item.type]; return <article className="notification-item" key={item.id}><span className={`notification-type ${meta.tone}`}>{meta.icon}</span><div><b>{meta.label} · {item.class ? `${item.class.institution} · ${item.class.title}` : item.title}</b><p>{item.recipient ? `${item.recipient.full_name} · ${item.recipient.email}` : "수신 강사"}</p><small>{item.body}</small></div><span>{new Date(item.created_at).toLocaleString("ko-KR")}</span><StatusBadge tone={item.read_at ? "green" : "amber"}>{item.read_at ? "확인" : "미확인"}</StatusBadge></article>; })}{!loading && !error && visible.length === 0 && <div className="empty-state">해당 조건의 실제 알림 이력이 없습니다.</div>}</section></div>;
}

function ClassForm({ close, onCreated }: { close: () => void; onCreated: (item: StoredClass) => void }) {
  const [assistants, setAssistants] = useState(2);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const initialDates = useRef(defaultClassDates());
  const creationKey = useRef("");
  const draft = useRef({
    title: "AI 창의융합 체험 수업", institution: "성수중학교", contact: "", classDate: initialDates.current.classDate,
    startTime: "10:00", endTime: "12:00", address: "서울 성동구 성수이로 32", targetGroup: "중학생",
    grade: "1~2학년", participantCount: 24, description: "생성형 AI의 원리를 이해하고 팀별 창작 프로젝트를 진행합니다.",
    leadFee: 300000, assistantFee: 150000, feeNotes: "교통비 포함, 원천징수 후 수업일 기준 익월 10일 지급",
    deadlineDate: initialDates.current.deadlineDate, deadlineTime: "18:00",
  });
  const numberValue = (value: string) => Number(value.replace(/[^0-9]/g, ""));
  const saveClass = async () => {
    creationKey.current ||= crypto.randomUUID();
    setSaving(true);
    setError("");
    const response = await fetch("/api/admin/classes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...draft.current, assistantCount: assistants, creationKey: creationKey.current }),
    });
    const result = await response.json().catch(() => null) as { class?: StoredClass } | null;
    if (!response.ok || !result?.class) {
      setError("수업을 저장하지 못했습니다. 필수 입력값과 날짜를 확인해 주세요.");
      setSaving(false);
      return;
    }
    onCreated(result.class);
    close();
  };
  return <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="form-title"><button className="overlay-bg" onClick={close} aria-label="닫기" /><section className="drawer"><header><div><span className="section-kicker">NEW CLASS</span><h2 id="form-title">새 수업 등록</h2></div><button className="close-button" onClick={close} aria-label="닫기">×</button></header><div className="stepper"><span className="active">1 <b>수업 정보</b></span><i /><span className={step === 2 ? "active" : ""}>2 <b>강사·수업료</b></span><i /><span>3 <b>확인</b></span></div>{error && <div className="form-error" role="alert">{error}</div>}{step === 1 ? <div className="form-body"><div className="form-section"><h3>기본 정보</h3><div className="form-grid"><label className="wide">수업명<input defaultValue={draft.current.title} onChange={event => draft.current.title = event.target.value} /></label><label>기관명<input defaultValue={draft.current.institution} onChange={event => draft.current.institution = event.target.value} /></label><label>담당자<input placeholder="담당자명 · 연락처" onChange={event => draft.current.contact = event.target.value} /></label><label>수업 날짜<input type="date" defaultValue={draft.current.classDate} onChange={event => draft.current.classDate = event.target.value} /></label><label>수업 시간<div className="split-input"><input type="time" defaultValue={draft.current.startTime} onChange={event => draft.current.startTime = event.target.value} /><span>–</span><input type="time" defaultValue={draft.current.endTime} onChange={event => draft.current.endTime = event.target.value} /></div></label><label className="wide">장소·주소<input defaultValue={draft.current.address} onChange={event => draft.current.address = event.target.value} /></label></div></div><div className="form-section"><h3>수업 상세</h3><div className="form-grid thirds"><label>대상<select defaultValue={draft.current.targetGroup} onChange={event => draft.current.targetGroup = event.target.value}><option>중학생</option><option>초등학생</option><option>고등학생</option></select></label><label>학년<select defaultValue={draft.current.grade} onChange={event => draft.current.grade = event.target.value}><option>1~2학년</option><option>전 학년</option></select></label><label>참여 인원<input type="number" min="1" defaultValue={draft.current.participantCount} onChange={event => draft.current.participantCount = Number(event.target.value)} /></label><label className="wide">수업 내용<textarea defaultValue={draft.current.description} onChange={event => draft.current.description = event.target.value} /></label></div></div></div> : <div className="form-body"><div className="form-section"><h3>역할별 필요 인원</h3><div className="role-setting"><article><div><RoleBadge role="주강사" /><p>수업을 총괄하고 진행합니다.</p></div><strong>1명 <small>필수</small></strong></article><article><div><RoleBadge role="보조강사" /><p>실습과 모둠 활동을 지원합니다.</p></div><div className="counter"><button onClick={() => setAssistants(Math.max(0, assistants - 1))}>−</button><b>{assistants}명</b><button onClick={() => setAssistants(Math.min(2, assistants + 1))}>＋</button></div></article></div></div><div className="form-section"><h3>역할별 수업료</h3><div className="fee-fields"><label><span><RoleBadge role="주강사" /> 1인 지급액</span><div><input inputMode="numeric" defaultValue="300,000" onChange={event => draft.current.leadFee = numberValue(event.target.value)} /><b>원</b></div></label><label className={assistants === 0 ? "disabled" : ""}><span><RoleBadge role="보조강사" /> 1인당 지급액</span><div><input inputMode="numeric" defaultValue={assistants ? "150,000" : ""} onChange={event => draft.current.assistantFee = numberValue(event.target.value)} disabled={assistants === 0} /><b>원</b></div></label></div><label className="full-label">수업료 안내사항<textarea defaultValue={draft.current.feeNotes} onChange={event => draft.current.feeNotes = event.target.value} /></label><p className="info-callout"><span>i</span> 입력한 금액은 모집 안내와 최종 배정 알림에 역할별로 표시됩니다.</p></div><div className="form-section"><h3>응답 마감</h3><div className="form-grid"><label>마감 날짜<input type="date" defaultValue={draft.current.deadlineDate} onChange={event => draft.current.deadlineDate = event.target.value} /></label><label>마감 시간<input type="time" defaultValue={draft.current.deadlineTime} onChange={event => draft.current.deadlineTime = event.target.value} /></label></div></div></div>}<footer><button className="button ghost" disabled={saving} onClick={step === 1 ? close : () => setStep(1)}>{step === 1 ? "취소" : "이전"}</button><button className="button primary" disabled={saving} onClick={() => step === 1 ? setStep(2) : void saveClass()}>{saving ? "저장 중…" : step === 1 ? "다음: 강사·수업료" : "저장하고 수업 목록 보기"} →</button></footer></section></div>;
}

function ClassEditForm({ classItem, close, onSaved }: { classItem: StoredClass; close: () => void; onSaved: (item: StoredClass) => void }) {
  const deadline = deadlineInputs(classItem.response_deadline);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: classItem.title, institution: classItem.institution, contact: classItem.contact ?? "", classDate: classItem.class_date,
    startTime: classItem.start_time.slice(0, 5), endTime: classItem.end_time.slice(0, 5), address: classItem.address,
    targetGroup: classItem.target_group, grade: classItem.grade, participantCount: classItem.participant_count,
    description: classItem.description, assistantCount: classItem.assistant_count, leadFee: classItem.lead_fee,
    assistantFee: classItem.assistant_fee, feeNotes: classItem.fee_notes, ...deadline,
  });
  const update = (key: keyof typeof form, value: string | number) => setForm(current => ({ ...current, [key]: value }));
  async function save() {
    setSaving(true); setError("");
    const response = await fetch(`/api/admin/classes/${classItem.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json().catch(() => null) as { class?: StoredClass; error?: string } | null;
    setSaving(false);
    if (!response.ok || !result?.class) { setError(result?.error === "assistant_count_locked" ? "모집을 시작한 뒤에는 보조강사 인원을 변경할 수 없습니다." : "수업 정보를 수정하지 못했습니다. 날짜와 필수 입력값을 확인해 주세요."); return; }
    onSaved(result.class);
  }
  return <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="edit-form-title"><button className="overlay-bg" onClick={close} aria-label="닫기" /><section className="drawer"><header><div><span className="section-kicker">EDIT CLASS</span><h2 id="edit-form-title">수업 정보 수정</h2></div><button className="close-button" onClick={close} aria-label="닫기">×</button></header>{error && <div className="form-error" role="alert">{error}</div>}<div className="form-body"><div className="form-section"><h3>기본 정보</h3><div className="form-grid"><label className="wide">수업명<input value={form.title} onChange={event => update("title", event.target.value)} /></label><label>기관명<input value={form.institution} onChange={event => update("institution", event.target.value)} /></label><label>담당자<input value={form.contact} onChange={event => update("contact", event.target.value)} /></label><label>수업 날짜<input type="date" value={form.classDate} onChange={event => update("classDate", event.target.value)} /></label><label>수업 시간<div className="split-input"><input type="time" value={form.startTime} onChange={event => update("startTime", event.target.value)} /><span>–</span><input type="time" value={form.endTime} onChange={event => update("endTime", event.target.value)} /></div></label><label className="wide">장소·주소<input value={form.address} onChange={event => update("address", event.target.value)} /></label><label>대상<input value={form.targetGroup} onChange={event => update("targetGroup", event.target.value)} /></label><label>학년<input value={form.grade} onChange={event => update("grade", event.target.value)} /></label><label>참여 인원<input type="number" min="1" value={form.participantCount} onChange={event => update("participantCount", Number(event.target.value))} /></label><label>보조강사 인원<input type="number" min="0" max="2" disabled={classItem.target_count > 0} value={form.assistantCount} onChange={event => update("assistantCount", Number(event.target.value))} /></label><label className="wide">수업 내용<textarea value={form.description} onChange={event => update("description", event.target.value)} /></label></div></div><div className="form-section"><h3>수업료·응답 마감</h3><div className="form-grid"><label>주강사 지급액<input type="number" min="0" value={form.leadFee} onChange={event => update("leadFee", Number(event.target.value))} /></label><label>보조강사 1인당 지급액<input type="number" min="0" disabled={form.assistantCount === 0} value={form.assistantFee} onChange={event => update("assistantFee", Number(event.target.value))} /></label><label>마감 날짜<input type="date" value={form.deadlineDate} onChange={event => update("deadlineDate", event.target.value)} /></label><label>마감 시간<input type="time" value={form.deadlineTime} onChange={event => update("deadlineTime", event.target.value)} /></label><label className="wide">수업료 안내<textarea value={form.feeNotes} onChange={event => update("feeNotes", event.target.value)} /></label></div></div></div><footer><button className="button ghost" disabled={saving} onClick={close}>취소</button><button className="button primary" disabled={saving} onClick={() => void save()}>{saving ? "저장 중…" : "변경사항 저장"}</button></footer></section></div>;
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
  const [storedClasses, setStoredClasses] = useState<StoredClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<ClassWorkspaceTab>("detail");
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState("");
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState("");
  const [pendingMemberCount, setPendingMemberCount] = useState(0);
  useEffect(() => {
    fetch("/api/admin/classes")
      .then(async response => {
        if (!response.ok) throw new Error("classes_unavailable");
        return response.json() as Promise<{ classes: StoredClass[] }>;
      })
      .then(result => setStoredClasses(result.classes))
      .catch(() => setClassesError("수업 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."))
      .finally(() => setClassesLoading(false));
  }, []);
  useEffect(() => {
    fetch("/api/admin/notifications", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("notifications_unavailable");
        return response.json() as Promise<{ notifications: AdminNotification[] }>;
      })
      .then(result => setAdminNotifications(result.notifications))
      .catch(() => setNotificationsError("실제 알림 이력을 불러오지 못했습니다."))
      .finally(() => setNotificationsLoading(false));
  }, []);
  useEffect(() => {
    fetch("/api/admin/members", { cache: "no-store" })
      .then(async response => response.ok ? response.json() as Promise<{ members: MemberRecord[] }> : Promise.reject(new Error("members_unavailable")))
      .then(result => setPendingMemberCount(result.members.filter(member => member.status === "pending").length))
      .catch(() => setPendingMemberCount(0));
  }, []);
  const selectedClass = storedClasses.find(item => item.id === selectedClassId) ?? null;
  const assignmentActionCount = storedClasses.filter(item => item.operational_status === "reviewing" || item.operational_status === "assignment_needed").length;
  const updateStoredClass = (item: StoredClass) => setStoredClasses(current => current.map(value => value.id === item.id ? item : value));
  const openClass = (item: StoredClass, tab: ClassWorkspaceTab = "detail") => { setSelectedClassId(item.id); setWorkspaceTab(tab); setScreen("classes"); };
  const content = useMemo(() => {
    if (screen === "home") return <HomeScreen go={setScreen} adminName={currentAdmin.name} />;
    if (screen === "classes" && selectedClass) return <ClassWorkspace key={selectedClass.id} classItem={selectedClass} initialTab={workspaceTab} onBack={() => setSelectedClassId(null)} onUpdated={updateStoredClass} />;
    if (screen === "classes") return <ClassesScreen onCreate={() => setShowForm(true)} openClass={openClass} onDeleted={classId => setStoredClasses(current => current.filter(item => item.id !== classId))} classItems={storedClasses} loading={classesLoading} error={classesError} />;
    if (screen === "requests") return <RequestsScreen />;
    if (screen === "schedule") return <ScheduleScreen classItems={storedClasses} />;
    if (screen === "instructors") return <InstructorsScreen onPendingResolved={() => setPendingMemberCount(count => Math.max(0, count - 1))} />;
    if (screen === "approvals") return <ApprovalsScreen currentRole={currentAdmin.role} onPendingCountChange={setPendingMemberCount} />;
    return <NotificationsScreen notifications={adminNotifications} loading={notificationsLoading} error={notificationsError} />;
  }, [adminNotifications, classesError, classesLoading, currentAdmin.name, currentAdmin.role, notificationsError, notificationsLoading, screen, selectedClass, storedClasses, workspaceTab]);
  if (instructorMode) return <InstructorMobile onBack={() => setInstructorMode(false)} />;
  return <div className="app-shell"><Sidebar screen={screen} setScreen={value => { setSelectedClassId(null); setScreen(value); }} canManageMembers={currentAdmin.role === "super_admin" || currentAdmin.role === "service_admin"} badges={{ requests: assignmentActionCount, approvals: pendingMemberCount }} /><div className="main-shell"><Topbar screen={screen} onInstructor={() => setInstructorMode(true)} onCreate={() => setShowForm(true)} onNotifications={() => { setSelectedClassId(null); setScreen("notifications"); }} notificationCount={adminNotifications.filter(item => !item.read_at).length} admin={currentAdmin} /><main className="main-content">{content}</main></div>{showForm && <ClassForm close={() => setShowForm(false)} onCreated={item => { setStoredClasses(current => [item, ...current]); setSelectedClassId(item.id); setWorkspaceTab("detail"); setScreen("classes"); }} />}</div>;
}
