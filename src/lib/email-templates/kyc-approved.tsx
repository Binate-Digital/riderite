import * as React from 'react'
import { Body, Button, Head, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Shell, styles, BRAND } from './_brand'

interface Props {
  firstName?: string
  reviewerNotes?: string | null
}

const noteBox: React.CSSProperties = {
  fontSize: '14px',
  color: BRAND.ink,
  lineHeight: 1.55,
  margin: '0 0 22px',
  padding: '14px 16px',
  background: BRAND.bgSoft,
  borderLeft: `3px solid ${BRAND.red}`,
  borderRadius: '6px',
}

const KycApprovedEmail = ({ firstName, reviewerNotes }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're approved to drive with {BRAND.name}</Preview>
    <Body style={styles.main}>
      <Shell>
        <h1 style={styles.h1}>You're approved to drive</h1>
        <Text style={styles.text}>
          {firstName ? `Hi ${firstName},` : 'Hi there,'} congratulations — your
          {' '}{BRAND.name} driver application has been approved. You can now
          start accepting trips from the Driver hub.
        </Text>
        {reviewerNotes ? (
          <Text style={noteBox}>
            <strong>Reviewer note:</strong> {reviewerNotes}
          </Text>
        ) : null}
        <Button style={styles.button} href={`${BRAND.url}/driver`}>
          Open Driver Hub
        </Button>
        <Text style={{ ...styles.text, marginTop: '24px', fontSize: '13px', color: BRAND.muted }}>
          Drive safe — the {BRAND.name} team.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export const template = {
  component: KycApprovedEmail,
  subject: "You're approved to drive with RideRite",
  displayName: 'KYC approved',
  previewData: { firstName: 'Alex', reviewerNotes: null },
} satisfies TemplateEntry
