import * as React from 'react'
import { Body, Button, Head, Html, Link, Preview, Text } from '@react-email/components'
import { Shell, styles, BRAND } from './_brand'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName = BRAND.name,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email change for {siteName}</Preview>
    <Body style={styles.main}>
      <Shell>
        <h1 style={styles.h1}>Confirm email change</h1>
        <Text style={styles.text}>
          You requested to change the email on your {siteName} account from{' '}
          <Link href={`mailto:${oldEmail}`} style={styles.link}>{oldEmail}</Link>{' '}
          to{' '}
          <Link href={`mailto:${newEmail}`} style={styles.link}>{newEmail}</Link>.
        </Text>
        <Text style={styles.text}>Tap below to confirm the change.</Text>
        <Button style={styles.button} href={confirmationUrl}>Confirm Email Change</Button>
        <Text style={{ ...styles.text, marginTop: '24px', fontSize: '13px', color: BRAND.muted }}>
          Didn't request this? Please secure your account immediately.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export default EmailChangeEmail
