import * as React from 'react'
import { Body, Head, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Shell, styles, BRAND } from './_brand'

interface Props { renewsOn?: string; amountCents?: number }
const money = (c = 0) => `$${(c / 100).toFixed(2)}`

const Email = ({ renewsOn, amountCents = 4999 }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your driver membership renews soon</Preview>
    <Body style={styles.main}>
      <Shell>
        <h1 style={styles.h1}>Membership renewal reminder</h1>
        <Text style={styles.text}>
          Your {BRAND.name} driver membership will renew{renewsOn ? ` on ${renewsOn}` : ' soon'} for {money(amountCents)}.
          Make sure your card on file is up to date to avoid an interruption.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Your RideRite driver membership renews soon',
  displayName: 'Subscription renewal reminder',
  previewData: { renewsOn: 'Jun 15, 2026', amountCents: 4999 },
} satisfies TemplateEntry
