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
  background: '#FEF2F2',
  borderLeft: `3px solid ${BRAND.red}`,
  borderRadius: '6px',
}

const KycRejectedEmail = ({ firstName, reviewerNotes }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Update on your {BRAND.name} driver application</Preview>
    <Body style={styles.main}>
      <Shell>
        <h1 style={styles.h1}>Application not approved</h1>
        <Text style={styles.text}>
          {firstName ? `Hi ${firstName},` : 'Hi there,'} thanks for applying to
          drive with {BRAND.name}. After reviewing your submission, we're unable
          to approve your application at this time.
        </Text>
        {reviewerNotes ? (
          <Text style={noteBox}>
            <strong>Reason:</strong> {reviewerNotes}
          </Text>
        ) : (
          <Text style={styles.text}>
            Please double-check your information and consider reapplying. If
            you believe this was a mistake, reach out to our support team.
          </Text>
        )}
        <Button style={styles.button} href={`${BRAND.url}/become-driver`}>
          Review Application
        </Button>
        <Text style={{ ...styles.text, marginTop: '24px', fontSize: '13px', color: BRAND.muted }}>
          — the {BRAND.name} team.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export const template = {
  component: KycRejectedEmail,
  subject: 'Update on your RideRite driver application',
  displayName: 'KYC rejected',
  previewData: { firstName: 'Alex', reviewerNotes: 'Driver license expired.' },
} satisfies TemplateEntry
