'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';

// 1. Firebase Initialization
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyA1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "mock-salon.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mock-salon",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "mock-salon.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1234567890:web:1234567890",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

declare global { interface Window { recaptchaVerifier: any; confirmationResult: ConfirmationResult; } }

export default function SignupPage() {
  const router = useRouter();
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Timer and Form fields for Step 3
  const [resendCountdown, setResendCountdown] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isMockFirebaseConfig = () => {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const projId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    return !apiKey || apiKey === "AIzaSyA1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q" || projId === "mock-salon" || projId === "";
  };

  useEffect(() => {
    // 2. Initialize Firebase's built-in Recaptcha without the manual Enterprise sitekey
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible',
    });
  }, []);

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      setPhone('');
      return;
    }

    // Remove non-digits
    let digits = val.replace(/\D/g, '');

    // Only apply +254 logic if typing or has substantial length
    if (digits.startsWith('0')) {
      digits = '254' + digits.slice(1);
    } else if (digits.length > 0 && !digits.startsWith('254')) {
      if (digits !== '25' && digits !== '2') {
        digits = '254' + digits;
      }
    }

    digits = digits.slice(0, 12);
    setPhone('+' + digits);
  };

  const [signUpLatestOTP, setSignUpLatestOTP] = useState('');

  useEffect(() => {
    if (typeof window !== "undefined") {
      const interval = setInterval(() => {
        if ((window as any).__latestMockOTP) {
          setSignUpLatestOTP((window as any).__latestMockOTP);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, []);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (isMockFirebaseConfig()) {
        console.log(`[Dev Mode] Requesting simulated OTP via database...`);
        let generatedCode = "123456";
        try {
          const res = await fetch('/api/auth/client/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone }),
          });
          const data = await res.json();
          if (data.ok) {
            generatedCode = data.code;
            if (typeof window !== "undefined") {
              (window as any).__latestMockOTP = generatedCode;
              (window as any).__latestMockPhone = phone;
              setSignUpLatestOTP(generatedCode);
            }
          }
        } catch (e) {
          console.error("Failed to generate database OTP, using 123456.", e);
        }

        if (typeof window !== "undefined") {
          alert(`[Dev Mode] Simulated SMS sent to ${phone}. Enter code: ${generatedCode}`);
        }
        window.confirmationResult = {
          confirm: async (code: string) => {
            if (code === generatedCode || code === "123456") {
              return { user: { phoneNumber: phone } } as any;
            }
            throw new Error("Invalid mock OTP code.");
          }
        } as any;
        setStep(2);
        setResendCountdown(60);
        return;
      }

      const confirmation = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      window.confirmationResult = confirmation;
      setStep(2);
      setResendCountdown(60);
    } catch (err: any) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (isMockFirebaseConfig()) {
        console.log(`[Dev Mode] Resending simulated SMS via database for: ${phone}`);
        let generatedCode = "123456";
        try {
          const res = await fetch('/api/auth/client/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone }),
          });
          const data = await res.json();
          if (data.ok) {
            generatedCode = data.code;
            if (typeof window !== "undefined") {
              (window as any).__latestMockOTP = generatedCode;
              (window as any).__latestMockPhone = phone;
              setSignUpLatestOTP(generatedCode);
            }
          }
        } catch (e) {
          console.error("Failed to generate database OTP on resend, using 123456.", e);
        }

        if (typeof window !== "undefined") {
          alert(`[Dev Mode] Simulated SMS resent to ${phone}. Enter code: ${generatedCode}`);
        }
        window.confirmationResult = {
          confirm: async (code: string) => {
            if (code === generatedCode || code === "123456") {
              return { user: { phoneNumber: phone } } as any;
            }
            throw new Error("Invalid mock OTP code.");
          }
        } as any;
        setSuccessMessage('A new OTP has been sent.');
        setResendCountdown(60);
        return;
      }

      const confirmation = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      window.confirmationResult = confirmation;
      setSuccessMessage('A new OTP has been sent.');
      setResendCountdown(60);
    } catch (err: any) {
      setError('Error resending OTP: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await window.confirmationResult.confirm(otpCode);
      setStep(3);
    } catch (err: any) {
      setError('Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch('/api/auth/client/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          phone,
          password,
        }),
      });
      const data = await response.json();
      if (data.ok) {
        router.push('/dashboard');
      } else {
        setError(data.message || 'Failed to complete signup.');
      }
    } catch (err: any) {
      setError('Error setting up password: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6">
      {/* 3. Container required by Firebase */}
      <div id="recaptcha-container"></div>
      
      {error && <p className="text-red-500 text-xs mb-4">{error}</p>}
      {successMessage && <p className="text-green-600 text-xs mb-4">{successMessage}</p>}

      {step === 1 ? (
        <form onSubmit={handleRequestOTP} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone Number</label>
            <input 
              type="tel" 
              value={phone} 
              onChange={handlePhoneChange} 
              placeholder="+254XXXXXXXXX" 
              required 
              className="w-full border p-2 text-black rounded focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || phone.length < 12} 
            className="w-full bg-black text-white py-2 rounded font-medium disabled:opacity-50 hover:bg-gray-800 transition-colors flex items-center justify-center"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sending...
              </span>
            ) : (
              'Request Code'
            )}
          </button>
        </form>
      ) : step === 2 ? (
        <form onSubmit={handleVerifyOTP} className="space-y-4">
          {signUpLatestOTP && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-center text-sm font-medium text-amber-800 shadow-sm">
              <span className="inline-block px-1 rounded bg-amber-200 text-xs font-bold mr-1 uppercase">OTP</span>
              Simulated code: <span className="font-mono text-base font-bold tracking-widest text-amber-900 select-all">{signUpLatestOTP}</span>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">OTP Code</label>
            <input 
              type="text" 
              value={otpCode} 
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} 
              placeholder="000000" 
              required 
              className="w-full border p-2 text-black rounded focus:outline-none focus:ring-2 focus:ring-black tracking-widest text-center text-lg font-bold"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || !/^\d{6}$/.test(otpCode)} 
            className="w-full bg-black text-white py-2 rounded font-medium disabled:opacity-50 hover:bg-gray-800 transition-colors flex items-center justify-center"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Verifying...
              </span>
            ) : (
              'Verify & Register'
            )}
          </button>
          
          <div className="flex justify-between items-center text-sm pt-2">
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={loading || resendCountdown > 0}
              className="text-blue-600 hover:underline disabled:opacity-50 disabled:no-underline disabled:text-gray-400"
            >
              {resendCountdown > 0 ? `Resend OTP in ${resendCountdown}s` : 'Resend OTP'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setOtpCode('');
                setError(null);
                setSuccessMessage(null);
              }}
              disabled={loading}
              className="text-gray-600 hover:underline disabled:opacity-50"
            >
              Change number
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handlePasswordSetup} className="space-y-4">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Create Password</h2>
          <p className="text-xs text-gray-500 mb-4">Set up your account credentials for secure future login.</p>
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">First Name</label>
            <input 
              type="text" 
              value={firstName} 
              onChange={(e) => setFirstName(e.target.value)} 
              placeholder="First Name" 
              required 
              className="w-full border p-2 text-black rounded focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Password (Min 6 characters)</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Password" 
              required 
              className="w-full border p-2 text-black rounded focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Confirm Password</label>
            <input 
              type="password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              placeholder="Confirm Password" 
              required 
              className="w-full border p-2 text-black rounded focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || !firstName.trim() || password.length < 6 || password !== confirmPassword} 
            className="w-full bg-black text-white py-2 rounded font-medium disabled:opacity-50 hover:bg-gray-800 transition-colors flex items-center justify-center"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating Account...
              </span>
            ) : (
              'Create Account & Finish'
            )}
          </button>
        </form>
      )}
    </div>
  );
}