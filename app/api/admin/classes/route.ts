import { NextResponse } from "next/server";
import { ADMIN_ROLES, getCurrentProfile } from "../../../../lib/auth";
import { loadClassOperations } from "../../../../lib/class-operations";
import { createClient } from "../../../../lib/supabase/server";

type ClassInput = {
  title?: string;
  institution?: string;
  contact?: string;
  classDate?: string;
  startTime?: string;
  endTime?: string;
  address?: string;
  targetGroup?: string;
  grade?: string;
  participantCount?: number;
  description?: string;
  assistantCount?: number;
  leadFee?: number;
  assistantFee?: number;
  feeNotes?: string;
  deadlineDate?: string;
  deadlineTime?: string;
};

async function authorize() {
  const profile = await getCurrentProfile();
  return profile && profile.status === "active" && ADMIN_ROLES.includes(profile.role) ? profile : null;
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";

export async function GET() {
  if (!await authorize()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = await createClient();
  try {
    return NextResponse.json({ classes: await loadClassOperations(supabase) });
  } catch {
    return NextResponse.json({ error: "classes_unavailable" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await authorize();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as ClassInput | null;
  const title = clean(body?.title);
  const institution = clean(body?.institution);
  const classDate = clean(body?.classDate);
  const startTime = clean(body?.startTime);
  const endTime = clean(body?.endTime);
  const address = clean(body?.address);
  const deadlineDate = clean(body?.deadlineDate);
  const deadlineTime = clean(body?.deadlineTime);
  const participantCount = Number(body?.participantCount);
  const assistantCount = Number(body?.assistantCount);
  const leadFee = Number(body?.leadFee);
  const assistantFee = assistantCount === 0 ? 0 : Number(body?.assistantFee);

  const invalid = title.length < 2 || institution.length < 2 || address.length < 2
    || !datePattern.test(classDate) || !datePattern.test(deadlineDate)
    || !timePattern.test(startTime) || !timePattern.test(endTime) || !timePattern.test(deadlineTime)
    || startTime >= endTime || !Number.isInteger(participantCount) || participantCount < 1
    || !Number.isInteger(assistantCount) || assistantCount < 0 || assistantCount > 2
    || !Number.isInteger(leadFee) || leadFee < 0
    || !Number.isInteger(assistantFee) || assistantFee < 0;
  if (invalid) return NextResponse.json({ error: "invalid_class" }, { status: 400 });

  const responseDeadline = new Date(`${deadlineDate}T${deadlineTime}:00+09:00`);
  if (Number.isNaN(responseDeadline.getTime())) {
    return NextResponse.json({ error: "invalid_deadline" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("classes").insert({
    title,
    institution,
    contact: clean(body?.contact) || null,
    class_date: classDate,
    start_time: startTime,
    end_time: endTime,
    address,
    target_group: clean(body?.targetGroup) || "미정",
    grade: clean(body?.grade) || "미정",
    participant_count: participantCount,
    description: clean(body?.description),
    lead_count: 1,
    assistant_count: assistantCount,
    lead_fee: leadFee,
    assistant_fee: assistantFee,
    fee_notes: clean(body?.feeNotes),
    response_deadline: responseDeadline.toISOString(),
    status: "registered",
    created_by: actor.user_id,
  }).select("id").single();

  if (error) return NextResponse.json({ error: "class_create_failed" }, { status: 400 });
  await supabase.rpc("record_admin_activity", {
    activity_action: "class_created",
    activity_details: { class_id: data.id, class_name: title },
  });
  try {
    const [createdClass] = await loadClassOperations(supabase, data.id);
    return NextResponse.json({ class: createdClass }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "class_read_failed" }, { status: 500 });
  }
}
