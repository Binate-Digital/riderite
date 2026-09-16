import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestHeader } from "@tanstack/react-start/server";
import { runBackgroundCheck } from "./kyc/vendor";

async function sendKycEmail(opts: {
  userId: string;
  template: "kyc-approved" | "kyc-rejected";
  reviewerNotes?: string | null;
}) {
  try {
    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(opts.userId);
    const email = userRes?.user?.email;
    if (!email) return;
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("full_name").eq("id", opts.userId).maybeSingle();
    const firstName = profile?.full_name?.split(" ")[0] ?? undefined;

    // Hardcoded internal origin — never derive from request headers (SSRF risk:
    // attacker-controlled Host/X-Forwarded-Host could exfiltrate the service-role key).
    const origin = process.env.INTERNAL_ORIGIN ?? "https://getriderite.com";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return;

    await fetch(`${origin}/lovable/email/transactional/send`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        templateName: opts.template,
        recipientEmail: email,
        idempotencyKey: `${opts.template}-${opts.userId}-${Date.now()}`,
        templateData: { firstName, reviewerNotes: opts.reviewerNotes ?? null },
      }),
    });
  } catch (e) {
    console.error("sendKycEmail failed", e);
  }
}



export const TOS_VERSION = "fl-tnc-2026-05";

const today = () => new Date().toISOString().slice(0, 10);

const SubmitSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ssnFull: z.string().regex(/^\d{9}$/, "SSN must be 9 digits"),
  address: z.object({
    line1: z.string().trim().min(3).max(120),
    city: z.string().trim().min(1).max(60),
    state: z.literal("FL"),
    zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  }),
  dl: z.object({
    number: z.string().trim().min(4).max(20),
    state: z.string().length(2),
    expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  vehicle: z.object({
    vehicle_type: z.enum(["sedan", "suv", "truck"]),
    make: z.string().trim().min(1).max(50),
    model: z.string().trim().min(1).max(50),
    year: z.number().int().min(2005).max(new Date().getFullYear() + 1),
    license_plate: z.string().trim().min(2).max(12).regex(/^[A-Z0-9 -]+$/i),
    vin: z.string().trim().length(17).regex(/^[A-HJ-NPR-Z0-9]+$/i),
    registrationExpiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  insurance: z.object({
    carrier: z.string().trim().min(2).max(80),
    policyNumber: z.string().trim().min(3).max(60),
    expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  consents: z.object({
    fcra: z.literal(true),
    mvr: z.literal(true),
    sexOffender: z.literal(true),
    disqualifyingOffenses: z.literal(true),
    tos: z.literal(true),
  }),
});

function ageOnDate(dob: string, on: string) {
  const d = new Date(dob), o = new Date(on);
  let a = o.getFullYear() - d.getFullYear();
  const m = o.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && o.getDate() < d.getDate())) a--;
  return a;
}

export const submitDriverKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SubmitSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = today();

    if (ageOnDate(data.dob, now) < 19) throw new Error("Drivers must be at least 19 (Florida TNC law).");
    if (data.dl.expiresOn <= now) throw new Error("Driver's license is expired.");
    if (data.insurance.expiresOn <= now) throw new Error("Insurance policy is expired.");
    if (data.vehicle.registrationExpiresOn <= now) throw new Error("Vehicle registration is expired.");

    const vehicleAgeYears = new Date().getFullYear() - data.vehicle.year;
    if (vehicleAgeYears > 20) throw new Error("Vehicle is older than 20 years.");

    // Run vendor check. Never persist full SSN.
    const vendorResult = await runBackgroundCheck({
      userId,
      firstName: data.firstName,
      lastName: data.lastName,
      dob: data.dob,
      ssnFull: data.ssnFull,
      address: data.address,
      dl: data.dl,
    });
    const ssn_last4 = data.ssnFull.slice(-4);

    const ip = getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const nowIso = new Date().toISOString();

    // Upsert driver_profiles
    const { error: dpErr } = await supabase.from("driver_profiles").upsert({
      user_id: userId,
      vehicle_type: data.vehicle.vehicle_type,
      make: data.vehicle.make,
      model: data.vehicle.model,
      year: data.vehicle.year,
      license_plate: data.vehicle.license_plate.toUpperCase(),
      vin: data.vehicle.vin.toUpperCase(),
      date_of_birth: data.dob,
      address_line1: data.address.line1,
      address_city: data.address.city,
      address_state: data.address.state,
      address_zip: data.address.zip,
      dl_number: data.dl.number,
      dl_state: data.dl.state.toUpperCase(),
      dl_expires_on: data.dl.expiresOn,
      insurance_carrier: data.insurance.carrier,
      insurance_policy_number: data.insurance.policyNumber,
      insurance_expires_on: data.insurance.expiresOn,
      registration_expires_on: data.vehicle.registrationExpiresOn,
      status: "pending",
    }, { onConflict: "user_id" });
    if (dpErr) throw new Error(dpErr.message);

    const { error: kycErr } = await supabase.from("driver_kyc").upsert({
      user_id: userId,
      ssn_last4,
      vendor: vendorResult.vendor,
      vendor_kyc_id: vendorResult.vendorKycId,
      kyc_status: vendorResult.kycStatus,
      bg_status: vendorResult.bgStatus,
      fcra_consent_at: nowIso,
      mvr_consent_at: nowIso,
      sex_offender_attestation_at: nowIso,
      disqualifying_offense_attestation_at: nowIso,
      tos_version: TOS_VERSION,
      tos_accepted_at: nowIso,
      consent_ip: ip,
    }, { onConflict: "user_id" });
    if (kycErr) throw new Error(kycErr.message);

    return { ok: true, kycStatus: vendorResult.kycStatus };
  });

export const getMyDriverKyc = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("driver_kyc")
      .select("ssn_last4, kyc_status, bg_status, vendor, vendor_kyc_id, tos_version, tos_accepted_at, reviewer_notes, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const AdminUpdateSchema = z.object({
  userId: z.string().uuid(),
  kycStatus: z.enum(["pending", "in_review", "verified", "rejected"]),
  bgStatus: z.enum(["pending", "clear", "consider", "rejected"]),
  reviewerNotes: z.string().max(1000).nullable().optional(),
});

export const adminUpdateKycStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AdminUpdateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { error } = await supabase.from("driver_kyc").update({
      kyc_status: data.kycStatus,
      bg_status: data.bgStatus,
      reviewer_notes: data.reviewerNotes ?? null,
    }).eq("user_id", data.userId);
    if (error) throw new Error(error.message);

    // Mirror to driver_profiles.status when verified/rejected.
    if (data.kycStatus === "verified") {
      await supabase.from("driver_profiles").update({
        status: "approved", status_reason: "KYC verified", status_changed_at: new Date().toISOString(),
      }).eq("user_id", data.userId);
    } else if (data.kycStatus === "rejected") {
      await supabase.from("driver_profiles").update({
        status: "rejected", status_reason: data.reviewerNotes ?? "KYC rejected", status_changed_at: new Date().toISOString(),
      }).eq("user_id", data.userId);
    }

    // In-app notification for the driver (service-role bypasses RLS for insert).
    if (data.kycStatus === "verified" || data.kycStatus === "rejected") {
      const approved = data.kycStatus === "verified";
      const notes = data.reviewerNotes?.trim();
      await supabaseAdmin.from("notifications").insert({
        user_id: data.userId,
        type: approved ? "kyc_approved" : "kyc_rejected",
        title: approved ? "You're approved to drive 🎉" : "Your driver application was not approved",
        body: approved
          ? (notes ? `Welcome aboard! Reviewer note: ${notes}` : "Welcome aboard! You can now start accepting trips from the Driver hub.")
          : (notes ? `Reason: ${notes}` : "Please review your information and reapply. Contact support if you have questions."),
        link: "/driver",
      });

      await sendKycEmail({
        userId: data.userId,
        template: approved ? "kyc-approved" : "kyc-rejected",
        reviewerNotes: notes || null,
      });
    }

    return { ok: true };
  });


export const adminListKyc = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await supabase
      .from("driver_kyc")
      .select("user_id, ssn_last4, kyc_status, bg_status, vendor, vendor_kyc_id, reviewer_notes, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
