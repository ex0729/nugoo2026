"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ResponseStatus = "pending" | "available" | "conditional" | "unavailable";
type ClassRequest = {
  id: string;
  requested_role: "lead" | "assistant" | "both";
  class: { id: string; title: string; institution: string; class_date: string; start_time: string; end_time: string; address: string; lead_fee: number; assistant_fee: number; fee_notes: string; response_deadline: string; status: string } | null;
  responses: Array<{ id: string; role: "lead" | "assistant"; status: ResponseStatus; condition: string | null; responded_at: string | null }>;
};
type InternalNotification = { id: string; class_id: string | null; type: string; title: string; body: string; action_url: string; read_at: string | null; created_at: string };
type PushState = "checking" | "available" | "enabled" | "blocked" | "unsupported" | "unconfigured";

const won = (value: number) => `${new Intl.NumberFormat("ko-KR").format(value)}원`;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(character => character.charCodeAt(0)));
}

export default function InstructorDashboardClient({ instructorName }: { instructorName: string }) {
  const [requests, setRequests] = useState<ClassRequest[]>([]);
  const [notifications, setNotifications] = useState<InternalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [conditions, setConditions] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState("");
  const [pushState, setPushState] = useState<PushState>("checking");

  async function loadDashboard() {
    try {
      const [requestResponse, notificationResponse, pushResponse] = await Promise.all([
        fetch("/api/instructor/requests", { cache: "no-store" }),
        fetch("/api/notifications", { cache: "no-store" }),
        fetch("/api/push/subscriptions", { cache: "no-store" }),
      ]);
      if (!requestResponse.ok || !notificationResponse.ok) throw new Error("load_failed");
      const requestData = await requestResponse.json() as { requests: ClassRequest[] };
      const notificationData = await notificationResponse.json() as { notifications: InternalNotification[] };
      setRequests(requestData.requests); setNotifications(notificationData.notifications);
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) setPushState("unsupported");
      else if (Notification.permission === "denied") setPushState("blocked");
      else if (pushResponse.ok) {
        const pushData = await pushResponse.json() as { configured: boolean; subscribed: boolean };
        setPushState(!pushData.configured ? "unconfigured" : pushData.subscribed ? "enabled" : "available");
      } else setPushState("available");
    } catch { setError("수업 요청과 알림을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDashboard(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const pendingCount = useMemo(() => requests.reduce((count, request) => count + request.responses.filter(response => response.status === "pending").length, 0), [requests]);
  const unreadCount = notifications.filter(notification => !notification.read_at).length;

  async function respond(responseId: string, status: Exclude<ResponseStatus, "pending">) {
    const condition = conditions[responseId]?.trim() ?? "";
    if (status === "conditional" && !condition) { setError("조건부 가능을 선택하려면 가능한 조건을 입력해 주세요."); return; }
    setSavingId(responseId); setError("");
    const response = await fetch("/api/instructor/requests", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ responseId, status, condition }) });
    setSavingId("");
    if (!response.ok) { setError("응답을 저장하지 못했습니다."); return; }
    await loadDashboard();
  }

  async function enablePush() {
    const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
    if (!publicKey) { setPushState("unconfigured"); return; }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setPushState("blocked"); return; }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      const response = await fetch("/api/push/subscriptions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(subscription) });
      if (!response.ok) throw new Error("subscribe_failed");
      setPushState("enabled");
    } catch { setError("이 기기에서 웹 푸시 알림을 켜지 못했습니다. 브라우저 알림 설정을 확인해 주세요."); }
  }

  async function markRead(notification: InternalNotification) {
    if (!notification.read_at) {
      await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [notification.id] }) });
      setNotifications(current => current.map(item => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
    }
    if (notification.action_url) window.location.assign(notification.action_url);
  }

  const pushLabel: Record<PushState, string> = { checking: "알림 상태 확인 중", available: "무료 웹 푸시 켜기", enabled: "✓ 웹 푸시 사용 중", blocked: "브라우저에서 알림 차단됨", unsupported: "이 브라우저는 푸시 미지원", unconfigured: "내부 알림 사용 중" };

  return <main className="instructor-dashboard-page">
    <header className="instructor-dashboard-header"><Link className="instructor-dashboard-brand" href="/instructor/dashboard"><span className="brand-mark">N</span><span>NGN-X<small>INSTRUCTOR CENTER</small></span></Link><div className="instructor-dashboard-account"><span className="instructor-dashboard-avatar">{instructorName[0]}</span><span><b>{instructorName} 강사님</b><small>승인된 강사 계정</small></span><Link href="/auth/signout?next=/instructor/login">로그아웃</Link></div></header>
    <div className="instructor-dashboard-shell"><nav className="instructor-dashboard-nav"><a className="active" href="#overview"><span>⌂</span>홈</a><a href="#notifications"><span>◷</span>알림 {unreadCount ? `(${unreadCount})` : ""}</a><a href="#requests"><span>↗</span>수업 요청</a></nav><section className="instructor-dashboard-content" id="overview"><div className="instructor-dashboard-welcome"><div><p className="section-kicker">INSTRUCTOR DASHBOARD</p><h1>{instructorName} 강사님, 반갑습니다</h1><p>요청받은 역할과 수업료를 확인하고 마감 전에 응답해 주세요.</p></div><span>✓ 승인된 계정</span></div>
      <section className="instructor-dashboard-metrics"><article><span className="blue">↗</span><div><small>응답할 역할</small><strong>{pendingCount}건</strong></div></article><article><span className="mint">✓</span><div><small>받은 수업 요청</small><strong>{requests.length}건</strong></div></article><article><span className="purple">◷</span><div><small>읽지 않은 알림</small><strong>{unreadCount}건</strong></div></article></section>
      {error && <div className="notice-banner error-banner"><span>!</span><div><b>{error}</b></div></div>}
      <span hidden>새 수업 요청</span>
      <section className="instructor-notification-center" id="notifications"><header><div><p className="section-kicker">NOTIFICATIONS</p><h2>플랫폼 알림</h2><p>웹 푸시를 끄더라도 모든 요청과 재알림은 이곳에 저장됩니다.</p></div><button className={`push-permission ${pushState === "enabled" ? "enabled" : ""}`} disabled={!["available"].includes(pushState)} onClick={enablePush}>{pushLabel[pushState]}</button></header>{notifications.slice(0, 6).map(notification => <article className={`instructor-notification-item ${notification.read_at ? "" : "unread"}`} key={notification.id}><span>{notification.type === "class_reminder" ? "◷" : notification.type === "assignment_confirmed" ? "✓" : "↗"}</span><div><b>{notification.title}</b><p>{notification.body}</p><small>{new Date(notification.created_at).toLocaleString("ko-KR")}</small></div><button onClick={() => markRead(notification)}>{notification.read_at ? "열기" : "확인"}</button></article>)}{!loading && notifications.length === 0 && <div className="instructor-dashboard-empty"><p>아직 도착한 플랫폼 알림이 없습니다.</p></div>}</section>
      <section className="instructor-request-list" id="requests"><header><div><p className="section-kicker">CLASS REQUESTS</p><h2>내 수업 요청</h2></div><span>{requests.length}건</span></header>{loading && <div className="instructor-dashboard-empty"><p>수업 요청을 불러오는 중입니다.</p></div>}{!loading && requests.map(request => request.class && <article className="instructor-request-card" id={`request-${request.class.id}`} key={request.id}><div><StatusChip status={request.class.status} /><h3>{request.class.institution} · {request.class.title}</h3><p>{request.class.class_date} · {request.class.start_time.slice(0,5)}~{request.class.end_time.slice(0,5)} · {request.class.address}</p><small>응답 마감 {new Date(request.class.response_deadline).toLocaleString("ko-KR")}</small></div><div className="instructor-role-responses">{request.responses.map(item => <section key={item.id}><header><b>{item.role === "lead" ? "주강사" : "보조강사"}</b><strong>{item.role === "lead" ? won(request.class!.lead_fee) : `1인당 ${won(request.class!.assistant_fee)}`}</strong><span>{item.status === "pending" ? "미응답" : item.status === "available" ? "가능" : item.status === "conditional" ? "조건부 가능" : "불가능"}</span></header><p>{request.class!.fee_notes || "추가 수업료 안내 없음"}</p><input aria-label="조건 입력" placeholder="조건부 가능일 때 조건을 입력하세요" value={conditions[item.id] ?? item.condition ?? ""} onChange={event => setConditions(current => ({ ...current, [item.id]: event.target.value }))} /><div><button disabled={savingId === item.id} onClick={() => respond(item.id, "available")}>가능</button><button disabled={savingId === item.id} onClick={() => respond(item.id, "conditional")}>조건부 가능</button><button disabled={savingId === item.id} onClick={() => respond(item.id, "unavailable")}>불가능</button></div></section>)}</div></article>)}{!loading && requests.length === 0 && <div className="instructor-dashboard-empty"><span>↗</span><h3>현재 응답할 수업 요청이 없습니다</h3><p>관리자가 모집 요청을 보내면 역할과 수업료가 이곳에 표시됩니다.</p></div>}</section>
    </section></div>
  </main>;
}

function StatusChip({ status }: { status: string }) {
  return <span className="instructor-request-status">{status === "assigned" ? "배정 완료" : status === "cancelled" ? "취소" : "모집 중"}</span>;
}
