import { NextResponse } from "next/server";
import { ADMIN_ROLES, getCurrentProfile } from "../../../../../lib/auth";
import { createClient } from "../../../../../lib/supabase/server";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.status !== "active" || !ADMIN_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_admin_sessions");
  if (error) return NextResponse.json({ error: "sessions_unavailable" }, { status: 500 });
  return NextResponse.json({ sessions: data ?? [] });
}
