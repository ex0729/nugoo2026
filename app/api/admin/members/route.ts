import { NextResponse } from "next/server";
import { ADMIN_ROLES, getCurrentProfile, type UserRole, type UserStatus } from "../../../../lib/auth";
import { createClient } from "../../../../lib/supabase/server";

const ASSIGNABLE_ROLES: UserRole[] = ["instructor", "company_member", "service_admin"];
const STATUSES: UserStatus[] = ["pending", "active", "suspended"];

async function authorize() {
  const profile = await getCurrentProfile();
  return profile && profile.status === "active" && ADMIN_ROLES.includes(profile.role) ? profile : null;
}

export async function GET() {
  if (!await authorize()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id,email,full_name,role,status,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "members_unavailable" }, { status: 500 });
  return NextResponse.json({ members: data });
}

export async function PATCH(request: Request) {
  const actor = await authorize();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as { userId?: string; role?: UserRole; status?: UserStatus } | null;
  if (!body?.userId || !body.role || !body.status || !ASSIGNABLE_ROLES.includes(body.role) || !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (actor.role !== "super_admin" && body.role === "service_admin") {
    return NextResponse.json({ error: "insufficient_permissions" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("manage_member", {
    target_user_id: body.userId,
    next_role: body.role,
    next_status: body.status,
  });

  if (error) return NextResponse.json({ error: "member_update_failed" }, { status: 400 });
  return NextResponse.json({ member: data });
}
