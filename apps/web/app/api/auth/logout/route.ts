import { NextResponse, type NextRequest } from "next/server";
import { MOCK_COOKIE } from "@/lib/server/auth";
import { getConfig } from "@/lib/server/config";

export function POST(request: NextRequest) {
  const cfg = getConfig();
  const res = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  if (cfg.mockBackend) res.cookies.delete(MOCK_COOKIE);
  else if (cfg.backend === "mongo") res.cookies.delete("coach_guest");
  return res;
}
