export type VehicleType = "sedan" | "suv" | "truck";

export interface PricingConfig {
  rates: Record<VehicleType, { base: number; perMile: number; perMin: number; label: string }>;
  bookingFeeCents: number;
  minimumFareCents: number;
  serviceFeeRate: number;
  taxRate: number;
}

export const DEFAULT_PRICING: PricingConfig = {
  rates: {
    sedan: { base: 300, perMile: 150, perMin: 30, label: "Sedan" },
    suv: { base: 500, perMile: 225, perMin: 40, label: "SUV" },
    truck: { base: 700, perMile: 300, perMin: 50, label: "Truck" },
  },
  bookingFeeCents: 250,
  minimumFareCents: 700,
  serviceFeeRate: 0.15,
  taxRate: 0.07,
};

export const RATES = DEFAULT_PRICING.rates;
export const BOOKING_FEE_CENTS = DEFAULT_PRICING.bookingFeeCents;
export const MINIMUM_FARE_CENTS = DEFAULT_PRICING.minimumFareCents;
export const SERVICE_FEE_RATE = DEFAULT_PRICING.serviceFeeRate;
export const TAX_RATE = DEFAULT_PRICING.taxRate;

export function pricingFromRow(row: Record<string, number> | null | undefined): PricingConfig {
  if (!row) return DEFAULT_PRICING;
  return {
    rates: {
      sedan: { base: row.sedan_base_cents, perMile: row.sedan_per_mile_cents, perMin: row.sedan_per_min_cents, label: "Sedan" },
      suv: { base: row.suv_base_cents, perMile: row.suv_per_mile_cents, perMin: row.suv_per_min_cents, label: "SUV" },
      truck: { base: row.truck_base_cents, perMile: row.truck_per_mile_cents, perMin: row.truck_per_min_cents, label: "Truck" },
    },
    bookingFeeCents: row.booking_fee_cents,
    minimumFareCents: row.minimum_fare_cents,
    serviceFeeRate: row.service_fee_bps / 10000,
    taxRate: row.tax_bps / 10000,
  };
}

export function estimateTrip(pickup: string, destination: string) {
  const seed = (pickup + "|" + destination).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const distance = 2 + (seed % 180) / 10;
  const duration = Math.max(6, Math.round(distance * 2.6 + (seed % 7)));
  return { distanceMiles: Number(distance.toFixed(1)), durationMinutes: duration };
}

export interface FareBreakdown {
  baseRateCents: number;
  distanceCents: number;
  timeCents: number;
  bookingFeeCents: number;
  baseFareCents: number; // back-compat: meter (floored) + booking fee
  serviceFeeCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
}

export function computeFare(
  vehicle: VehicleType,
  distanceMiles: number,
  durationMinutes: number,
  pricing: PricingConfig = DEFAULT_PRICING,
  discountCents = 0,
): FareBreakdown {
  const r = pricing.rates[vehicle];
  const distanceCents = Math.round(r.perMile * distanceMiles);
  const timeCents = Math.round(r.perMin * durationMinutes);
  const meter = r.base + distanceCents + timeCents;
  const meterFloored = Math.max(meter, pricing.minimumFareCents);
  const baseFareCents = meterFloored + pricing.bookingFeeCents;
  const serviceFeeCents = Math.round(baseFareCents * pricing.serviceFeeRate);
  const taxCents = Math.round((baseFareCents + serviceFeeCents) * pricing.taxRate);
  const subtotal = baseFareCents + serviceFeeCents + taxCents;
  const appliedDiscount = Math.max(0, Math.min(discountCents, subtotal - 100)); // never below $1
  const totalCents = subtotal - appliedDiscount;
  return {
    baseRateCents: r.base,
    distanceCents,
    timeCents,
    bookingFeeCents: pricing.bookingFeeCents,
    baseFareCents,
    serviceFeeCents,
    taxCents,
    discountCents: appliedDiscount,
    totalCents,
  };
}

export function computeDiscountCents(
  subtotalCents: number,
  promo: { percent_off: number | null; amount_off_cents: number | null },
): number {
  if (promo.amount_off_cents && promo.amount_off_cents > 0) return promo.amount_off_cents;
  if (promo.percent_off && promo.percent_off > 0) return Math.round((subtotalCents * promo.percent_off) / 100);
  return 0;
}
