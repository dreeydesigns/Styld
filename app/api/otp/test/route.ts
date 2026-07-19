import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // =========================================================================
  // FIREBASE MIGRATION NOTE:
  // This diagnostic endpoint previously tested the Africa's Talking API
  // and Postgres database. Since Firebase Phone Auth runs entirely on the
  // frontend, this backend test is no longer needed.
  // =========================================================================

  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // We can return a quick diagnostic to ensure your new Firebase env vars 
  // are successfully being read by the server.
  const results = {
    status: "migrated",
    message: "OTP system is now handled client-side by Firebase.",
    firebase_env_vars_detected: {
      apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    }
  };

  return NextResponse.json(results, { status: 200 });
}