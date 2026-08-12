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
  const { error } = await supabase.rpc("finalize_class_assignment", {
    target_class_id: id,
    lead_instructor_id: body.leadInstructorId,
    assistant_instructor_ids: body.assistantInstructorIds,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const recipients = [body.leadInstructorId, ...body.assistantInstructorIds];
  const push = await deliverClassNotifications(supabase, id, recipients, "assignment_confirmed");
  const [classItem] = await loadClassOperations(supabase, id);
  return NextResponse.json({ class: classItem, delivery: { internal: recipients.length, push } });
}
