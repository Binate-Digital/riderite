import * as React from 'react'
import { Body, Button, Head, Html, Link, Preview, Text } from '@react-email/components'
import { Shell, styles, BRAND } from './_brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName = BRAND.name,
  siteUrl = BRAND.url,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email for {siteName}</Preview>
    <Body style={styles.main}>
      <Shell>
        <Text style={styles.text}>Welcome aboard,</Text>
        <h1 style={styles.h1}>Confirm your email</h1>
        <Text style={styles.text}>
          Thanks for signing up for{' '}
          <Link href={siteUrl} style={styles.link}>{siteName}</Link>. Confirm
          the address <Link href={`mailto:${recipient}`} style={styles.link}>{recipient}</Link>{' '}
          to activate your account and start booking rides.
        </Text>
        <Button style={styles.button} href={confirmationUrl}>Verify Email</Button>
        <Text style={{ ...styles.text, marginTop: '24px', fontSize: '13px', color: BRAND.muted }}>
          Didn't create an account? You can safely ignore this email.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export default SignupEmail
