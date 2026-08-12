import { NextResponse } from "next/server";
import { ADMIN_ROLES, getCurrentProfile } from "../../../../lib/auth";
import { parseClassInput, type ClassInput } from "../../../../lib/class-input";
import { loadClassOperations } from "../../../../lib/class-operations";
import { createClient } from "../../../../lib/supabase/server";

async function authorize() {
  const profile = await getCurrentProfile();
  return profile && profile.status === "active" && ADMIN_ROLES.includes(profile.role) ? profile : null;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const parsed = parseClassInput(body);
  const creationKey = body?.creationKey || request.headers.get("x-idempotency-key") || "";
  if (!parsed || !uuidPattern.test(creationKey)) return NextResponse.json({ error: "invalid_class" }, { status: 400 });

  const supabase = await createClient();
  let duplicate = false;
  let { data, error } = await supabase.from("classes").insert({
    ...parsed,
    status: "registered",
    created_by: actor.user_id,
    creation_key: creationKey,
  }).select("id").single();

  if (error?.code === "23505") {
    duplicate = true;
    const existing = await supabase.from("classes").select("id").eq("created_by", actor.user_id).eq("creation_key", creationKey).single();
    data = existing.data;
    error = existing.error;
  }
  if (error || !data) return NextResponse.json({ error: "class_create_failed" }, { status: 400 });
  if (!duplicate) await supabase.rpc("record_admin_activity", {
      activity_action: "class_created",
      activity_details: { class_id: data.id, class_name: parsed.title },
    });
  try {
    const [createdClass] = await loadClassOperations(supabase, data.id);
    return NextResponse.json({ class: createdClass, duplicate }, { status: duplicate ? 200 : 201 });
  } catch {
    return NextResponse.json({ error: "class_read_failed" }, { status: 500 });
  }
}
