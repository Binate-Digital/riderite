import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { submitDriverKyc, getMyDriverKyc, TOS_VERSION } from "@/lib/driver-kyc.functions";

export const Route = createFileRoute("/_authenticated/become-driver")({
  component: BecomeDriverPage,
});

type VType = "sedan" | "suv" | "truck";

const today = () => new Date().toISOString().slice(0, 10);

function BecomeDriverPage() {
  const { user, roles, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const fetchKyc = useServerFn(getMyDriverKyc);
  const submitKyc = useServerFn(submitDriverKyc);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [dlNumber, setDlNumber] = useState("");
  const [dlState, setDlState] = useState("FL");
  const [dlExp, setDlExp] = useState("");
  const [vehicleType, setVehicleType] = useState<VType>("sedan");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [plate, setPlate] = useState("");
  const [vin, setVin] = useState("");
  const [regExp, setRegExp] = useState("");
  const [carrier, setCarrier] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [insExp, setInsExp] = useState("");
  const [ssn, setSsn] = useState("");
  const [fcra, setFcra] = useState(false);
  const [mvr, setMvr] = useState(false);
  const [sexOff, setSexOff] = useState(false);
  const [disq, setDisq] = useState(false);
  const [tos, setTos] = useState(false);

  const { data: myKyc, isLoading: kycLoading, refetch } = useQuery({
    queryKey: ["my-driver-kyc"],
    queryFn: () => fetchKyc(),
    enabled: !!user,
  });

  // Prefill from existing profile
  useEffect(() => {
    if (!user) return;
    supabase.from("driver_profiles")
      .select("vehicle_type, make, model, year, license_plate, vin, address_line1, address_city, address_zip, dl_number, dl_state, dl_expires_on, date_of_birth, insurance_carrier, insurance_policy_number, insurance_expires_on, registration_expires_on")
      .eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setVehicleType((data.vehicle_type as VType) ?? "sedan");
        setMake(data.make ?? ""); setModel(data.model ?? "");
        setYear(data.year ? String(data.year) : ""); setPlate(data.license_plate ?? "");
        setVin(data.vin ?? ""); setLine1(data.address_line1 ?? "");
        setCity(data.address_city ?? ""); setZip(data.address_zip ?? "");
        setDlNumber(data.dl_number ?? ""); setDlState(data.dl_state ?? "FL");
        setDlExp(data.dl_expires_on ?? ""); setDob(data.date_of_birth ?? "");
        setCarrier(data.insurance_carrier ?? ""); setPolicyNumber(data.insurance_policy_number ?? "");
        setInsExp(data.insurance_expires_on ?? ""); setRegExp(data.registration_expires_on ?? "");
      });
  }, [user]);

  // If KYC already submitted, show status view
  if (kycLoading) {
    return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (myKyc) {
    return <KycStatusView status={myKyc.kyc_status} bg={myKyc.bg_status} notes={myKyc.reviewer_notes} onRefresh={() => refetch()} />;
  }

  const steps = ["Personal", "License & Vehicle", "Insurance", "Background check", "Review"];

  const goNext = () => {
    // per-step validation
    if (step === 0) {
      if (!firstName || !lastName || !dob || !line1 || !city || !/^\d{5}(-\d{4})?$/.test(zip)) {
        return toast.error("Fill in all personal & address fields (FL zip required).");
      }
      const age = ageOn(dob);
      if (age < 19) return toast.error("Florida TNC law requires drivers to be at least 19.");
    }
    if (step === 1) {
      if (!dlNumber || dlState.length !== 2 || !dlExp || dlExp <= today()) return toast.error("Valid, unexpired driver's license required.");
      if (!make || !model || !year || !plate || vin.length !== 17 || !regExp || regExp <= today()) return toast.error("Complete vehicle info; VIN must be 17 chars; registration must be current.");
    }
    if (step === 2) {
      if (!carrier || !policyNumber || !insExp || insExp <= today()) return toast.error("Active auto insurance required (meeting FL TNC minimums).");
    }
    if (step === 3) {
      if (!/^\d{9}$/.test(ssn)) return toast.error("SSN must be 9 digits.");
      if (!fcra || !mvr || !sexOff || !disq) return toast.error("All consents and attestations are required by law.");
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!tos) return toast.error("You must accept the Terms of Service.");
    setSubmitting(true);
    try {
      await submitKyc({
        data: {
          firstName, lastName, dob, ssnFull: ssn,
          address: { line1, city, state: "FL", zip },
          dl: { number: dlNumber, state: dlState, expiresOn: dlExp },
          vehicle: {
            vehicle_type: vehicleType, make, model, year: Number(year),
            license_plate: plate, vin, registrationExpiresOn: regExp,
          },
          insurance: { carrier, policyNumber, expiresOn: insExp },
          consents: { fcra: true, mvr: true, sexOffender: true, disqualifyingOffenses: true, tos: true },
        },
      });
      if (!roles.includes("driver")) {
        await supabase.from("user_roles").insert({ user_id: user.id, role: "driver" }).then(() => {});
        await refreshRoles();
      }
      toast.success("Application submitted! Background check in progress.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <div className="mt-6 rounded-2xl border border-border bg-surface/90 backdrop-blur-xl p-8 shadow-elevated">
          <span className="text-xs font-bold tracking-[0.3em] text-primary">/ DRIVER ONBOARDING (FLORIDA)</span>
          <h1 className="mt-2 text-display text-4xl">{steps[step].toUpperCase()}</h1>
          <Stepper steps={steps} current={step} />

          <div className="mt-6 space-y-4">
            {step === 0 && (
              <>
                <Row>
                  <Field label="Legal first name" value={firstName} onChange={setFirstName} />
                  <Field label="Legal last name" value={lastName} onChange={setLastName} />
                </Row>
                <Field label="Date of birth" type="date" value={dob} onChange={setDob} />
                <Field label="Street address" value={line1} onChange={setLine1} placeholder="123 Main St" />
                <Row>
                  <Field label="City" value={city} onChange={setCity} />
                  <Field label="State" value="FL" onChange={() => {}} disabled />
                  <Field label="ZIP" value={zip} onChange={setZip} placeholder="33101" />
                </Row>
                <Note>Florida law (§ 627.748) requires drivers to be at least 19 years old and reside in Florida.</Note>
              </>
            )}
            {step === 1 && (
              <>
                <Row>
                  <Field label="DL number" value={dlNumber} onChange={setDlNumber} />
                  <Field label="DL state" value={dlState} onChange={(v) => setDlState(v.toUpperCase().slice(0, 2))} />
                  <Field label="DL expires" type="date" value={dlExp} onChange={setDlExp} />
                </Row>
                <div>
                  <span className="text-xs font-bold tracking-widest text-muted-foreground">VEHICLE TYPE</span>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(["sedan", "suv", "truck"] as VType[]).map((t) => (
                      <button key={t} type="button" onClick={() => setVehicleType(t)}
                        className={`rounded-md border px-3 py-3 text-xs font-bold transition ${vehicleType === t ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/60"}`}>
                        {t.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <Row>
                  <Field label="Make" value={make} onChange={setMake} />
                  <Field label="Model" value={model} onChange={setModel} />
                  <Field label="Year" value={year} onChange={(v) => setYear(v.replace(/\D/g, ""))} />
                </Row>
                <Row>
                  <Field label="License plate" value={plate} onChange={(v) => setPlate(v.toUpperCase())} />
                  <Field label="VIN (17 chars)" value={vin} onChange={(v) => setVin(v.toUpperCase().slice(0, 17))} />
                </Row>
                <Field label="Registration expires" type="date" value={regExp} onChange={setRegExp} />
              </>
            )}
            {step === 2 && (
              <>
                <Field label="Insurance carrier" value={carrier} onChange={setCarrier} placeholder="GEICO" />
                <Row>
                  <Field label="Policy number" value={policyNumber} onChange={setPolicyNumber} />
                  <Field label="Policy expires" type="date" value={insExp} onChange={setInsExp} />
                </Row>
                <Note>Florida TNC drivers must carry at least $50k/$100k/$25k while logged into the app and $1M while a rider is in the vehicle.</Note>
              </>
            )}
            {step === 3 && (
              <>
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-xs leading-relaxed text-amber-200">
                  <strong className="block text-sm">FCRA Disclosure & Authorization</strong>
                  You authorize RideRite and its background-check provider to obtain consumer reports and motor vehicle records about you under the Fair Credit Reporting Act. Your SSN is transmitted directly to the vendor and is not stored in our database — only the last 4 digits are retained.
                </div>
                <Field label="SSN (9 digits, no dashes)" value={ssn} onChange={(v) => setSsn(v.replace(/\D/g, "").slice(0, 9))} placeholder="123456789" type="password" />
                <Check checked={fcra} onChange={setFcra} label="I authorize the consumer & background check (FCRA)." />
                <Check checked={mvr} onChange={setMvr} label="I authorize a Motor Vehicle Record (MVR) check." />
                <Check checked={sexOff} onChange={setSexOff} label="I attest I am not on any sex-offender registry." />
                <Check checked={disq} onChange={setDisq} label="I attest I have no disqualifying offenses per FL § 627.748(7) (DUI/violent/sex/fraud felonies in last 5–7 yrs)." />
              </>
            )}
            {step === 4 && (
              <>
                <Summary
                  rows={[
                    ["Name", `${firstName} ${lastName}`],
                    ["DOB", dob],
                    ["Address", `${line1}, ${city}, FL ${zip}`],
                    ["License", `${dlState} ${dlNumber} (exp ${dlExp})`],
                    ["Vehicle", `${year} ${make} ${model} (${vehicleType.toUpperCase()}) · ${plate} · VIN ${vin}`],
                    ["Registration exp", regExp],
                    ["Insurance", `${carrier} #${policyNumber} (exp ${insExp})`],
                    ["SSN", `•••-••-${ssn.slice(-4)}`],
                  ]}
                />
                <Check checked={tos} onChange={setTos} label={`I accept the RideRite Driver Terms of Service (${TOS_VERSION}).`} />
              </>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="rounded-md border border-border px-4 py-2 text-xs font-bold text-muted-foreground disabled:opacity-30 hover:border-primary/50">BACK</button>
            {step < steps.length - 1 ? (
              <button type="button" onClick={goNext} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-red hover:brightness-110">
                CONTINUE <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" disabled={submitting} onClick={handleSubmit}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-red hover:brightness-110 disabled:opacity-50">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} SUBMIT FOR REVIEW
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ageOn(dob: string) {
  const d = new Date(dob), n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
  return a;
}

function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="mt-4 flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= current ? "bg-primary" : "bg-border"}`} />
      ))}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-3 [&>*]:min-w-0">{children}</div>;
}

function Field({ label, value, onChange, placeholder, type = "text", disabled }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-bold tracking-widest text-muted-foreground">{label.toUpperCase()}</span>
      <input type={type} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary disabled:opacity-60" />
    </label>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer rounded-md border border-border bg-background/50 p-3 hover:border-primary/50">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
      <span className="text-xs text-foreground leading-relaxed">{label}</span>
    </label>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">{children}</div>;
}

function Summary({ rows }: { rows: [string, string][] }) {
  return (
    <div className="divide-y divide-border rounded-md border border-border bg-background/40">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-3 gap-3 px-4 py-2.5 text-xs">
          <span className="font-bold tracking-widest text-muted-foreground">{k.toUpperCase()}</span>
          <span className="col-span-2 text-foreground">{v}</span>
        </div>
      ))}
    </div>
  );
}

function KycStatusView({ status, bg, notes, onRefresh }: { status: string; bg: string; notes: string | null; onRefresh: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-hero py-12 px-4">
      <div className="mx-auto max-w-2xl">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <div className="mt-6 rounded-2xl border border-border bg-surface/90 backdrop-blur-xl p-8 shadow-elevated text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-4 text-display text-3xl">APPLICATION RECEIVED</h1>
          <p className="mt-2 text-sm text-muted-foreground">We're running your Florida-mandated background check and verifying your documents.</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-left">
            <StatusBadge label="KYC" value={status} />
            <StatusBadge label="Background" value={bg} />
          </div>
          {notes && <p className="mt-4 text-xs text-amber-300">Reviewer note: {notes}</p>}
          <button onClick={onRefresh} className="mt-6 rounded-md border border-border px-4 py-2 text-xs font-bold hover:border-primary/50">REFRESH STATUS</button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ label, value }: { label: string; value: string }) {
  const tone = value === "verified" || value === "clear" ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
    : value === "rejected" ? "text-red-300 border-red-500/40 bg-red-500/10"
    : "text-amber-300 border-amber-500/40 bg-amber-500/10";
  return (
    <div className={`rounded-md border px-3 py-2 ${tone}`}>
      <div className="text-[10px] font-bold tracking-widest opacity-70">{label}</div>
      <div className="text-sm font-bold uppercase">{value.replace("_", " ")}</div>
    </div>
  );
}
