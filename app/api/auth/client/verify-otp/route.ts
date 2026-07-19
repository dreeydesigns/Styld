import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

function isKenyanPhone(phone: unknown) {
  return typeof phone === "string" && /^\+254\d{9}$/.test(phone);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    phone?: unknown;
    code?: unknown;
  } | null;

  if (!isKenyanPhone(body?.phone)) {
    return NextResponse.json(
      { ok: false, verified: false, message: "Invalid phone number." },
      { status: 400 }
    );
  }

  const phone = body!.phone as string;
  const code = body?.code;

  if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { ok: false, verified: false, message: "Invalid OTP format." },
      { status: 400 }
    );
  }

  try {
    // Check OTP in database — must be valid and not expired
    const result = await sql`
      SELECT id FROM otps
      WHERE phone = ${phone}
        AND code = ${code}
        AND expires_at > NOW()
        AND verified_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { ok: false, verified: false, message: "Invalid or expired OTP." },
        { status: 401 }
      );
    }

    // Mark OTP as verified
    await sql`
      UPDATE otps SET verified_at = NOW() WHERE id = ${result.rows[0].id}
    `;

    return NextResponse.json({ ok: true, verified: true });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { ok: false, verified: false, message: "Server error. Please try again." },
      { status: 500 }
    );
  }
}
