import * as React from 'react'
import { Body, Button, Head, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Shell, styles, BRAND } from './_brand'

interface Props {
  outstandingCents?: number
  lateFeeCents?: number
  totalCents?: number
}

const money = (c = 0) => `$${(c / 100).toFixed(2)}`

const SubscriptionSuspendedEmail = ({ outstandingCents = 0, lateFeeCents = 0, totalCents = 0 }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your RideRite driver account has been suspended</Preview>
    <Body style={styles.main}>
      <Shell>
        <h1 style={styles.h1}>Driver account suspended</h1>
        <Text style={styles.text}>
          Your {BRAND.name} driver membership renewal failed and the 3-day grace period has ended,
          so your account is now suspended and you cannot accept trips.
        </Text>
        <Text style={styles.text}>
          <strong>Outstanding:</strong> {money(outstandingCents)}<br />
          <strong>Late fee:</strong> {money(lateFeeCents)}<br />
          <strong>Total to reactivate:</strong> {money(totalCents)}
        </Text>
        <Button style={styles.button} href={`${BRAND.url}/account/suspended`}>
          Reactivate account
        </Button>
        <Text style={{ ...styles.text, marginTop: '24px', fontSize: '13px', color: BRAND.muted }}>
          Questions? Email Getriderite@gmail.com.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export const template = {
  component: SubscriptionSuspendedEmail,
  subject: 'Your RideRite driver account has been suspended',
  displayName: 'Subscription suspended',
  previewData: { outstandingCents: 4999, lateFeeCents: 999, totalCents: 5998 },
} satisfies TemplateEntry
