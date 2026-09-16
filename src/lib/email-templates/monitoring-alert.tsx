import * as React from 'react'
import { Body, Head, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Shell, styles } from './_brand'

interface Props { rule: string; severity: string; title: string; message: string }

const Email = ({ rule, severity, title, message }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`[${severity.toUpperCase()}] ${title}`}</Preview>
    <Body style={styles.main}>
      <Shell>
        <h1 style={styles.h1}>System alert</h1>
        <Text style={styles.text}><strong>Rule:</strong> {rule}</Text>
        <Text style={styles.text}><strong>Severity:</strong> {severity}</Text>
        <Text style={styles.text}><strong>{title}</strong></Text>
        <Text style={styles.text}>{message}</Text>
        <Text style={styles.text}>Review and acknowledge in the Admin → Monitoring tab.</Text>
      </Shell>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `[${String(d.severity ?? 'alert').toUpperCase()}] ${d.title ?? 'System alert'}`,
  displayName: 'Monitoring alert',
  previewData: { rule: 'webhook_error_rate', severity: 'critical', title: 'Stripe webhook error rate above 20%', message: '4 failures out of 15 events in the last 15 minutes' },
} satisfies TemplateEntry
