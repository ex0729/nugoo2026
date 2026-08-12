import type { SupabaseClient } from "@supabase/supabase-js";

export type OperationalClassStatus = "registered" | "recruiting" | "reviewing" | "assignment_needed" | "assigned" | "completed" | "cancelled";

type ClassRow = {
  id: string;
  title: string;
  institution: string;
  contact: string | null;
  class_date: string;
  start_time: string;
  end_time: string;
  address: string;
  target_group: string;
  grade: string;
  participant_count: number;
  description: string;
  lead_count: number;
  assistant_count: number;
  lead_fee: number;
  assistant_fee: number;
  fee_notes: string;
  response_deadline: string;
  status: OperationalClassStatus;
  created_at: string;
  updated_at: string;
};

type TargetRow = { id: string; class_id: string; instructor_id: string; requested_role: "lead" | "assistant" | "both"; invited_at: string; last_reminded_at: string | null };
type ResponseRow = { id: string; target_id: string; role: "lead" | "assistant"; status: "pending" | "available" | "conditional" | "unavailable"; condition: string | null; responded_at: string | null };
type AssignmentRow = { id: string; class_id: string; instructor_id: string; role: "lead" | "assistant"; fee_snapshot: number; assigned_at: string };
type ProfileRow = { user_id: string; full_name: string; email: string; status: string };

export type ClassOperationsItem = ClassRow & {
  operational_status: OperationalClassStatus;
  target_count: number;
  lead_response_count: number;
  assistant_response_count: number;
  conditional_count: number;
  instructor_names: string[];
  recruitment_targets: Array<TargetRow & { instructor: ProfileRow | null; responses: ResponseRow[] }>;
  assignments: Array<AssignmentRow & { instructor: ProfileRow | null }>;
};

function effectiveStatus(classRow: ClassRow, targets: TargetRow[], responses: ResponseRow[]): OperationalClassStatus {
  if (["assigned", "completed", "cancelled"].includes(classRow.status)) return classRow.status;
  const conditional = responses.some(response => response.status === "conditional");
  if (conditional) return "reviewing";
  const leadReady = responses.filter(response => response.role === "lead" && ["available", "conditional"].includes(response.status)).length >= 1;
  const assistantReady = responses.filter(response => response.role === "assistant" && ["available", "conditional"].includes(response.status)).length >= classRow.assistant_count;
  if (targets.length > 0 && leadReady && assistantReady) return "assignment_needed";
  if (targets.length > 0) return "recruiting";
  return "registered";
}

export async function loadClassOperations(supabase: SupabaseClient, classId?: string) {
  let classQuery = supabase.from("classes").select("id,title,institution,contact,class_date,start_time,end_time,address,target_group,grade,participant_count,description,lead_count,assistant_count,lead_fee,assistant_fee,fee_notes,response_deadline,status,created_at,updated_at").order("class_date", { ascending: true });
  if (classId) classQuery = classQuery.eq("id", classId);
  const { data: classData, error: classError } = await classQuery;
  if (classError) throw classError;
  const classes = (classData ?? []) as ClassRow[];
  if (classes.length === 0) return [];

  const classIds = classes.map(item => item.id);
  const { data: targetData, error: targetError } = await supabase.from("class_recruitment_targets").select("id,class_id,instructor_id,requested_role,invited_at,last_reminded_at").in("class_id", classIds);
  if (targetError) throw targetError;
  const targets = (targetData ?? []) as TargetRow[];
  const targetIds = targets.map(item => item.id);

  const responseResult = targetIds.length
    ? await supabase.from("class_recruitment_responses").select("id,target_id,role,status,condition,responded_at").in("target_id", targetIds)
    : { data: [], error: null };
  if (responseResult.error) throw responseResult.error;
  const responses = (responseResult.data ?? []) as ResponseRow[];

  const { data: assignmentData, error: assignmentError } = await supabase.from("class_assignments").select("id,class_id,instructor_id,role,fee_snapshot,assigned_at").in("class_id", classIds);
  if (assignmentError) throw assignmentError;
  const assignments = (assignmentData ?? []) as AssignmentRow[];

  const instructorIds = [...new Set([...targets.map(item => item.instructor_id), ...assignments.map(item => item.instructor_id)])];
  const profileResult = instructorIds.length
    ? await supabase.from("user_profiles").select("user_id,full_name,email,status").in("user_id", instructorIds)
    : { data: [], error: null };
  if (profileResult.error) throw profileResult.error;
  const profiles = (profileResult.data ?? []) as ProfileRow[];
  const profileMap = new Map(profiles.map(profile => [profile.user_id, profile]));

  return classes.map(classRow => {
    const classTargets = targets.filter(target => target.class_id === classRow.id);
    const classTargetIds = new Set(classTargets.map(target => target.id));
    const classResponses = responses.filter(response => classTargetIds.has(response.target_id));
    const readyResponses = classResponses.filter(response => ["available", "conditional"].includes(response.status));
    const classAssignments = assignments.filter(assignment => assignment.class_id === classRow.id);
    return {
      ...classRow,
      operational_status: effectiveStatus(classRow, classTargets, classResponses),
      target_count: classTargets.length,
      lead_response_count: readyResponses.filter(response => response.role === "lead").length,
      assistant_response_count: readyResponses.filter(response => response.role === "assistant").length,
      conditional_count: classResponses.filter(response => response.status === "conditional").length,
      instructor_names: [...new Set([...classTargets, ...classAssignments].map(item => profileMap.get(item.instructor_id)?.full_name).filter((name): name is string => Boolean(name)))],
      recruitment_targets: classTargets.map(target => ({
        ...target,
        instructor: profileMap.get(target.instructor_id) ?? null,
        responses: classResponses.filter(response => response.target_id === target.id),
      })),
      assignments: classAssignments.map(assignment => ({ ...assignment, instructor: profileMap.get(assignment.instructor_id) ?? null })),
    } satisfies ClassOperationsItem;
  });
}
