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

const won = (value: number) => `${new Intl.NumberFormat("ko-KR").format(value)}원`;

export default function InstructorDashboardClient({ instructorName }: { instructorName: string }) {
  const [requests, setRequests] = useState<ClassRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [conditions, setConditions] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState("");

  const loadRequests = () => fetch("/api/instructor/requests", { cache: "no-store" }).then(response => response.ok ? response.json() : Promise.reject()).then((data: { requests: ClassRequest[] }) => setRequests(data.requests)).catch(() => setError("수업 요청을 불러오지 못했습니다.")).finally(() => setLoading(false));
  useEffect(() => { void loadRequests(); }, []);

  const pendingCount = useMemo(() => requests.reduce((count, request) => count + request.responses.filter(response => response.status === "pending").length, 0), [requests]);

  async function respond(responseId: string, status: Exclude<ResponseStatus, "pending">) {
    const condition = conditions[responseId]?.trim() ?? "";
    if (status === "conditional" && !condition) { setError("조건부 가능을 선택하려면 조건을 입력해 주세요."); return; }
    setSavingId(responseId); setError("");
    const response = await fetch("/api/instructor/requests", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ responseId, status, condition }) });
    setSavingId("");
    if (!response.ok) { setError("응답을 저장하지 못했습니다."); return; }
    await loadRequests();
  }

  return <main className="instructor-dashboard-page">
    <header className="instructor-dashboard-header"><Link className="instructor-dashboard-brand" href="/instructor/dashboard"><span className="brand-mark">C</span><span>클래스플로우<small>INSTRUCTOR CENTER</small></span></Link><div className="instructor-dashboard-account"><span className="instructor-dashboard-avatar">{instructorName[0]}</span><span><b>{instructorName} 강사님</b><small>승인된 강사 계정</small></span><Link href="/auth/signout?next=/instructor/login">로그아웃</Link></div></header>
    <div className="instructor-dashboard-shell"><nav className="instructor-dashboard-nav"><a className="active" href="#overview"><span>⌂</span>홈</a><a href="#requests"><span>↗</span>수업 요청</a><a href="#schedule"><span>□</span>확정 일정</a></nav><section className="instructor-dashboard-content" id="overview"><div className="instructor-dashboard-welcome"><div><p className="section-kicker">INSTRUCTOR DASHBOARD</p><h1>{instructorName} 강사님, 반갑습니다</h1><p>요청받은 역할과 수업료를 확인하고 마감 전에 응답해 주세요.</p></div><span>✓ 승인된 계정</span></div>
      <section className="instructor-dashboard-metrics"><article><span className="blue">↗</span><div><small>응답할 역할</small><strong>{pendingCount}건</strong></div></article><article><span className="mint">✓</span><div><small>받은 수업 요청</small><strong>{requests.length}건</strong></div></article><article><span className="purple">₩</span><div><small>역할별 수업료</small><strong>요청에서 확인</strong></div></article></section>
      {error && <div className="notice-banner error-banner"><span>!</span><div><b>{error}</b></div></div>}
      <section className="instructor-request-list" id="requests"><header><div><p className="section-kicker">CLASS REQUESTS</p><h2>새 수업 요청</h2></div><span>{requests.length}건</span></header>{loading && <div className="instructor-dashboard-empty"><p>수업 요청을 불러오는 중입니다.</p></div>}{!loading && requests.map(request => request.class && <article className="instructor-request-card" key={request.id}><div><StatusChip status={request.class.status} /><h3>{request.class.institution} · {request.class.title}</h3><p>{request.class.class_date} · {request.class.start_time.slice(0,5)}~{request.class.end_time.slice(0,5)} · {request.class.address}</p><small>응답 마감 {new Date(request.class.response_deadline).toLocaleString("ko-KR")}</small></div><div className="instructor-role-responses">{request.responses.map(item => <section key={item.id}><header><b>{item.role === "lead" ? "주강사" : "보조강사"}</b><strong>{item.role === "lead" ? won(request.class!.lead_fee) : `1인당 ${won(request.class!.assistant_fee)}`}</strong><span>{item.status === "pending" ? "미응답" : item.status === "available" ? "가능" : item.status === "conditional" ? "조건부 가능" : "불가능"}</span></header><p>{request.class!.fee_notes || "추가 수업료 안내 없음"}</p><input aria-label="조건 입력" placeholder="조건부 가능일 때 조건을 입력하세요" value={conditions[item.id] ?? item.condition ?? ""} onChange={event => setConditions(current => ({ ...current, [item.id]: event.target.value }))} /><div><button disabled={savingId === item.id} onClick={() => respond(item.id, "available")}>가능</button><button disabled={savingId === item.id} onClick={() => respond(item.id, "conditional")}>조건부 가능</button><button disabled={savingId === item.id} onClick={() => respond(item.id, "unavailable")}>불가능</button></div></section>)}</div></article>)}{!loading && requests.length === 0 && <div className="instructor-dashboard-empty"><span>↗</span><h3>현재 응답할 수업 요청이 없습니다</h3><p>관리자가 모집 요청을 보내면 역할과 수업료가 이곳에 표시됩니다.</p></div>}</section>
    </section></div>
  </main>;
}

function StatusChip({ status }: { status: string }) {
  return <span className="instructor-request-status">{status === "assigned" ? "배정 완료" : status === "cancelled" ? "취소" : "모집 중"}</span>;
}
