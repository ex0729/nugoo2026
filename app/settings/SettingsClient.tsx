"use client";
/* eslint-disable react-hooks/set-state-in-effect -- this effect synchronizes protected Supabase settings data. */

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type AdminIdentity = { userId: string; name: string; email: string; role: "super_admin" | "service_admin" };
type Member = { user_id: string; email: string; full_name: string; role: "instructor" | "company_member" | "service_admin" | "super_admin"; status: "pending" | "active" | "suspended"; created_at: string };
type Session = { session_id: string; created_at: string; updated_at: string; user_agent: string | null; ip_address: string | null; is_current: boolean };
type Activity = { id: number; actor_user_id: string; target_user_id: string | null; action: string; details: Record<string, unknown>; created_at: string; actor: { full_name: string; email: string } | null };

const actionLabels: Record<string, string> = {
  admin_login: "관리자 로그인",
  admin_invited: "관리자 초대",
  admin_invitation_accepted: "관리자 초대 수락",
  member_role_updated: "관리자 권한·상태 변경",
  password_changed: "비밀번호 변경",
  other_sessions_signed_out: "다른 기기 로그아웃",
  class_created: "수업 생성",
  class_updated: "수업 수정",
  class_cancelled: "수업 취소",
  assignment_requested: "배정 요청",
  assignment_reminded: "배정 재알림",
  assignment_confirmed: "강사 최종 배정",
  assignment_changed: "강사 배정 변경",
  assignment_cancelled: "강사 배정 취소",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value));
}

function deviceName(userAgent: string | null) {
  if (!userAgent) return "알 수 없는 기기";
  const browser = userAgent.includes("Edg/") ? "Edge" : userAgent.includes("Chrome/") ? "Chrome" : userAgent.includes("Safari/") ? "Safari" : "웹 브라우저";
  const os = userAgent.includes("Windows") ? "Windows" : userAgent.includes("Mac OS") ? "macOS" : userAgent.includes("Android") ? "Android" : userAgent.includes("iPhone") ? "iPhone" : "기기";
  return `${os} · ${browser}`;
}

export default function SettingsClient({ currentAdmin }: { currentAdmin: AdminIdentity }) {
  const [section, setSection] = useState<"admins" | "security">("admins");
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [days, setDays] = useState("30");
  const [actorFilter, setActorFilter] = useState("");

  const loadMembers = useCallback(async () => {
    const response = await fetch("/api/admin/members", { cache: "no-store" });
    if (!response.ok) throw new Error("members");
    const data = await response.json() as { members: Member[] };
    setMembers(data.members);
  }, []);

  const loadSecurity = useCallback(async () => {
    const params = new URLSearchParams({ days });
    if (actorFilter) params.set("actor", actorFilter);
    const [sessionsResponse, activityResponse] = await Promise.all([
      fetch("/api/admin/security/sessions", { cache: "no-store" }),
      fetch(`/api/admin/activity?${params}`, { cache: "no-store" }),
    ]);
    if (!sessionsResponse.ok || !activityResponse.ok) throw new Error("security");
    setSessions(((await sessionsResponse.json()) as { sessions: Session[] }).sessions);
    setActivities(((await activityResponse.json()) as { logs: Activity[] }).logs);
  }, [actorFilter, days]);

  useEffect(() => {
    Promise.all([loadMembers(), loadSecurity()])
      .catch(() => setError("설정 정보를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [loadMembers, loadSecurity]);

  const administrators = useMemo(() => members.filter(member => member.role === "super_admin" || member.role === "service_admin"), [members]);

  async function inviteAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setInviteUrl("");
    const response = await fetch("/api/admin/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: inviteEmail }) });
    const data = await response.json() as { inviteUrl?: string; error?: string };
    if (!response.ok || !data.inviteUrl) {
      setError(data.error === "already_active_admin" ? "이미 활성화된 관리자 이메일입니다." : "관리자 초대 링크를 만들지 못했습니다.");
      return;
    }
    setInviteUrl(data.inviteUrl);
    setMessage("7일 동안 사용할 수 있는 관리자 초대 링크를 만들었습니다.");
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setMessage("관리자 초대 링크를 복사했습니다.");
  }

  async function updateAdmin(member: Member, role: Member["role"], status: Member["status"]) {
    setError(""); setMessage("");
    const response = await fetch("/api/admin/members", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: member.user_id, role, status }) });
    if (!response.ok) { setError("관리자 권한을 변경하지 못했습니다."); return; }
    await loadMembers();
    setMessage(status === "suspended" ? `${member.full_name} 관리자의 이용을 중지했습니다.` : "관리자 권한을 변경했습니다.");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    if (password.length < 12) { setError("비밀번호는 12자 이상으로 입력해 주세요."); return; }
    if (password !== passwordConfirm) { setError("새 비밀번호가 서로 일치하지 않습니다."); return; }
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setError("비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요."); return; }
    await fetch("/api/admin/activity", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "password_changed" }) });
    setPassword(""); setPasswordConfirm(""); setPasswordOpen(false); setMessage("비밀번호를 변경했습니다."); await loadSecurity();
  }

  async function signOutOthers() {
    setError(""); setMessage("");
    const supabase = createClient();
    const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
    if (signOutError) { setError("다른 기기에서 로그아웃하지 못했습니다."); return; }
    await fetch("/api/admin/activity", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "other_sessions_signed_out" }) });
    setMessage("현재 기기를 제외한 다른 기기에서 로그아웃했습니다."); await loadSecurity();
  }

  return <main className="settings-page">
    <header className="settings-header">
      <Link href="/" className="settings-brand"><span className="brand-mark">C</span><span>클래스플로우<small>OPERATIONS SETTINGS</small></span></Link>
      <div><span><b>{currentAdmin.name}</b><small>{currentAdmin.email}</small></span><Link className="button secondary settings-logout" href="/auth/signout">로그아웃</Link></div>
    </header>
    <div className="settings-shell">
      <aside className="settings-menu"><Link href="/">← 운영센터로 돌아가기</Link><p>설정</p><button className={section === "admins" ? "active" : ""} onClick={() => setSection("admins")}><span>◎</span>관리자 관리</button><button className={section === "security" ? "active" : ""} onClick={() => setSection("security")}><span>◈</span>보안·활동 기록</button></aside>
      <section className="settings-content">
        {message && <div className="settings-message success" role="status">✓ {message}</div>}
        {error && <div className="settings-message error" role="alert">! {error}</div>}
        {loading ? <div className="settings-loading">설정 정보를 불러오는 중입니다.</div> : section === "admins" ? <>
          <div className="settings-title"><div><p className="section-kicker">ADMINISTRATION</p><h1>관리자 관리</h1><p>플랫폼을 운영할 관리자 계정과 권한을 관리합니다.</p></div>{currentAdmin.role === "super_admin" && <button className="button primary" onClick={() => setInviteOpen(value => !value)}>＋ 관리자 초대</button>}</div>
          {inviteOpen && <form className="settings-invite" onSubmit={inviteAdmin}><div><h2>운영 관리자 초대</h2><p>이메일을 입력하면 7일 유효한 가입 링크를 생성합니다.</p></div><label>초대할 이메일<input type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="admin@example.com" required /></label><button className="button primary">초대 링크 만들기</button>{inviteUrl && <div className="settings-invite-result"><input aria-label="관리자 초대 링크" value={inviteUrl} readOnly /><button type="button" className="button secondary" onClick={copyInvite}>링크 복사</button></div>}</form>}
          <section className="settings-panel"><header><div><h2>관리자 목록</h2><p>활성 관리자 {administrators.filter(item => item.status === "active").length}명</p></div></header><div className="admin-table"><div className="admin-table-head"><span>이름</span><span>이메일 또는 휴대전화</span><span>권한</span><span>계정 상태</span><span>관리</span></div>{administrators.map(member => <div className="admin-table-row" key={member.user_id}><span className="admin-person"><b>{member.full_name[0]}</b><span>{member.full_name}<small>{member.user_id === currentAdmin.userId ? "현재 계정" : "관리자"}</small></span></span><span>{member.email}</span><span><strong className={`admin-role ${member.role}`}>{member.role === "super_admin" ? "최고 관리자" : "운영 관리자"}</strong></span><span><strong className={`account-state ${member.status}`}>{member.status === "active" ? "● 활성" : "● 이용 중지"}</strong></span><span>{member.role === "super_admin" ? <small className="fixed-admin">필수 유지</small> : currentAdmin.role === "super_admin" ? <div className="admin-row-actions"><button onClick={() => updateAdmin(member, "company_member", member.status)}>권한 해제</button><button className={member.status === "active" ? "danger" : ""} onClick={() => updateAdmin(member, "service_admin", member.status === "active" ? "suspended" : "active")}>{member.status === "active" ? "이용 중지" : "이용 재개"}</button></div> : <small className="fixed-admin">조회 전용</small>}</span></div>)}</div></section>
          <div className="settings-two-column"><section className="settings-panel rules"><header><h2>관리자 권한</h2></header><div><article><b>최고 관리자</b><p>관리자 관리와 설정을 포함한 모든 기능</p></article><article><b>운영 관리자</b><p>수업 등록, 알림 발송, 강사 배정</p></article></div></section><section className="settings-panel rules"><header><h2>운영 규칙</h2></header><ul><li>최고 관리자는 최소 1명 이상 유지</li><li>마지막 최고 관리자는 이용 중지 불가</li><li>이용 중지된 관리자는 로그인 불가</li></ul></section></div>
        </> : <>
          <div className="settings-title"><div><p className="section-kicker">SECURITY & AUDIT</p><h1>보안·활동 기록</h1><p>관리자 계정의 보안 상태와 주요 작업 내역을 확인합니다.</p></div></div>
          <section className="settings-panel security-panel"><header><div><h2>보안</h2><p>비밀번호와 로그인 세션을 관리합니다.</p></div></header><div className="security-actions"><article><span>●</span><div><b>비밀번호</b><p>12자 이상의 새로운 비밀번호로 변경합니다.</p></div><button className="button secondary" onClick={() => setPasswordOpen(value => !value)}>비밀번호 변경</button></article><article><span>▣</span><div><b>로그인된 기기</b><p>현재 계정으로 로그인된 세션 {sessions.length}개</p></div><button className="button secondary" onClick={signOutOthers} disabled={sessions.length <= 1}>다른 기기에서 로그아웃</button></article></div>{passwordOpen && <form className="password-form" onSubmit={changePassword}><label>새 비밀번호<input type="password" minLength={12} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" required /></label><label>새 비밀번호 확인<input type="password" minLength={12} value={passwordConfirm} onChange={event => setPasswordConfirm(event.target.value)} autoComplete="new-password" required /></label><button className="button primary">비밀번호 저장</button></form>}<div className="session-list">{sessions.map(session => <article key={session.session_id}><span>▣</span><div><b>{deviceName(session.user_agent)} {session.is_current && <em>현재 기기</em>}</b><p>{session.ip_address ?? "IP 정보 없음"} · 최근 활동 {formatDate(session.updated_at)}</p></div></article>)}</div></section>
          <section className="settings-panel activity-panel"><header><div><h2>활동 기록</h2><p>로그인, 관리자 변경, 수업·배정의 주요 작업만 기록합니다.</p></div><div className="activity-filters"><select aria-label="조회 기간" value={days} onChange={event => setDays(event.target.value)}><option value="7">최근 7일</option><option value="30">최근 30일</option><option value="90">최근 90일</option></select><select aria-label="관리자별 필터" value={actorFilter} onChange={event => setActorFilter(event.target.value)}><option value="">모든 관리자</option>{administrators.map(admin => <option key={admin.user_id} value={admin.user_id}>{admin.full_name}</option>)}</select></div></header><div className="activity-table"><div className="activity-table-head"><span>작업 일시</span><span>작업한 관리자</span><span>작업 내용</span></div>{activities.map(activity => <div className="activity-table-row" key={activity.id}><span>{formatDate(activity.created_at)}</span><span><b>{activity.actor?.full_name ?? "시스템"}</b><small>{activity.actor?.email ?? "자동 기록"}</small></span><span>{actionLabels[activity.action] ?? activity.action}</span></div>)}{activities.length === 0 && <div className="settings-empty">선택한 조건의 활동 기록이 없습니다.</div>}</div></section>
        </>}
      </section>
    </div>
  </main>;
}
