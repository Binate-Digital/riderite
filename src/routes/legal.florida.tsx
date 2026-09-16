import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, ShieldCheck, FileText, Phone, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/legal/florida")({
  component: FloridaCompliancePage,
  head: () => ({
    meta: [
      { title: "Florida Compliance & Safety — RideRite" },
      {
        name: "description",
        content:
          "RideRite's Florida TNC disclosures: zero-tolerance drug & alcohol policy, insurance coverage, driver requirements, trade dress, and rider complaint mechanism per Florida Statutes § 627.748.",
      },
      { property: "og:title", content: "Florida Compliance & Safety — RideRite" },
      { property: "og:description", content: "RideRite's Florida TNC disclosures: insurance, driver requirements, zero-tolerance policy, and the rider complaint mechanism." },
      { property: "og:url", content: "https://getriderite.com/legal/florida" },
    ],
    links: [{ rel: "canonical", href: "https://getriderite.com/legal/florida" }],
  }),
});

const CATEGORIES = [
  { v: "zero_tolerance_drugs_alcohol", l: "Driver under influence (zero tolerance)" },
  { v: "driver_conduct", l: "Driver conduct" },
  { v: "vehicle_safety", l: "Vehicle safety / condition" },
  { v: "discrimination", l: "Discrimination or accessibility refusal" },
  { v: "accessibility", l: "Accessibility (service animal, wheelchair, etc.)" },
  { v: "billing", l: "Billing / fare dispute" },
  { v: "other", l: "Other" },
] as const;

function FloridaCompliancePage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    reporter_name: "",
    reporter_email: "",
    reporter_phone: "",
    category: "" as (typeof CATEGORIES)[number]["v"] | "",
    trip_id: "",
    incident_at: "",
    description: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category) {
      toast.error("Please select a category.");
      return;
    }
    if (form.description.trim().length < 10) {
      toast.error("Please describe the incident (at least 10 characters).");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        reporter_name: form.reporter_name.trim(),
        reporter_email: form.reporter_email.trim(),
        reporter_phone: form.reporter_phone.trim() || null,
        category: form.category,
        description: form.description.trim(),
        trip_id: form.trip_id.trim() || null,
        incident_at: form.incident_at ? new Date(form.incident_at).toISOString() : null,
      };
      const res = await fetch("/api/public/complaints", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Submission failed");
      }
      setSubmitted(true);
      toast.success("Complaint received. Our safety team will follow up by email.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <header className="mb-12">
          <p className="text-xs font-bold tracking-[0.3em] text-primary">FLORIDA · TRANSPORTATION NETWORK COMPANY</p>
          <h1 className="mt-3 text-4xl md:text-5xl text-display tracking-tight">
            Florida Compliance &amp; Safety
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl">
            RideRite Mobility, Inc. operates as a Transportation Network Company (TNC) under{" "}
            <a className="underline" href="https://www.flsenate.gov/Laws/Statutes/2023/627.748" target="_blank" rel="noreferrer">
              Florida Statutes § 627.748
            </a>
            . The disclosures below summarize how we comply with Florida law and how riders can report concerns.
          </p>
        </header>

        <Section icon={<AlertCircle className="h-5 w-5 text-primary" />} title="Zero-Tolerance Drug &amp; Alcohol Policy">
          <p>
            RideRite enforces a <strong>zero-tolerance</strong> policy on the use of drugs or alcohol by any driver while
            providing prearranged rides or while logged into the RideRite driver app. Any rider who reasonably suspects a
            driver is impaired must report it immediately using the form below or by calling{" "}
            <a className="underline" href="tel:+18335553737">(833) 555-3737</a>.
          </p>
          <p className="mt-3">
            On receipt of a credible complaint, RideRite will <strong>immediately suspend the driver's access</strong> to
            the app and conduct an investigation. Drivers found in violation are permanently deactivated. Investigation
            records are retained for at least <strong>two (2) years</strong>.
          </p>
        </Section>

        <Section icon={<ShieldCheck className="h-5 w-5 text-primary" />} title="Insurance Coverage">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Driver logged in, no ride accepted (Period 1):</strong> primary liability of at least{" "}
              <strong>$50,000</strong> per person / <strong>$100,000</strong> per incident for bodily injury and{" "}
              <strong>$25,000</strong> for property damage, plus PIP and uninsured-motorist coverage as required by
              Florida law.
            </li>
            <li>
              <strong>Ride accepted through trip completion (Periods 2 &amp; 3):</strong> primary liability of at least{" "}
              <strong>$1,000,000</strong> for death, bodily injury, and property damage.
            </li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            Coverage is provided by a Florida-authorized insurer. Riders involved in an incident may request the
            applicable policy details via the complaint form below.
          </p>
        </Section>

        <Section icon={<FileText className="h-5 w-5 text-primary" />} title="Driver Requirements">
          <ul className="list-disc pl-5 space-y-2">
            <li>Minimum age <strong>19</strong>; valid U.S. driver's license.</li>
            <li>Current vehicle registration and Florida-compliant motor vehicle insurance.</li>
            <li>
              Local and national criminal background check, including the U.S. Department of Justice National Sex
              Offender Public Website. Drivers are disqualified for any of the offenses listed in § 627.748(8)(b), F.S.
            </li>
            <li>Driving history (MVR) review; recurring re-screening at least annually.</li>
            <li>Vehicle 20 model years old or newer, 4-door, with valid registration and inspection.</li>
          </ul>
        </Section>

        <Section icon={<FileText className="h-5 w-5 text-primary" />} title="Prearranged Rides Only · No Street Hails">
          <p>
            RideRite trips are <strong>prearranged through the app only</strong>. Drivers do not accept street hails,
            cash on demand, or stand for hire at airports, taxi stands, or other public places. Florida law prohibits
            TNC drivers from soliciting or accepting non-prearranged rides.
          </p>
        </Section>

        <Section icon={<FileText className="h-5 w-5 text-primary" />} title="Trade Dress &amp; Rider Identification">
          <p>
            Every active RideRite vehicle displays the RideRite trade-dress decal — visible from a distance of at least
            <strong> 50 feet</strong> in daylight — while the driver is logged in. Before entering the vehicle, riders
            see the driver's first name, photo, vehicle make, model, color, and license plate inside the app. If any
            detail does not match, do not enter the vehicle and report it below.
          </p>
        </Section>

        <Section icon={<FileText className="h-5 w-5 text-primary" />} title="Digital Receipts &amp; Records">
          <p>
            Within a reasonable time of each completed trip, riders receive an electronic receipt containing the pickup
            and drop-off points and times, total distance and time, the itemized fare, and the driver's first name.
            Receipts are visible in the <Link className="underline" to="/trips">Trips</Link> tab. RideRite retains trip
            records for at least <strong>one (1) year</strong> and driver records for at least{" "}
            <strong>five (5) years</strong> after termination, in accordance with § 627.748(11), F.S.
          </p>
        </Section>

        <Section icon={<Phone className="h-5 w-5 text-primary" />} title="Accessibility &amp; Non-Discrimination">
          <p>
            RideRite drivers do not discriminate on the basis of destination, race, color, national origin, religious
            belief, sex, disability, age, sexual orientation, or gender identity. Service animals are accommodated at no
            additional charge. Refusal to transport for a discriminatory reason is grounds for permanent deactivation.
          </p>
        </Section>

        <section id="report" className="mt-16 rounded-2xl border border-border bg-card p-6 md:p-10">
          <h2 className="text-2xl text-display tracking-tight">Report a Safety Concern or Complaint</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Required by Florida law. For an emergency in progress, call <strong>911</strong>.
          </p>

          {submitted ? (
            <div className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-background p-4">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Report received.</p>
                <p className="text-sm text-muted-foreground">
                  RideRite's safety team will review within 24 hours and follow up by email.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Your name" required>
                <Input
                  required maxLength={120} value={form.reporter_name}
                  onChange={(e) => setForm({ ...form, reporter_name: e.target.value })}
                />
              </Field>
              <Field label="Email" required>
                <Input
                  type="email" required maxLength={254} value={form.reporter_email}
                  onChange={(e) => setForm({ ...form, reporter_email: e.target.value })}
                />
              </Field>
              <Field label="Phone (optional)">
                <Input
                  type="tel" maxLength={40} value={form.reporter_phone}
                  onChange={(e) => setForm({ ...form, reporter_phone: e.target.value })}
                />
              </Field>
              <Field label="Category" required>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as typeof form.category })}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Trip ID (optional)">
                <Input
                  placeholder="From your Trips tab"
                  value={form.trip_id}
                  onChange={(e) => setForm({ ...form, trip_id: e.target.value })}
                />
              </Field>
              <Field label="Date / time of incident (optional)">
                <Input
                  type="datetime-local" value={form.incident_at}
                  onChange={(e) => setForm({ ...form, incident_at: e.target.value })}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="What happened?" required>
                  <Textarea
                    required minLength={10} maxLength={4000} rows={6} value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Please include as much detail as you can — date, location, vehicle, driver, and what occurred."
                  />
                </Field>
              </div>
              <div className="md:col-span-2 flex items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground">
                  Submitting this form does not constitute a 911 call. False reports may result in account action.
                </p>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit report"}
                </Button>
              </div>
            </form>
          )}
        </section>

        <p className="mt-10 text-xs text-muted-foreground">
          This page is provided for informational purposes and does not constitute legal advice. The controlling source
          is Florida Statutes § 627.748 and RideRite's Terms of Service.
        </p>
      </main>
      <Footer />
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-3">
        {icon}
        <h2 className="text-xl md:text-2xl text-display tracking-tight">{title}</h2>
      </div>
      <div className="mt-3 text-sm md:text-base text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-primary">*</span>}
      </Label>
      {children}
    </div>
  );
}
