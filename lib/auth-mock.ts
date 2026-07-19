// lib/auth-mock.ts
export const mockSendOTP = async (phoneNumber: string) => {
  console.log(`[MVP MOCK] Sending OTP to ${phoneNumber}`);
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  // Return a mock confirmation result
  return {
    verificationId: "mock-verification-id-12345",
  };
};