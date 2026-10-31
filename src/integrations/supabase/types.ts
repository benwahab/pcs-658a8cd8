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
      agent_login_challenges: {
        Row: {
          agent_user_id: string
          challenge_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
        }
        Insert: {
          agent_user_id: string
          challenge_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
        }
        Update: {
          agent_user_id?: string
          challenge_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
        }
        Relationships: []
      }
      agent_login_rate_limits: {
        Row: {
          attempts: number
          blocked_until: string | null
          key_hash: string
          updated_at: string
          window_started_at: string
        }
        Insert: {
          attempts?: number
          blocked_until?: string | null
          key_hash: string
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          attempts?: number
          blocked_until?: string | null
          key_hash?: string
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      communes: {
        Row: {
          boundary: unknown
          created_at: string
          id: string
          is_active: boolean
          name: string
          region_id: string
          updated_at: string
        }
        Insert: {
          boundary?: unknown
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          region_id: string
          updated_at?: string
        }
        Update: {
          boundary?: unknown
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          region_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communes_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      cst_accounts: {
        Row: {
          created_at: string
          email: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: number
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: number
          user_id?: string
        }
        Relationships: []
      }
      cst_alerts: {
        Row: {
          acknowledged_at: string | null
          code: string
          created_at: string
          id: string
          message: string
          observed_at: string
          resolved_at: string | null
          service: string
          severity: string
        }
        Insert: {
          acknowledged_at?: string | null
          code: string
          created_at?: string
          id?: string
          message: string
          observed_at?: string
          resolved_at?: string | null
          service: string
          severity: string
        }
        Update: {
          acknowledged_at?: string | null
          code?: string
          created_at?: string
          id?: string
          message?: string
          observed_at?: string
          resolved_at?: string | null
          service?: string
          severity?: string
        }
        Relationships: []
      }
      cst_archive_cleanup_log: {
        Row: {
          archive_id: string
          details: string | null
          id: string
          media_id: string | null
          outcome: string
          processed_at: string
          report_id: string | null
          storage_path: string | null
        }
        Insert: {
          archive_id: string
          details?: string | null
          id?: string
          media_id?: string | null
          outcome: string
          processed_at?: string
          report_id?: string | null
          storage_path?: string | null
        }
        Update: {
          archive_id?: string
          details?: string | null
          id?: string
          media_id?: string | null
          outcome?: string
          processed_at?: string
          report_id?: string | null
          storage_path?: string | null
        }
        Relationships: []
      }
      cst_auth_rate_limits: {
        Row: {
          attempts: number
          blocked_until: string | null
          key_hash: string
          window_started_at: string
        }
        Insert: {
          attempts?: number
          blocked_until?: string | null
          key_hash: string
          window_started_at?: string
        }
        Update: {
          attempts?: number
          blocked_until?: string | null
          key_hash?: string
          window_started_at?: string
        }
        Relationships: []
      }
      cst_frontend_events: {
        Row: {
          browser: string | null
          device: string | null
          event_type: string
          id: number
          message: string | null
          metadata: Json
          occurred_at: string
          page: string | null
          trace_id: string | null
        }
        Insert: {
          browser?: string | null
          device?: string | null
          event_type: string
          id?: never
          message?: string | null
          metadata?: Json
          occurred_at?: string
          page?: string | null
          trace_id?: string | null
        }
        Update: {
          browser?: string | null
          device?: string | null
          event_type?: string
          id?: never
          message?: string | null
          metadata?: Json
          occurred_at?: string
          page?: string | null
          trace_id?: string | null
        }
        Relationships: []
      }
      cst_incidents: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          impact: string | null
          incident_code: string
          resolution: string | null
          service: string
          severity: string
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          impact?: string | null
          incident_code: string
          resolution?: string | null
          service: string
          severity: string
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          impact?: string | null
          incident_code?: string
          resolution?: string | null
          service?: string
          severity?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      cst_media_moderation_history: {
        Row: {
          action: string
          created_at: string
          id: string
          media_id: string
          moderator_id: string
          reason: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          media_id: string
          moderator_id: string
          reason?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          media_id?: string
          moderator_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cst_media_moderation_history_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "public_report_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cst_media_moderation_history_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "report_media"
            referencedColumns: ["id"]
          },
        ]
      }
      cst_registration_lock: {
        Row: {
          id: number
          registered_at: string
        }
        Insert: {
          id?: number
          registered_at?: string
        }
        Update: {
          id?: number
          registered_at?: string
        }
        Relationships: []
      }
      cst_request_events: {
        Row: {
          endpoint: string
          error_class: string | null
          id: number
          latency_ms: number | null
          metadata: Json
          method: string
          occurred_at: string
          source: string
          status_code: number | null
          trace_id: string
          user_hash: string | null
        }
        Insert: {
          endpoint: string
          error_class?: string | null
          id?: never
          latency_ms?: number | null
          metadata?: Json
          method: string
          occurred_at?: string
          source?: string
          status_code?: number | null
          trace_id: string
          user_hash?: string | null
        }
        Update: {
          endpoint?: string
          error_class?: string | null
          id?: never
          latency_ms?: number | null
          metadata?: Json
          method?: string
          occurred_at?: string
          source?: string
          status_code?: number | null
          trace_id?: string
          user_hash?: string | null
        }
        Relationships: []
      }
      cst_telemetry_rate_limits: {
        Row: {
          events: number
          key_hash: string
          window_started_at: string
        }
        Insert: {
          events?: number
          key_hash: string
          window_started_at?: string
        }
        Update: {
          events?: number
          key_hash?: string
          window_started_at?: string
        }
        Relationships: []
      }
      cst_video_archives: {
        Row: {
          archived_at: string
          created_at: string
          deleted_at: string | null
          expires_at: string
          hold_reason: string | null
          id: string
          media_id: string
          report_id: string
        }
        Insert: {
          archived_at?: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          hold_reason?: string | null
          id?: string
          media_id: string
          report_id: string
        }
        Update: {
          archived_at?: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          hold_reason?: string | null
          id?: string
          media_id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cst_video_archives_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: true
            referencedRelation: "public_report_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cst_video_archives_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: true
            referencedRelation: "report_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cst_video_archives_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cst_video_archives_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      field_agents: {
        Row: {
          created_at: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          mairie_id: string | null
          matricule: string
          organization_id: string | null
          organization_unit_id: string | null
          phone: string | null
          phone_normalized: string | null
          qualification: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          mairie_id?: string | null
          matricule: string
          organization_id?: string | null
          organization_unit_id?: string | null
          phone?: string | null
          phone_normalized?: string | null
          qualification: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          mairie_id?: string | null
          matricule?: string
          organization_id?: string | null
          organization_unit_id?: string | null
          phone?: string | null
          phone_normalized?: string | null
          qualification?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_agents_mairie_id_fkey"
            columns: ["mairie_id"]
            isOneToOne: false
            referencedRelation: "mairies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_agents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_agents_organization_unit_id_fkey"
            columns: ["organization_unit_id"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
        ]
      }
      mairie_signup_rate_limits: {
        Row: {
          attempts: number
          blocked_until: string | null
          key_hash: string
          updated_at: string
          window_started_at: string
        }
        Insert: {
          attempts?: number
          blocked_until?: string | null
          key_hash: string
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          attempts?: number
          blocked_until?: string | null
          key_hash?: string
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      mairies: {
        Row: {
          account_user_id: string | null
          approval_status: string
          commune_id: string
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          location_label: string | null
          longitude: number | null
          mayor_name: string | null
          logo_url: string | null
          name: string
          phone: string | null
          region_id: string
          updated_at: string
        }
        Insert: {
          account_user_id?: string | null
          approval_status?: string
          commune_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          mayor_name?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          region_id: string
          updated_at?: string
        }
        Update: {
          account_user_id?: string | null
          approval_status?: string
          commune_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          mayor_name?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          region_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mairies_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mairies_commune_region_fk"
            columns: ["commune_id", "region_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id", "region_id"]
          },
          {
            foreignKeyName: "mairies_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      moderator_profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          is_active: boolean
          region_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          is_active?: boolean
          region_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          is_active?: boolean
          region_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderator_profiles_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          report_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          report_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          report_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_signup_requests: {
        Row: {
          commune_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          organization_id: string
          phone: string | null
          region_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          structure_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          commune_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          organization_id: string
          phone?: string | null
          region_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          structure_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          commune_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          organization_id?: string
          phone?: string | null
          region_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          structure_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_signup_requests_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_signup_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_signup_requests_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_units: {
        Row: {
          code: string
          commune_id: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          is_active: boolean
          latitude: number | null
          location_label: string | null
          longitude: number | null
          name: string
          organization_id: string
          parent_unit_id: string | null
          phone: string | null
          region_id: string | null
          unit_type: string
          updated_at: string
        }
        Insert: {
          code: string
          commune_id?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          name: string
          organization_id: string
          parent_unit_id?: string | null
          phone?: string | null
          region_id?: string | null
          unit_type: string
          updated_at?: string
        }
        Update: {
          code?: string
          commune_id?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          name?: string
          organization_id?: string
          parent_unit_id?: string | null
          phone?: string | null
          region_id?: string | null
          unit_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_units_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_units_parent_unit_id_fkey"
            columns: ["parent_unit_id"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_units_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_users: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          organization_id: string
          role: string
          unit_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id: string
          role: string
          unit_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          role?: string
          unit_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_users_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          code: string
          created_at: string
          description: string | null
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          phone: string | null
          type: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          type?: string
          updated_at?: string
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
      public_report_comments: {
        Row: {
          body: string
          created_at: string
          display_name: string | null
          id: string
          report_id: string
          visitor_token: string | null
        }
        Insert: {
          body: string
          created_at?: string
          display_name?: string | null
          id?: string
          report_id: string
          visitor_token?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          display_name?: string | null
          id?: string
          report_id?: string
          visitor_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_report_comments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_report_comments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      public_report_confirmations: {
        Row: {
          created_at: string
          report_id: string
          visitor_token: string
        }
        Insert: {
          created_at?: string
          report_id: string
          visitor_token: string
        }
        Update: {
          created_at?: string
          report_id?: string
          visitor_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_report_confirmations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_report_confirmations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          code: string | null
          created_at: string
          geoname_id: number | null
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          geoname_id?: number | null
          id?: string
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          geoname_id?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      report_assignments: {
        Row: {
          agent_id: string | null
          assigned_at: string
          assigned_by: string | null
          assignment_status: string
          completed_at: string | null
          department_id: string | null
          id: string
          mission_note: string | null
          report_id: string
          started_at: string | null
          unassigned_at: string | null
          unit_assignment_id: string | null
        }
        Insert: {
          agent_id?: string | null
          assigned_at?: string
          assigned_by?: string | null
          assignment_status?: string
          completed_at?: string | null
          department_id?: string | null
          id?: string
          mission_note?: string | null
          report_id: string
          started_at?: string | null
          unassigned_at?: string | null
          unit_assignment_id?: string | null
        }
        Update: {
          agent_id?: string | null
          assigned_at?: string
          assigned_by?: string | null
          assignment_status?: string
          completed_at?: string | null
          department_id?: string | null
          id?: string
          mission_note?: string | null
          report_id?: string
          started_at?: string | null
          unassigned_at?: string | null
          unit_assignment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_assignments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_assignments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_assignments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_assignments_unit_assignment_id_fkey"
            columns: ["unit_assignment_id"]
            isOneToOne: false
            referencedRelation: "report_unit_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      report_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          report_id: string
          visibility: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          report_id: string
          visibility?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          report_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_comments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_comments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_confirmations: {
        Row: {
          created_at: string
          report_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          report_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_confirmations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_confirmations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_confirmations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_field_verifications: {
        Row: {
          accuracy_m: number | null
          agent_id: string
          assignment_id: string
          id: string
          latitude: number
          longitude: number
          report_id: string
          verified_at: string
        }
        Insert: {
          accuracy_m?: number | null
          agent_id: string
          assignment_id: string
          id?: string
          latitude: number
          longitude: number
          report_id: string
          verified_at?: string
        }
        Update: {
          accuracy_m?: number | null
          agent_id?: string
          assignment_id?: string
          id?: string
          latitude?: number
          longitude?: number
          report_id?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_field_verifications_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "report_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_field_verifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_field_verifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_media: {
        Row: {
          accuracy_m: number | null
          captured_latitude: number | null
          captured_longitude: number | null
          created_at: string
          file_size: number | null
          id: string
          media_role: string
          media_type: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_reason: string | null
          moderation_status: string
          report_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          accuracy_m?: number | null
          captured_latitude?: number | null
          captured_longitude?: number | null
          created_at?: string
          file_size?: number | null
          id?: string
          media_role?: string
          media_type: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_status?: string
          report_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          accuracy_m?: number | null
          captured_latitude?: number | null
          captured_longitude?: number | null
          created_at?: string
          file_size?: number | null
          id?: string
          media_role?: string
          media_type?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_status?: string
          report_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_media_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_media_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_organization_transfers: {
        Row: {
          created_at: string
          from_mairie_id: string
          id: string
          organization_id: string
          organization_unit_id: string | null
          report_id: string
          responded_at: string | null
          responded_by: string | null
          response_note: string | null
          status: string
          transmitted_at: string
          transmitted_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_mairie_id: string
          id?: string
          organization_id: string
          organization_unit_id?: string | null
          report_id: string
          responded_at?: string | null
          responded_by?: string | null
          response_note?: string | null
          status?: string
          transmitted_at?: string
          transmitted_by: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_mairie_id?: string
          id?: string
          organization_id?: string
          organization_unit_id?: string | null
          report_id?: string
          responded_at?: string | null
          responded_by?: string | null
          response_note?: string | null
          status?: string
          transmitted_at?: string
          transmitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_organization_transfers_from_mairie_id_fkey"
            columns: ["from_mairie_id"]
            isOneToOne: false
            referencedRelation: "mairies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_organization_transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_organization_transfers_organization_unit_id_fkey"
            columns: ["organization_unit_id"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_organization_transfers_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_organization_transfers_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_status_history: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          new_status: string
          old_status: string | null
          reason: string | null
          report_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          new_status: string
          old_status?: string | null
          reason?: string | null
          report_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          new_status?: string
          old_status?: string | null
          reason?: string | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_status_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_status_history_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_status_history_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_unit_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          completed_at: string | null
          created_at: string
          id: string
          mission_note: string | null
          organization_id: string
          report_id: string
          started_at: string | null
          status: string
          unassigned_at: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_note?: string | null
          organization_id: string
          report_id: string
          started_at?: string | null
          status?: string
          unassigned_at?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_note?: string | null
          organization_id?: string
          report_id?: string
          started_at?: string | null
          status?: string
          unassigned_at?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_unit_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_unit_assignments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_unit_assignments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_unit_assignments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          category_id: string
          commune_id: string
          created_at: string
          department_id: string | null
          id: string
          is_public: boolean
          latitude: number | null
          location_label: string | null
          longitude: number | null
          priority: string
          reference_code: string
          region_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category_id: string
          commune_id: string
          created_at?: string
          department_id?: string | null
          id?: string
          is_public?: boolean
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          priority?: string
          reference_code: string
          region_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          commune_id?: string
          created_at?: string
          department_id?: string | null
          id?: string
          is_public?: boolean
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          priority?: string
          reference_code?: string
          region_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_commune_region_fk"
            columns: ["commune_id", "region_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id", "region_id"]
          },
          {
            foreignKeyName: "reports_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      unit_communes: {
        Row: {
          commune_id: string
          created_at: string
          unit_id: string
        }
        Insert: {
          commune_id: string
          created_at?: string
          unit_id: string
        }
        Update: {
          commune_id?: string
          created_at?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_communes_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_communes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_report_media: {
        Row: {
          captured_latitude: number | null
          captured_longitude: number | null
          created_at: string | null
          file_size: number | null
          id: string | null
          media_role: string | null
          media_type: string | null
          moderation_status: string | null
          report_id: string | null
          storage_path: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_media_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_media_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      public_report_status_history: {
        Row: {
          created_at: string | null
          id: string | null
          new_status: string | null
          old_status: string | null
          reason: string | null
          report_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_status_history_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_status_history_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      public_reports: {
        Row: {
          category_id: string | null
          commune_id: string | null
          created_at: string | null
          department_id: string | null
          id: string | null
          location_label: string | null
          priority: string | null
          reference_code: string | null
          region_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          commune_id?: string | null
          created_at?: string | null
          department_id?: string | null
          id?: string | null
          location_label?: string | null
          priority?: string | null
          reference_code?: string | null
          region_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          commune_id?: string | null
          created_at?: string | null
          department_id?: string | null
          id?: string | null
          location_label?: string | null
          priority?: string | null
          reference_code?: string | null
          region_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_commune_region_fk"
            columns: ["commune_id", "region_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id", "region_id"]
          },
          {
            foreignKeyName: "reports_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      agency_assign_report_to_agent: {
        Args: {
          p_agent_id: string
          p_mission_note?: string
          p_unit_assignment_id: string
        }
        Returns: string
      }
      agency_attach_agent: { Args: { p_agent_id: string }; Returns: string }
      agency_can_manage_agent: {
        Args: { p_agent_id: string }
        Returns: boolean
      }
      agent_confirm_field_verification: {
        Args: {
          p_accuracy_m: number
          p_latitude: number
          p_longitude: number
          p_report_id: string
        }
        Returns: {
          accuracy_m: number | null
          agent_id: string
          assignment_id: string
          id: string
          latitude: number
          longitude: number
          report_id: string
          verified_at: string
        }
        SetofOptions: {
          from: "*"
          to: "report_field_verifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      agent_resolve_report: {
        Args: {
          p_media_id: string
          p_report_id: string
          p_resolution_note?: string
        }
        Returns: {
          category_id: string
          commune_id: string
          created_at: string
          department_id: string | null
          id: string
          is_public: boolean
          latitude: number | null
          location_label: string | null
          longitude: number | null
          priority: string
          reference_code: string
          region_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_cst_media_moderation: {
        Args: {
          p_action: string
          p_media_id: string
          p_moderator_id: string
          p_reason?: string
        }
        Returns: {
          status: string
          storage_path: string
        }[]
      }
      approve_mairie_request: {
        Args: { p_mairie_id: string }
        Returns: {
          account_user_id: string | null
          approval_status: string
          commune_id: string
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          location_label: string | null
          longitude: number | null
          mayor_name: string | null
          name: string
          phone: string | null
          region_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "mairies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_organization_signup_request: {
        Args: { p_note?: string; p_request_id: string }
        Returns: {
          commune_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          organization_id: string
          phone: string | null
          region_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          structure_name: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_signup_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_agent_login_rate_limit: {
        Args: {
          p_block_seconds?: number
          p_key_hash: string
          p_max_attempts?: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      consume_citizen_report_rate_limit: {
        Args: {
          p_key_hash: string
          p_max_events?: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      consume_cst_auth_rate_limit: {
        Args: {
          p_block_seconds?: number
          p_key_hash: string
          p_max_attempts?: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      consume_cst_telemetry_rate: {
        Args: {
          p_key_hash: string
          p_max_events?: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      consume_mairie_signup_rate_limit: {
        Args: {
          p_block_seconds?: number
          p_key_hash: string
          p_max_attempts?: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      cst_database_metrics: { Args: never; Returns: Json }
      cst_system_snapshot: { Args: never; Returns: Json }
      earth: { Args: never; Returns: number }
      get_public_report_confirmation: {
        Args: { p_report_id: string; p_visitor_token: string }
        Returns: Json
      }
      has_role: { Args: { required_role: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      list_mairie_transmission_targets: {
        Args: never
        Returns: {
          commune_id: string
          commune_name: string
          organization_code: string
          organization_id: string
          organization_name: string
          organization_type: string
          organization_unit_code: string
          organization_unit_id: string
          organization_unit_name: string
          organization_unit_type: string
        }[]
      }
      list_organization_signup_requests: {
        Args: never
        Returns: {
          commune_id: string
          commune_name: string
          created_at: string
          email: string
          full_name: string
          id: string
          organization_code: string
          organization_id: string
          organization_name: string
          phone: string
          region_id: string
          region_name: string
          review_note: string
          reviewed_at: string
          reviewed_by: string
          status: string
          structure_name: string
          user_id: string
        }[]
      }
      list_pending_mairie_requests: {
        Args: never
        Returns: {
          account_user_id: string
          approval_status: string
          commune_id: string
          commune_name: string
          created_at: string
          id: string
          is_active: boolean
          latitude: number
          location_label: string
          longitude: number
          mayor_name: string
          name: string
          phone: string
          region_id: string
          region_name: string
        }[]
      }
      list_public_report_comments: {
        Args: { p_report_id: string }
        Returns: {
          body: string
          created_at: string
          display_name: string
          id: string
        }[]
      }
      mairie_review_resolution_video: {
        Args: { p_approve: boolean; p_media_id: string }
        Returns: undefined
      }
      mairie_transmit_report: {
        Args: {
          p_note?: string
          p_organization_id: string
          p_organization_unit_id: string
          p_report_id: string
        }
        Returns: string
      }
      organization_accept_transfer: {
        Args: { p_note?: string; p_transfer_id: string }
        Returns: string
      }
      organization_assign_agency: {
        Args: {
          p_agency_unit_id: string
          p_note?: string
          p_transfer_id: string
        }
        Returns: string
      }
      organization_create_agency: {
        Args: {
          p_admin_email?: string
          p_admin_password?: string
          p_code: string
          p_email?: string
          p_latitude?: number
          p_location_label?: string
          p_longitude?: number
          p_name: string
          p_organization_id: string
          p_phone?: string
          p_region_id?: string
        }
        Returns: string
      }
      organization_decline_transfer: {
        Args: { p_note: string; p_transfer_id: string }
        Returns: string
      }
      reject_mairie_request: {
        Args: { p_mairie_id: string }
        Returns: {
          account_user_id: string | null
          approval_status: string
          commune_id: string
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          location_label: string | null
          longitude: number | null
          mayor_name: string | null
          name: string
          phone: string | null
          region_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "mairies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_organization_signup_request: {
        Args: { p_note: string; p_request_id: string }
        Returns: {
          commune_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          organization_id: string
          phone: string | null
          region_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          structure_name: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_signup_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_commune_from_gps: {
        Args: { p_latitude: number; p_longitude: number }
        Returns: string
      }
      submit_public_report_comment: {
        Args: {
          p_body: string
          p_display_name: string
          p_report_id: string
          p_visitor_token: string
        }
        Returns: string
      }
      toggle_public_report_confirmation: {
        Args: { p_report_id: string; p_visitor_token: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
