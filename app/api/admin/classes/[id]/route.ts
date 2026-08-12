import { NextResponse } from "next/server";
import { ADMIN_ROLES, getCurrentProfile } from "../../../../../lib/auth";
import { loadClassOperations } from "../../../../../lib/class-operations";
import { createClient } from "../../../../../lib/supabase/server";

async function authorize() {
  const profile = await getCurrentProfile();
  return profile && profile.status === "active" && ADMIN_ROLES.includes(profile.role) ? profile : null;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await authorize()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = await createClient();
  try {
    const [classItem] = await loadClassOperations(supabase, id);
    if (!classItem) return NextResponse.json({ error: "class_not_found" }, { status: 404 });
    return NextResponse.json({ class: classItem });
  } catch {
    return NextResponse.json({ error: "class_unavailable" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await authorize()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as { status?: "completed" | "cancelled" } | null;
  if (!body?.status || !["completed", "cancelled"].includes(body.status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const supabase = await createClient();
  const { error } = await supabase.from("classes").update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: "class_update_failed" }, { status: 400 });
  await supabase.rpc("record_admin_activity", {
    activity_action: body.status === "cancelled" ? "class_cancelled" : "class_updated",
    activity_details: { class_id: id, status: body.status },
  });
  const [classItem] = await loadClassOperations(supabase, id);
  return NextResponse.json({ class: classItem });
}
