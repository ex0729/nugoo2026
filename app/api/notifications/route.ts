import { NextResponse } from "next/server";
import { getCurrentProfile } from "../../../lib/auth";
import { createClient } from "../../../lib/supabase/server";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.status !== "active") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase.from("internal_notifications").select("id,class_id,type,title,body,action_url,read_at,created_at").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: "notifications_unavailable" }, { status: 500 });
  return NextResponse.json({ notifications: data ?? [] });
}

export async function PATCH(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.status !== "active") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { ids?: string[] } | null;
  if (!body?.ids?.length) return NextResponse.json({ error: "invalid_notifications" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("internal_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", profile.user_id).in("id", body.ids);
  if (error) return NextResponse.json({ error: "notification_update_failed" }, { status: 400 });
  return NextResponse.json({ updated: body.ids.length });
}
