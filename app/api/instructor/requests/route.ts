import { NextResponse } from "next/server";
import { getCurrentProfile } from "../../../../lib/auth";
import { createClient } from "../../../../lib/supabase/server";

async function authorizeInstructor() {
  const profile = await getCurrentProfile();
  return profile?.role === "instructor" && profile.status === "active" ? profile : null;
}

export async function GET() {
  const instructor = await authorizeInstructor();
  if (!instructor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data: targets, error } = await supabase.from("class_recruitment_targets").select("id,class_id,requested_role,invited_at,last_reminded_at").eq("instructor_id", instructor.user_id).order("invited_at", { ascending: false });
  if (error) return NextResponse.json({ error: "requests_unavailable" }, { status: 500 });
  const classIds = [...new Set((targets ?? []).map(target => target.class_id))];
  const targetIds = (targets ?? []).map(target => target.id);
  const [classResult, responseResult, assignmentResult] = await Promise.all([
    classIds.length ? supabase.from("classes").select("id,title,institution,class_date,start_time,end_time,address,lead_fee,assistant_fee,fee_notes,response_deadline,status").in("id", classIds) : Promise.resolve({ data: [], error: null }),
    targetIds.length ? supabase.from("class_recruitment_responses").select("id,target_id,role,status,condition,responded_at").in("target_id", targetIds) : Promise.resolve({ data: [], error: null }),
    classIds.length ? supabase.from("class_assignments").select("id,class_id,role,fee_snapshot,assigned_at,acknowledged_at").eq("instructor_id", instructor.user_id).in("class_id", classIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (classResult.error || responseResult.error || assignmentResult.error) return NextResponse.json({ error: "requests_unavailable" }, { status: 500 });
  const classes = new Map((classResult.data ?? []).map(item => [item.id, item]));
  return NextResponse.json({ requests: (targets ?? []).map(target => ({ ...target, class: classes.get(target.class_id) ?? null, responses: (responseResult.data ?? []).filter(response => response.target_id === target.id), assignment: (assignmentResult.data ?? []).find(assignment => assignment.class_id === target.class_id) ?? null })) });
}

export async function PATCH(request: Request) {
  const instructor = await authorizeInstructor();
  if (!instructor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { responseId?: string; status?: "available" | "conditional" | "unavailable"; condition?: string } | null;
  if (!body?.responseId || !body.status || !["available", "conditional", "unavailable"].includes(body.status) || (body.status === "conditional" && !body.condition?.trim())) {
    return NextResponse.json({ error: "invalid_response" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_recruitment_response", { response_id: body.responseId, next_status: body.status, next_condition: body.condition?.trim() || null }).single();
  if (error || !data) return NextResponse.json({ error: "response_failed" }, { status: 400 });
  return NextResponse.json({ response: data });
}

export async function POST(request: Request) {
  const instructor = await authorizeInstructor();
  if (!instructor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { assignmentId?: string } | null;
  if (!body?.assignmentId) return NextResponse.json({ error: "invalid_assignment" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("acknowledge_class_assignment", { target_assignment_id: body.assignmentId });
  if (error || !data) return NextResponse.json({ error: "acknowledgement_failed" }, { status: 400 });
  return NextResponse.json({ acknowledgedAt: data });
}
