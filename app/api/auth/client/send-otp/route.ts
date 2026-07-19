import { NextRequest, NextResponse } from 'next/server';
import { sql } from "@vercel/postgres";

function isKenyanPhone(phone: unknown) {
  return typeof phone === "string" && /^\+254\d{9}$/.test(phone);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    phone?: unknown;
  } | null;

  if (!isKenyanPhone(body?.phone)) {
    return NextResponse.json(
      { ok: false, success: false, message: "Invalid Kenyan phone number format. Must start with +254 followed by 9 digits." },
      { status: 400 }
    );
  }

  const phone = body!.phone as string;
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

  try {
    // Insert OTP into the database
    await sql`
      INSERT INTO otps (phone, code, expires_at)
      VALUES (${phone}, ${code}, ${expiresAt.toISOString()})
    `;

    console.log(`[Database OTP] Generated OTP ${code} for phone ${phone}`);

    // Return the code directly so that client-side mock fallback can retrieve/display it if needed.
    return NextResponse.json({ 
      success: true,
      ok: true,
      code,
      message: 'OTP has been generated and saved to database successfully.'
    });
  } catch (error) {
    console.error("Database OTP generation error:", error);
    return NextResponse.json(
      { ok: false, success: false, message: "Server error generating OTP." },
      { status: 500 }
    );
  }
}
