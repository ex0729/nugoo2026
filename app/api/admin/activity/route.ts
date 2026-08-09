import { NextResponse } from "next/server";
import { ADMIN_ROLES, getCurrentProfile } from "../../../../lib/auth";
import { createClient } from "../../../../lib/supabase/server";

const RECORDABLE_ACTIONS = [
  "admin_login", "password_changed", "other_sessions_signed_out",
  "class_created", "class_updated", "class_cancelled",
  "assignment_requested", "assignment_reminded", "assignment_confirmed",
  "assignment_changed", "assignment_cancelled",
] as const;

async function authorize() {
  const profile = await getCurrentProfile();
  return profile && profile.status === "active" && ADMIN_ROLES.includes(profile.role) ? profile : null;
}

export async function GET(request: Request) {
  if (!await authorize()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const actor = url.searchParams.get("actor");
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? 30)));
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const supabase = await createClient();

  let query = supabase
    .from("admin_audit_logs")
    .select("id,actor_user_id,target_user_id,action,details,created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);
  if (actor) query = query.eq("actor_user_id", actor);

  const { data: logs, error } = await query;
  if (error) return NextResponse.json({ error: "activity_unavailable" }, { status: 500 });

  const actorIds = [...new Set((logs ?? []).map(log => log.actor_user_id).filter(Boolean))];
  const { data: profiles } = actorIds.length
    ? await supabase.from("user_profiles").select("user_id,full_name,email").in("user_id", actorIds)
    : { data: [] };
  const profileMap = Object.fromEntries((profiles ?? []).map(profile => [profile.user_id, profile]));

  return NextResponse.json({
    logs: (logs ?? []).map(log => ({ ...log, actor: profileMap[log.actor_user_id] ?? null })),
  });
}

export async function POST(request: Request) {
  if (!await authorize()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: string; details?: Record<string, unknown> } | null;
  if (!body?.action || !RECORDABLE_ACTIONS.includes(body.action as typeof RECORDABLE_ACTIONS[number])) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_admin_activity", {
    activity_action: body.action,
    activity_details: body.details ?? {},
  });
  if (error) return NextResponse.json({ error: "activity_record_failed" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
