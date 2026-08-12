import { NextResponse } from "next/server";
import { ADMIN_ROLES, getCurrentProfile } from "../../../../../lib/auth";
import { parseClassInput, type ClassInput } from "../../../../../lib/class-input";
import { loadClassOperations } from "../../../../../lib/class-operations";
import { deliverClassNotifications } from "../../../../../lib/web-push";
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
  const body = await request.json().catch(() => null) as (ClassInput & { status?: "completed" | "cancelled" }) | null;
  const supabase = await createClient();
  let notificationType: "class_changed" | "class_cancelled" | null = null;
  if (body?.status) {
    const { error } = await supabase.rpc("set_class_status", { target_class_id: id, next_status: body.status });
    if (error) return NextResponse.json({ error: error.message.includes("class_closed") ? "class_closed" : "class_update_failed" }, { status: 400 });
    if (body.status === "cancelled") notificationType = "class_cancelled";
  } else {
    const parsed = parseClassInput(body, { allowPastDeadline: true });
    if (!parsed) return NextResponse.json({ error: "invalid_class" }, { status: 400 });
    const { error } = await supabase.rpc("update_class_details", { target_class_id: id, class_payload: parsed });
    if (error) return NextResponse.json({ error: error.message.includes("recruitment_locked") ? "recruitment_locked" : error.message.includes("class_closed") ? "class_closed" : "class_update_failed" }, { status: 400 });
    notificationType = "class_changed";
  }
  const [classItem] = await loadClassOperations(supabase, id);
  if (!classItem) return NextResponse.json({ error: "class_not_found" }, { status: 404 });
  const recipients = [...new Set([...classItem.recruitment_targets.map(target => target.instructor_id), ...classItem.assignments.map(assignment => assignment.instructor_id)])];
  const push = notificationType ? await deliverClassNotifications(supabase, id, recipients, notificationType) : { sent: 0, failed: 0, unavailable: 0 };
  return NextResponse.json({ class: classItem, delivery: { internal: recipients.length, push } });
}
