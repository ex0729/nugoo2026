import { NextResponse } from "next/server";
import { ADMIN_ROLES, getCurrentProfile } from "../../../../lib/auth";
import { createClient } from "../../../../lib/supabase/server";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.status !== "active" || !ADMIN_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: notifications, error } = await supabase
    .from("internal_notifications")
    .select("id,user_id,class_id,type,title,body,action_url,read_at,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "notifications_unavailable" }, { status: 500 });

  const recipientIds = [...new Set((notifications ?? []).map(item => item.user_id))];
  const classIds = [...new Set((notifications ?? []).map(item => item.class_id).filter((id): id is string => Boolean(id)))];
  const [{ data: recipients }, { data: classes }] = await Promise.all([
    recipientIds.length ? supabase.from("user_profiles").select("user_id,full_name,email").in("user_id", recipientIds) : Promise.resolve({ data: [] }),
    classIds.length ? supabase.from("classes").select("id,institution,title").in("id", classIds) : Promise.resolve({ data: [] }),
  ]);
  const recipientMap = Object.fromEntries((recipients ?? []).map(item => [item.user_id, item]));
  const classMap = Object.fromEntries((classes ?? []).map(item => [item.id, item]));

  return NextResponse.json({ notifications: (notifications ?? []).map(item => ({
    ...item,
    recipient: recipientMap[item.user_id] ?? null,
    class: item.class_id ? classMap[item.class_id] ?? null : null,
  })) });
}
