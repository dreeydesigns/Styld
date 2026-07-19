"use client";

/**
 * components/otp-input.tsx
 *
 * Self-contained 6-digit OTP entry that:
 *  - Auto-advances focus between boxes
 *  - Handles paste of a full 6-digit code
 *  - Calls POST /api/otp/verify automatically when all 6 digits are filled
 *  - Shakes and clears on wrong code, with server-driven error message
 *  - Shows a resend countdown and calls POST /api/otp/send on resend
 *  - Calls onVerified() when the code is accepted
 */

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendOTP, verifyOTP } from "@/lib/phone-auth";

interface OTPInputProps {
  /** Full E.164 phone number being verified, e.g. "+254743817931" */
  phone: string;
  /** Called once the server confirms the code is correct */
  onVerified: () => void;
  /** Accent colour for the verify button and filled-box borders */
  accentColor?: string;
}

const LEN = 6;

export function OTPInput({
  phone,
  onVerified,
  accentColor = "var(--ms-plum)",
}: OTPInputProps) {
  const [digits, setDigits]       = useState<string[]>(Array(LEN).fill(""));
  const [status, setStatus]       = useState<"idle" | "loading" | "error" | "success">("idle");
  const [errorMsg, setErrorMsg]   = useState("");
  const [shake, setShake]         = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [devOtp, setDevOtp]       = useState("");

  const refs = useRef<Array<HTMLInputElement | null>>([]);

  // Check for mock/dev OTP codes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const interval = setInterval(() => {
        if ((window as any).__latestMockOTP) {
          setDevOtp((window as any).__latestMockOTP);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, []);

  // Resend countdown
  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown]);

  // ── digit input ──────────────────────────────────────────────────────────────

  function handleChange(i: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = digit;
    setDigits(next);
    setErrorMsg("");

    if (digit && i < LEN - 1) {
      refs.current[i + 1]?.focus();
    }
    // Auto-submit when last box filled
    if (digit && i === LEN - 1 && next.every(Boolean)) {
      void verify(next.join(""));
    }
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (digits[i]) {
        const next = [...digits];
        next[i] = "";
        setDigits(next);
      } else if (i > 0) {
        const next = [...digits];
        next[i - 1] = "";
        setDigits(next);
        refs.current[i - 1]?.focus();
      }
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LEN);
    if (pasted.length === LEN) {
      const next = pasted.split("");
      setDigits(next);
      refs.current[LEN - 1]?.focus();
      void verify(pasted);
    }
  }

  // ── verify ───────────────────────────────────────────────────────────────────

  async function verify(code: string) {
    setStatus("loading");
    setErrorMsg("");

    const result = await verifyOTP(code);

    if (result.ok) {
      setStatus("success");
      onVerified();
      return;
    }

    // Wrong / expired code
    setStatus("error");
    setErrorMsg(result.error ?? "Incorrect code. Try again.");

    // Shake and reset boxes on failure
    setShake(true);
    window.setTimeout(() => setShake(false), 500);
    setDigits(Array(LEN).fill(""));
    window.setTimeout(() => {
      refs.current[0]?.focus();
      setStatus("idle");
    }, 100);
  }

  // ── resend ───────────────────────────────────────────────────────────────────

  async function resend() {
    if (!canResend || resendCount >= 3) return;
    const next = resendCount + 1;
    setResendCount(next);
    setCanResend(false);
    setCountdown(30);
    setDigits(Array(LEN).fill(""));
    setErrorMsg("");
    refs.current[0]?.focus();

    // Re-send via Firebase — silent fail, user sees countdown reset as confirmation
    await sendOTP(phone).catch(() => null);
  }

  const allFilled = digits.every(Boolean);
  const loading   = status === "loading";

  return (
    <div className="mt-6 space-y-4">
      {devOtp && (
        <div className="rounded-[16px] border border-amber-200 bg-amber-50/70 p-3.5 text-center text-sm font-medium text-amber-900 transition-all shadow-sm">
          <span className="inline-block px-1.5 py-0.5 rounded bg-amber-200 text-xs font-bold mr-1.5 uppercase tracking-wide">OTP</span>
          Simulated code sent: <span className="font-mono text-base font-bold tracking-widest text-amber-900 select-all">{devOtp}</span>
        </div>
      )}

      {/* 6 boxes */}
      <div
        className={cn(
          "grid grid-cols-6 gap-2",
          shake && "otp-shake",
        )}
      >
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            aria-label={`Verification code digit ${i + 1}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            disabled={loading || status === "success"}
            className={cn(
              "h-14 rounded-[18px] border-2 bg-[var(--ms-soft-bg)] text-center text-xl font-semibold text-[var(--ms-navy)] outline-none transition-colors",
              status === "error"
                ? "border-[var(--ms-danger)]"
                : digit
                  ? "border-current"
                  : "border-[var(--ms-border)]",
            )}
            style={
              status !== "error" && digit
                ? { borderColor: accentColor }
                : undefined
            }
          />
        ))}
      </div>

      {/* Error message */}
      {errorMsg && (
        <p className="text-sm font-semibold text-[var(--ms-danger)]">{errorMsg}</p>
      )}

      {/* Verify button — appears when all filled; acts as fallback if auto-submit missed */}
      {allFilled && status !== "success" && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void verify(digits.join(""))}
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white transition disabled:opacity-40"
          style={{ backgroundColor: accentColor }}
        >
          {loading ? (
            "Verifying…"
          ) : (
            <>
              Verify &amp; continue
              <Check className="h-4 w-4" />
            </>
          )}
        </button>
      )}

      {/* Resend */}
      <div className="text-center text-sm">
        {resendCount >= 3 ? (
          <p className="text-[var(--ms-danger)]">
            Too many attempts. Wait 10 minutes and try again.
          </p>
        ) : canResend ? (
          <button
            type="button"
            onClick={() => void resend()}
            className="font-semibold text-[var(--ms-plum)] underline-offset-2 hover:underline"
          >
            Resend code
          </button>
        ) : (
          <span className="text-[var(--ms-mauve)]">
            Resend available in {countdown}s
          </span>
        )}
      </div>
    </div>
  );
}
