// Mock KYC/background-check vendor. Swap with Checkr/Persona/Stripe Identity later.
export type KycSubmission = {
  userId: string;
  firstName: string;
  lastName: string;
  dob: string;
  ssnFull: string;
  address: { line1: string; city: string; state: string; zip: string };
  dl: { number: string; state: string; expiresOn: string };
};

export type KycVendorResult = {
  vendor: "mock";
  vendorKycId: string;
  kycStatus: "in_review";
  bgStatus: "pending";
};

export async function runBackgroundCheck(s: KycSubmission): Promise<KycVendorResult> {
  // In production: POST to vendor over HTTPS, never log ssnFull.
  void s.ssnFull;
  return {
    vendor: "mock",
    vendorKycId: `mock_${crypto.randomUUID()}`,
    kycStatus: "in_review",
    bgStatus: "pending",
  };
}
