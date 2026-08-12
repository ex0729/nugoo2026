import { NextResponse } from "next/server";
import { ADMIN_ROLES, getCurrentProfile } from "../../../../../../lib/auth";
import { loadClassOperations } from "../../../../../../lib/class-operations";
import { deliverClassNotifications } from "../../../../../../lib/web-push";
import { createClient } from "../../../../../../lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.status !== "active" || !ADMIN_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null) as { leadInstructorId?: string; assistantInstructorIds?: string[] } | null;
  if (!body?.leadInstructorId || !Array.isArray(body.assistantInstructorIds)) {
    return NextResponse.json({ error: "invalid_assignment" }, { status: 400 });
  }
  const supabase = await createClient();
  const [existingClass] = await loadClassOperations(supabase, id);
  if (!existingClass) return NextResponse.json({ error: "class_not_found" }, { status: 404 });
  const rpcName = existingClass.status === "assigned" ? "replace_class_assignment" : "finalize_class_assignment";
  const { error } = await supabase.rpc(rpcName, {
    target_class_id: id,
    lead_instructor_id: body.leadInstructorId,
    assistant_instructor_ids: body.assistantInstructorIds,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const [classItem] = await loadClassOperations(supabase, id);
  if (!classItem) return NextResponse.json({ error: "class_not_found" }, { status: 404 });
  const recipients = [body.leadInstructorId, ...body.assistantInstructorIds];
  const notSelected = classItem.recruitment_targets.map(target => target.instructor_id).filter(userId => !recipients.includes(userId));
  const [confirmedPush, resultPush] = await Promise.all([
    deliverClassNotifications(supabase, id, recipients, "assignment_confirmed"),
    deliverClassNotifications(supabase, id, notSelected, "assignment_result"),
  ]);
  return NextResponse.json({ class: classItem, delivery: { internal: classItem.recruitment_targets.length, push: { sent: confirmedPush.sent + resultPush.sent, failed: confirmedPush.failed + resultPush.failed, unavailable: confirmedPush.unavailable + resultPush.unavailable } } });
}
