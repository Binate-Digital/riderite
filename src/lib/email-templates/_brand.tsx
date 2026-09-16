import * as React from 'react'
import { Container, Img, Section, Text } from '@react-email/components'

export const BRAND = {
  name: 'RideRite',
  url: 'https://www.getriderite.com',
  logo: 'https://elncndozprjvojoqgqwi.supabase.co/storage/v1/object/public/email-assets/riderite-logo.jpeg',
  red: '#E11D2E',
  redDark: '#B0121F',
  black: '#0A0A0A',
  ink: '#1F1F23',
  muted: '#6B6B72',
  border: '#ECECEE',
  bgSoft: '#F7F7F8',
}

export const styles = {
  main: {
    backgroundColor: '#ffffff',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Arial, sans-serif',
    margin: 0,
    padding: '24px 12px',
  } as React.CSSProperties,
  shell: {
    maxWidth: '560px',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    border: `1px solid ${BRAND.border}`,
    borderRadius: '14px',
    overflow: 'hidden',
  } as React.CSSProperties,
  headerBar: {
    backgroundColor: BRAND.black,
    padding: '20px 28px',
    borderBottom: `4px solid ${BRAND.red}`,
  } as React.CSSProperties,
  logo: {
    height: '34px',
    width: 'auto',
    display: 'block',
    borderRadius: '6px',
  } as React.CSSProperties,
  body: { padding: '32px 32px 24px' } as React.CSSProperties,
  h1: {
    fontFamily:
      '"Bebas Neue", "Impact", -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: '30px',
    fontWeight: 700 as const,
    color: BRAND.black,
    letterSpacing: '0.5px',
    margin: '0 0 18px',
    lineHeight: 1.1,
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,
  text: {
    fontSize: '15px',
    color: BRAND.ink,
    lineHeight: 1.6,
    margin: '0 0 18px',
  } as React.CSSProperties,
  link: {
    color: BRAND.red,
    textDecoration: 'underline',
    fontWeight: 600 as const,
  } as React.CSSProperties,
  button: {
    backgroundColor: BRAND.red,
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 700 as const,
    letterSpacing: '0.3px',
    borderRadius: '8px',
    padding: '14px 26px',
    textDecoration: 'none',
    textTransform: 'uppercase' as const,
    display: 'inline-block',
    boxShadow: '0 4px 14px rgba(225,29,46,0.25)',
  } as React.CSSProperties,
  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '26px',
    fontWeight: 700 as const,
    letterSpacing: '6px',
    color: BRAND.black,
    backgroundColor: BRAND.bgSoft,
    border: `1px solid ${BRAND.border}`,
    borderRadius: '10px',
    padding: '16px 20px',
    textAlign: 'center' as const,
    margin: '0 0 24px',
  } as React.CSSProperties,
  divider: {
    borderTop: `1px solid ${BRAND.border}`,
    margin: '28px 0 0',
  } as React.CSSProperties,
  footer: {
    fontSize: '12px',
    color: BRAND.muted,
    lineHeight: 1.5,
    padding: '20px 32px 28px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  footerStrong: { color: BRAND.black, fontWeight: 700 as const } as React.CSSProperties,
}

export const Header = () => (
  <Section style={styles.headerBar}>
    <Img
      src={BRAND.logo}
      alt={BRAND.name}
      style={styles.logo}
    />
  </Section>
)

export const Footer = () => (
  <Section>
    <div style={styles.divider} />
    <Text style={styles.footer}>
      <span style={styles.footerStrong}>{BRAND.name}</span>
      {' · '}Premium rides, on your schedule.
      <br />
      © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
    </Text>
  </Section>
)

export const Shell = ({ children }: { children: React.ReactNode }) => (
  <Container style={styles.shell}>
    <Header />
    <Section style={styles.body}>{children}</Section>
    <Footer />
  </Container>
)
