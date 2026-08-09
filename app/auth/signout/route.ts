import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next = requestedNext === "/instructor/login" ? requestedNext : "/login";
  return NextResponse.redirect(new URL(next, request.url));
}
