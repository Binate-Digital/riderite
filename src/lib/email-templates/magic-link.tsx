import * as React from 'react'
import { Body, Button, Head, Html, Preview, Text } from '@react-email/components'
import { Shell, styles, BRAND } from './_brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName = BRAND.name,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your login link for {siteName}</Preview>
    <Body style={styles.main}>
      <Shell>
        <h1 style={styles.h1}>Your login link</h1>
        <Text style={styles.text}>
          Tap the button below to sign in to {siteName}. For your security, this
          link expires shortly and can only be used once.
        </Text>
        <Button style={styles.button} href={confirmationUrl}>Log In</Button>
        <Text style={{ ...styles.text, marginTop: '24px', fontSize: '13px', color: BRAND.muted }}>
          Didn't request this link? You can safely ignore this email.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export default MagicLinkEmail
