import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/server/auth";
import { supabaseUser } from "@/lib/server/supabase";

/** Magic-link landing: exchanges the one-time code for a session, then sends new users to onboarding. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  if (!code) return NextResponse.redirect(`${origin}/login?error=callback`);

  const sb = await supabaseUser();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=callback`);

  const { data } = await sb.auth.getUser();
  if (data.user) {
    const { data: profile } = await sb.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
    if (!profile) return NextResponse.redirect(`${origin}/onboarding?next=${encodeURIComponent(next)}`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
