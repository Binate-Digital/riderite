export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      complaints: {
        Row: {
          category: Database["public"]["Enums"]["complaint_category"]
          created_at: string
          description: string
          id: string
          incident_at: string | null
          reporter_email: string
          reporter_name: string
          reporter_phone: string | null
          reporter_user_id: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["complaint_category"]
          created_at?: string
          description: string
          id?: string
          incident_at?: string | null
          reporter_email: string
          reporter_name: string
          reporter_phone?: string | null
          reporter_user_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["complaint_category"]
          created_at?: string
          description?: string
          id?: string
          incident_at?: string | null
          reporter_email?: string
          reporter_name?: string
          reporter_phone?: string | null
          reporter_user_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      connect_accounts: {
        Row: {
          charges_enabled: boolean
          country: string
          created_at: string
          details_submitted: boolean
          disabled_reason: string | null
          environment: string
          payouts_enabled: boolean
          requirements_due: Json
          stripe_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          charges_enabled?: boolean
          country?: string
          created_at?: string
          details_submitted?: boolean
          disabled_reason?: string | null
          environment?: string
          payouts_enabled?: boolean
          requirements_due?: Json
          stripe_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          charges_enabled?: boolean
          country?: string
          created_at?: string
          details_submitted?: boolean
          disabled_reason?: string | null
          environment?: string
          payouts_enabled?: boolean
          requirements_due?: Json
          stripe_account_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      driver_kyc: {
        Row: {
          bg_status: Database["public"]["Enums"]["bg_check_status"]
          consent_ip: string | null
          created_at: string
          disqualifying_offense_attestation_at: string
          fcra_consent_at: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          mvr_consent_at: string
          reviewer_notes: string | null
          sex_offender_attestation_at: string
          ssn_last4: string
          tos_accepted_at: string
          tos_version: string
          updated_at: string
          user_id: string
          vendor: string
          vendor_kyc_id: string | null
        }
        Insert: {
          bg_status?: Database["public"]["Enums"]["bg_check_status"]
          consent_ip?: string | null
          created_at?: string
          disqualifying_offense_attestation_at: string
          fcra_consent_at: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          mvr_consent_at: string
          reviewer_notes?: string | null
          sex_offender_attestation_at: string
          ssn_last4: string
          tos_accepted_at: string
          tos_version: string
          updated_at?: string
          user_id: string
          vendor?: string
          vendor_kyc_id?: string | null
        }
        Update: {
          bg_status?: Database["public"]["Enums"]["bg_check_status"]
          consent_ip?: string | null
          created_at?: string
          disqualifying_offense_attestation_at?: string
          fcra_consent_at?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          mvr_consent_at?: string
          reviewer_notes?: string | null
          sex_offender_attestation_at?: string
          ssn_last4?: string
          tos_accepted_at?: string
          tos_version?: string
          updated_at?: string
          user_id?: string
          vendor?: string
          vendor_kyc_id?: string | null
        }
        Relationships: []
      }
      driver_profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["driver_account_status"]
          address_city: string | null
          address_line1: string | null
          address_state: string | null
          address_zip: string | null
          created_at: string
          date_of_birth: string | null
          dl_expires_on: string | null
          dl_number: string | null
          dl_state: string | null
          insurance_carrier: string | null
          insurance_expires_on: string | null
          insurance_policy_number: string | null
          license_plate: string
          make: string
          model: string
          registration_expires_on: string | null
          status: Database["public"]["Enums"]["driver_status"]
          status_changed_at: string | null
          status_reason: string | null
          suspended_at: string | null
          suspension_reason: string | null
          updated_at: string
          user_id: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          vin: string | null
          year: number
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["driver_account_status"]
          address_city?: string | null
          address_line1?: string | null
          address_state?: string | null
          address_zip?: string | null
          created_at?: string
          date_of_birth?: string | null
          dl_expires_on?: string | null
          dl_number?: string | null
          dl_state?: string | null
          insurance_carrier?: string | null
          insurance_expires_on?: string | null
          insurance_policy_number?: string | null
          license_plate: string
          make: string
          model: string
          registration_expires_on?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          status_changed_at?: string | null
          status_reason?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
          user_id: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          vin?: string | null
          year: number
        }
        Update: {
          account_status?: Database["public"]["Enums"]["driver_account_status"]
          address_city?: string | null
          address_line1?: string | null
          address_state?: string | null
          address_zip?: string | null
          created_at?: string
          date_of_birth?: string | null
          dl_expires_on?: string | null
          dl_number?: string | null
          dl_state?: string | null
          insurance_carrier?: string | null
          insurance_expires_on?: string | null
          insurance_policy_number?: string | null
          license_plate?: string
          make?: string
          model?: string
          registration_expires_on?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          status_changed_at?: string | null
          status_reason?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
          user_id?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
          vin?: string | null
          year?: number
        }
        Relationships: []
      }
      driver_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          grace_period_ends_at: string | null
          late_fee_cents: number
          outstanding_cents: number
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          grace_period_ends_at?: string | null
          late_fee_cents?: number
          outstanding_cents?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          grace_period_ends_at?: string | null
          late_fee_cents?: number
          outstanding_cents?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      monitoring_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          bucket_key: string
          context: Json | null
          created_at: string
          id: string
          message: string | null
          resolved_at: string | null
          rule: string
          severity: string
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          bucket_key: string
          context?: Json | null
          created_at?: string
          id?: string
          message?: string | null
          resolved_at?: string | null
          rule: string
          severity?: string
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          bucket_key?: string
          context?: Json | null
          created_at?: string
          id?: string
          message?: string | null
          resolved_at?: string | null
          rule?: string
          severity?: string
          title?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          environment: string
          id: string
          payment_method: string
          refund_cents: number
          refunded_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          payment_method?: string
          refund_cents?: number
          refunded_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          payment_method?: string
          refund_cents?: number
          refunded_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          company_cut_cents: number
          created_at: string
          driver_cut_cents: number
          driver_id: string
          failure_reason: string | null
          id: string
          status: string
          stripe_destination_account: string | null
          stripe_transfer_id: string | null
          total_fare_cents: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          company_cut_cents: number
          created_at?: string
          driver_cut_cents: number
          driver_id: string
          failure_reason?: string | null
          id?: string
          status?: string
          stripe_destination_account?: string | null
          stripe_transfer_id?: string | null
          total_fare_cents: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          company_cut_cents?: number
          created_at?: string
          driver_cut_cents?: number
          driver_id?: string
          failure_reason?: string | null
          id?: string
          status?: string
          stripe_destination_account?: string | null
          stripe_transfer_id?: string | null
          total_fare_cents?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_config: {
        Row: {
          booking_fee_cents: number
          id: number
          minimum_fare_cents: number
          sedan_base_cents: number
          sedan_per_mile_cents: number
          sedan_per_min_cents: number
          service_fee_bps: number
          suv_base_cents: number
          suv_per_mile_cents: number
          suv_per_min_cents: number
          tax_bps: number
          truck_base_cents: number
          truck_per_mile_cents: number
          truck_per_min_cents: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          booking_fee_cents?: number
          id?: number
          minimum_fare_cents?: number
          sedan_base_cents?: number
          sedan_per_mile_cents?: number
          sedan_per_min_cents?: number
          service_fee_bps?: number
          suv_base_cents?: number
          suv_per_mile_cents?: number
          suv_per_min_cents?: number
          tax_bps?: number
          truck_base_cents?: number
          truck_per_mile_cents?: number
          truck_per_min_cents?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          booking_fee_cents?: number
          id?: number
          minimum_fare_cents?: number
          sedan_base_cents?: number
          sedan_per_mile_cents?: number
          sedan_per_min_cents?: number
          service_fee_bps?: number
          suv_base_cents?: number
          suv_per_mile_cents?: number
          suv_per_min_cents?: number
          tax_bps?: number
          truck_base_cents?: number
          truck_per_mile_cents?: number
          truck_per_min_cents?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          amount_off_cents: number | null
          code: string
          created_at: string
          expires_at: string | null
          id: string
          max_uses: number | null
          percent_off: number | null
          uses: number
        }
        Insert: {
          active?: boolean
          amount_off_cents?: number | null
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          percent_off?: number | null
          uses?: number
        }
        Update: {
          active?: boolean
          amount_off_cents?: number | null
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          percent_off?: number | null
          uses?: number
        }
        Relationships: []
      }
      subscription_invoices: {
        Row: {
          amount_due_cents: number
          amount_paid_cents: number
          created_at: string
          hosted_invoice_url: string | null
          id: string
          invoice_pdf: string | null
          period_end: string | null
          period_start: string | null
          status: string
          stripe_invoice_id: string
          user_id: string
        }
        Insert: {
          amount_due_cents?: number
          amount_paid_cents?: number
          created_at?: string
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf?: string | null
          period_end?: string | null
          period_start?: string | null
          status: string
          stripe_invoice_id: string
          user_id: string
        }
        Update: {
          amount_due_cents?: number
          amount_paid_cents?: number
          created_at?: string
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          stripe_invoice_id?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_events: {
        Row: {
          category: string
          created_at: string
          environment: string | null
          error_message: string | null
          event_type: string
          id: string
          latency_ms: number | null
          payload: Json | null
          reference_id: string | null
          severity: string
          status: string
          stripe_event_id: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          environment?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          latency_ms?: number | null
          payload?: Json | null
          reference_id?: string | null
          severity?: string
          status?: string
          stripe_event_id?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          environment?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          latency_ms?: number | null
          payload?: Json | null
          reference_id?: string | null
          severity?: string
          status?: string
          stripe_event_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      trips: {
        Row: {
          base_fare_cents: number
          canceled_at: string | null
          cancellation_fee_cents: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          destination_address: string
          destination_lat: number | null
          destination_lng: number | null
          discount_cents: number
          distance_miles: number
          driver_id: string | null
          duration_minutes: number
          fare_cents: number
          id: string
          paid: boolean
          payment_method: string
          pickup_address: string
          pickup_lat: number | null
          pickup_lng: number | null
          promo_code: string | null
          rating: number | null
          requested_at: string
          rider_id: string
          scheduled_for: string | null
          service_fee_cents: number
          status: Database["public"]["Enums"]["trip_status"]
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          tax_cents: number
          updated_at: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          base_fare_cents?: number
          canceled_at?: string | null
          cancellation_fee_cents?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          destination_address: string
          destination_lat?: number | null
          destination_lng?: number | null
          discount_cents?: number
          distance_miles?: number
          driver_id?: string | null
          duration_minutes?: number
          fare_cents?: number
          id?: string
          paid?: boolean
          payment_method?: string
          pickup_address: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          promo_code?: string | null
          rating?: number | null
          requested_at?: string
          rider_id: string
          scheduled_for?: string | null
          service_fee_cents?: number
          status?: Database["public"]["Enums"]["trip_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tax_cents?: number
          updated_at?: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          base_fare_cents?: number
          canceled_at?: string | null
          cancellation_fee_cents?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          destination_address?: string
          destination_lat?: number | null
          destination_lng?: number | null
          discount_cents?: number
          distance_miles?: number
          driver_id?: string | null
          duration_minutes?: number
          fare_cents?: number
          id?: string
          paid?: boolean
          payment_method?: string
          pickup_address?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          promo_code?: string | null
          rating?: number | null
          requested_at?: string
          rider_id?: string
          scheduled_for?: string | null
          service_fee_cents?: number
          status?: Database["public"]["Enums"]["trip_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tax_cents?: number
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_listings: {
        Row: {
          city: string
          created_at: string
          daily_rate_cents: number
          description: string | null
          features: string[]
          id: string
          make: string
          model: string
          owner_id: string
          photos: string[]
          seats: number
          state: string
          status: Database["public"]["Enums"]["vehicle_listing_status"]
          title: string
          transmission: string
          updated_at: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          year: number
        }
        Insert: {
          city: string
          created_at?: string
          daily_rate_cents: number
          description?: string | null
          features?: string[]
          id?: string
          make: string
          model: string
          owner_id: string
          photos?: string[]
          seats?: number
          state: string
          status?: Database["public"]["Enums"]["vehicle_listing_status"]
          title: string
          transmission?: string
          updated_at?: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          year: number
        }
        Update: {
          city?: string
          created_at?: string
          daily_rate_cents?: number
          description?: string | null
          features?: string[]
          id?: string
          make?: string
          model?: string
          owner_id?: string
          photos?: string[]
          seats?: number
          state?: string
          status?: Database["public"]["Enums"]["vehicle_listing_status"]
          title?: string
          transmission?: string
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
          year?: number
        }
        Relationships: []
      }
      vehicle_rentals: {
        Row: {
          created_at: string
          end_date: string
          id: string
          listing_id: string
          owner_id: string
          owner_payout_cents: number
          platform_fee_cents: number
          renter_id: string
          start_date: string
          status: Database["public"]["Enums"]["vehicle_rental_status"]
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          stripe_transfer_id: string | null
          total_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          listing_id: string
          owner_id: string
          owner_payout_cents: number
          platform_fee_cents: number
          renter_id: string
          start_date: string
          status?: Database["public"]["Enums"]["vehicle_rental_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          stripe_transfer_id?: string | null
          total_cents: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          listing_id?: string
          owner_id?: string
          owner_payout_cents?: number
          platform_fee_cents?: number
          renter_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["vehicle_rental_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          stripe_transfer_id?: string | null
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_rentals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "vehicle_listings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_trip_request: { Args: { _trip_id: string }; Returns: string }
      can_driver_accept_trips: { Args: { _user_id: string }; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_open_trip_requests: {
        Args: never
        Returns: {
          distance_miles: number
          duration_minutes: number
          fare_cents: number
          id: string
          paid: boolean
          payment_method: string
          requested_at: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }[]
      }
      mark_notifications_read: { Args: { _ids: string[] }; Returns: number }
      monitoring_evaluate_alerts: { Args: never; Returns: Json }
      monitoring_overview: { Args: never; Returns: Json }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "rider" | "driver" | "admin"
      bg_check_status: "pending" | "clear" | "consider" | "rejected"
      complaint_category:
        | "zero_tolerance_drugs_alcohol"
        | "driver_conduct"
        | "vehicle_safety"
        | "discrimination"
        | "accessibility"
        | "billing"
        | "other"
      complaint_status: "open" | "investigating" | "resolved" | "dismissed"
      driver_account_status:
        | "active"
        | "grace_period"
        | "suspended"
        | "under_review"
      driver_status: "pending" | "approved" | "rejected" | "suspended"
      kyc_status: "pending" | "in_review" | "verified" | "rejected"
      trip_status:
        | "requested"
        | "accepted"
        | "arriving"
        | "in_progress"
        | "completed"
        | "cancelled"
      vehicle_listing_status: "draft" | "active" | "paused" | "removed"
      vehicle_rental_status:
        | "pending"
        | "confirmed"
        | "active"
        | "completed"
        | "cancelled"
      vehicle_type: "sedan" | "suv" | "truck"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["rider", "driver", "admin"],
      bg_check_status: ["pending", "clear", "consider", "rejected"],
      complaint_category: [
        "zero_tolerance_drugs_alcohol",
        "driver_conduct",
        "vehicle_safety",
        "discrimination",
        "accessibility",
        "billing",
        "other",
      ],
      complaint_status: ["open", "investigating", "resolved", "dismissed"],
      driver_account_status: [
        "active",
        "grace_period",
        "suspended",
        "under_review",
      ],
      driver_status: ["pending", "approved", "rejected", "suspended"],
      kyc_status: ["pending", "in_review", "verified", "rejected"],
      trip_status: [
        "requested",
        "accepted",
        "arriving",
        "in_progress",
        "completed",
        "cancelled",
      ],
      vehicle_listing_status: ["draft", "active", "paused", "removed"],
      vehicle_rental_status: [
        "pending",
        "confirmed",
        "active",
        "completed",
        "cancelled",
      ],
      vehicle_type: ["sedan", "suv", "truck"],
    },
  },
} as const
