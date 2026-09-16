import * as React from 'react'
import { Body, Button, Head, Html, Link, Preview, Text } from '@react-email/components'
import { Shell, styles, BRAND } from './_brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName = BRAND.name,
  siteUrl = BRAND.url,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join {siteName}</Preview>
    <Body style={styles.main}>
      <Shell>
        <h1 style={styles.h1}>You're invited</h1>
        <Text style={styles.text}>
          You've been invited to join{' '}
          <Link href={siteUrl} style={styles.link}>{siteName}</Link>. Accept
          the invitation below to set up your account and get rolling.
        </Text>
        <Button style={styles.button} href={confirmationUrl}>Accept Invitation</Button>
        <Text style={{ ...styles.text, marginTop: '24px', fontSize: '13px', color: BRAND.muted }}>
          Weren't expecting this invitation? You can safely ignore this email.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export default InviteEmail
