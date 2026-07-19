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

    // Try to send via AfricasTalking if credentials are set
    const atUsername = process.env.AFRICASTALKING_USERNAME;
    const atApiKey = process.env.AFRICASTALKING_API_KEY;
    let smsSent = false;
    let atResponseData = null;

    if (atUsername && atApiKey && atUsername !== 'sandbox') {
      try {
        const params = new URLSearchParams();
        params.append('username', atUsername);
        params.append('to', phone);
        params.append('message', `Your Styld verification code is: ${code}`);

        console.log(`[AfricasTalking] Attempting to send SMS to ${phone}...`);
        const atRes = await fetch('https://api.africastalking.com/version1/messaging', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'apiKey': atApiKey,
          },
          body: params.toString(),
        });

        atResponseData = await atRes.json();
        console.log('[AfricasTalking] API Response:', JSON.stringify(atResponseData));
        smsSent = true;
      } catch (smsError) {
        console.error('[AfricasTalking] Error sending SMS via AfricasTalking:', smsError);
      }
    } else {
      console.log('[AfricasTalking] Missing or sandbox credentials. Real SMS skipped.');
    }

    // Return the code directly so that client-side mock fallback can retrieve/display it if needed.
    return NextResponse.json({ 
      success: true,
      ok: true,
      code,
      smsSent,
      atResponse: atResponseData,
      message: smsSent 
        ? 'OTP has been generated and sent via AfricasTalking successfully.'
        : 'OTP has been generated and saved to database successfully.'
    });
  } catch (error) {
    console.error("Database OTP generation error:", error);
    return NextResponse.json(
      { ok: false, success: false, message: "Server error generating OTP." },
      { status: 500 }
    );
  }
}
