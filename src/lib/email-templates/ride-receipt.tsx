import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'RideRite'
const SITE_URL = 'https://www.getriderite.com'

interface Props {
  riderName?: string
  tripId?: string
  pickup?: string
  destination?: string
  vehicleType?: string
  distanceMiles?: number
  durationMinutes?: number
  completedAt?: string
  baseFareCents?: number
  serviceFeeCents?: number
  taxCents?: number
  totalCents?: number
  paymentMethod?: string
  currency?: string
}

const fmtMoney = (cents = 0, currency = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format((cents || 0) / 100)

const fmtDate = (iso?: string) => {
  if (!iso) return ''
  try { return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) } catch { return iso }
}

const RideReceiptEmail = (p: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} receipt — {fmtMoney(p.totalCents, p.currency)}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Thanks for riding with {SITE_NAME}</Heading>
        <Text style={text}>
          {p.riderName ? `Hi ${p.riderName},` : 'Hi,'} here's the receipt for
          your recent trip{p.completedAt ? ` on ${fmtDate(p.completedAt)}` : ''}.
        </Text>

        <Section style={card}>
          {p.pickup ? <Row label="Pickup" value={p.pickup} /> : null}
          {p.destination ? <Row label="Drop-off" value={p.destination} /> : null}
          {p.vehicleType ? <Row label="Vehicle" value={p.vehicleType.toUpperCase()} /> : null}
          {typeof p.distanceMiles === 'number' ? <Row label="Distance" value={`${p.distanceMiles.toFixed(1)} mi`} /> : null}
          {typeof p.durationMinutes === 'number' ? <Row label="Duration" value={`${p.durationMinutes} min`} /> : null}
          {p.paymentMethod ? <Row label="Payment" value={p.paymentMethod.toUpperCase()} /> : null}
        </Section>

        <Section style={card}>
          <Row label="Base fare" value={fmtMoney(p.baseFareCents, p.currency)} />
          <Row label="Service fee" value={fmtMoney(p.serviceFeeCents, p.currency)} />
          <Row label="Tax" value={fmtMoney(p.taxCents, p.currency)} />
          <Hr style={hr} />
          <Row label="Total" value={fmtMoney(p.totalCents, p.currency)} bold />
        </Section>

        <Button style={button} href={`${SITE_URL}/trips`}>View trip history</Button>

        {p.tripId ? <Text style={meta}>Trip ID: {p.tripId}</Text> : null}
        <Text style={footer}>Drive safe, the {SITE_NAME} team</Text>
      </Container>
    </Body>
  </Html>
)

const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
    <tbody>
      <tr>
        <td style={{ ...rowLabel, fontWeight: bold ? 700 : 500 }}>{label}</td>
        <td style={{ ...rowValue, fontWeight: bold ? 700 : 500 }}>{value}</td>
      </tr>
    </tbody>
  </table>
)

export const template = {
  component: RideReceiptEmail,
  subject: (d: Record<string, any>) =>
    `Your RideRite receipt — ${fmtMoney(d?.totalCents ?? 0, d?.currency ?? 'usd')}`,
  displayName: 'Ride receipt',
  previewData: {
    riderName: 'Alex',
    tripId: 'tr_123',
    pickup: '123 Main St, Tampa, FL',
    destination: '999 Bay Ave, St Petersburg, FL',
    vehicleType: 'sedan',
    distanceMiles: 12.4,
    durationMinutes: 22,
    completedAt: new Date().toISOString(),
    baseFareCents: 1800,
    serviceFeeCents: 270,
    taxCents: 145,
    totalCents: 2215,
    paymentMethod: 'card',
    currency: 'usd',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#3f3f46', lineHeight: '1.55', margin: '0 0 18px' }
const card = { padding: '14px 16px', background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '10px', margin: '0 0 16px' }
const rowLabel = { padding: '6px 0', fontSize: '14px', color: '#52525b', textAlign: 'left' as const }
const rowValue = { padding: '6px 0', fontSize: '14px', color: '#0a0a0a', textAlign: 'right' as const }
const hr = { borderColor: '#e5e7eb', margin: '8px 0' }
const button = { backgroundColor: '#0a0a0a', color: '#ffffff', fontSize: '14px', fontWeight: 600, borderRadius: '8px', padding: '12px 22px', textDecoration: 'none' }
const meta = { fontSize: '12px', color: '#a1a1aa', margin: '20px 0 0' }
const footer = { fontSize: '12px', color: '#71717a', margin: '24px 0 0' }
