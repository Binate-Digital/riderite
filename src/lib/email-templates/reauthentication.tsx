import * as React from 'react'
import { Body, Head, Html, Preview, Text } from '@react-email/components'
import { Shell, styles, BRAND } from './_brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {BRAND.name} verification code</Preview>
    <Body style={styles.main}>
      <Shell>
        <h1 style={styles.h1}>Confirm it's you</h1>
        <Text style={styles.text}>
          Use the verification code below to confirm your identity on{' '}
          {BRAND.name}.
        </Text>
        <Text style={styles.code}>{token}</Text>
        <Text style={{ ...styles.text, fontSize: '13px', color: BRAND.muted }}>
          This code expires shortly. If you didn't request it, you can safely
          ignore this email.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export default ReauthenticationEmail
