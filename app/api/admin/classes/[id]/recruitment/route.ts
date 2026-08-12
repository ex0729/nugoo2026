import { NextResponse } from "next/server";
import { ADMIN_ROLES, getCurrentProfile } from "../../../../../../lib/auth";
import { loadClassOperations } from "../../../../../../lib/class-operations";
import { deliverClassNotifications } from "../../../../../../lib/web-push";
import { createClient } from "../../../../../../lib/supabase/server";

type TargetInput = { instructorId?: string; requestedRole?: "lead" | "assistant" | "both" };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.status !== "active" || !ADMIN_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null) as { targets?: TargetInput[] } | null;
  const targets = body?.targets ?? [];
  if (targets.length === 0 || targets.some(target => !target.instructorId || !target.requestedRole || !["lead", "assistant", "both"].includes(target.requestedRole))) {
    return NextResponse.json({ error: "invalid_targets" }, { status: 400 });
  }
  if (new Set(targets.map(target => target.instructorId)).size !== targets.length) {
    return NextResponse.json({ error: "duplicate_instructor" }, { status: 400 });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_class_recruitment", {
    target_class_id: id,
    recruitment: targets.map(target => ({ instructor_id: target.instructorId, requested_role: target.requestedRole })),
  });
  if (error) {
    const code = error.message.includes("responses_already_exist") ? "responses_already_exist" : "recruitment_failed";
    return NextResponse.json({ error: code }, { status: 400 });
  }
  const push = await deliverClassNotifications(supabase, id, targets.map(target => target.instructorId!), "class_request");
  const [classItem] = await loadClassOperations(supabase, id);
  return NextResponse.json({ class: classItem, delivery: { internal: targets.length, push } });
}
