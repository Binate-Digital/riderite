import type { ComponentType } from 'react'
import { template as kycApproved } from './kyc-approved'
import { template as kycRejected } from './kyc-rejected'
import { template as rideReceipt } from './ride-receipt'
import { template as subscriptionSuspended } from './subscription-suspended'
import { template as subscriptionRenewalReminder } from './subscription-renewal-reminder'
import { template as payoutCompleted } from './payout-completed'
import { template as monitoringAlert } from './monitoring-alert'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'kyc-approved': kycApproved,
  'kyc-rejected': kycRejected,
  'ride-receipt': rideReceipt,
  'subscription-suspended': subscriptionSuspended,
  'subscription-renewal-reminder': subscriptionRenewalReminder,
  'payout-completed': payoutCompleted,
  'monitoring-alert': monitoringAlert,
}
