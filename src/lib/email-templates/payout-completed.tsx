import * as React from 'react'
import { Body, Head, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Shell, styles, BRAND } from './_brand'

interface Props { amountCents?: number; tripId?: string }
const money = (c = 0) => `$${(c / 100).toFixed(2)}`

const Email = ({ amountCents = 0, tripId }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Payout sent to your bank</Preview>
    <Body style={styles.main}>
      <Shell>
        <h1 style={styles.h1}>Payout sent</h1>
        <Text style={styles.text}>
          {BRAND.name} sent {money(amountCents)} to your connected bank account
          {tripId ? ` for trip ${tripId.slice(0, 8)}` : ''}. It should arrive within 1–2 business days.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Your RideRite payout is on its way',
  displayName: 'Payout completed',
  previewData: { amountCents: 1625, tripId: 'a1b2c3d4' },
} satisfies TemplateEntry
