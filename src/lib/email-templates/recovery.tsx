import * as React from 'react'
import { Body, Button, Head, Html, Preview, Text } from '@react-email/components'
import { Shell, styles, BRAND } from './_brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName = BRAND.name,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your password for {siteName}</Preview>
    <Body style={styles.main}>
      <Shell>
        <h1 style={styles.h1}>Reset your password</h1>
        <Text style={styles.text}>
          We received a request to reset the password for your {siteName}{' '}
          account. Tap the button below to choose a new password.
        </Text>
        <Button style={styles.button} href={confirmationUrl}>Reset Password</Button>
        <Text style={{ ...styles.text, marginTop: '24px', fontSize: '13px', color: BRAND.muted }}>
          Didn't request a reset? You can ignore this email — your password
          won't change.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export default RecoveryEmail
