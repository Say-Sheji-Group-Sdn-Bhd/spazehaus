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
      announcements: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          id: string
          priority: string
          published_date: string
          title: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          id: string
          priority?: string
          published_date: string
          title: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          priority?: string
          published_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          changed_at: string
          changed_by: string | null
          id: number
          row_id: string
          table_name: string
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          changed_at?: string
          changed_by?: string | null
          id?: number
          row_id: string
          table_name: string
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          changed_at?: string
          changed_by?: string | null
          id?: number
          row_id?: string
          table_name?: string
        }
        Relationships: []
      }
      calendar_event_staff: {
        Row: {
          event_id: string
          staff_id: string
        }
        Insert: {
          event_id: string
          staff_id: string
        }
        Update: {
          event_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          end_date: string | null
          end_time: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          id: string
          leave_id: string | null
          notes: string | null
          project_id: string | null
          staff_id: string | null
          start_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          end_time?: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          id: string
          leave_id?: string | null
          notes?: string | null
          project_id?: string | null
          staff_id?: string | null
          start_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          end_time?: string | null
          event_date?: string
          event_type?: Database["public"]["Enums"]["calendar_event_type"]
          id?: string
          leave_id?: string | null
          notes?: string | null
          project_id?: string | null
          staff_id?: string | null
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_leave_id_fkey"
            columns: ["leave_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_google_links: {
        Row: {
          etag: string | null
          event_id: string
          google_calendar_id: string
          google_event_id: string
          last_synced_at: string
          user_id: string
        }
        Insert: {
          etag?: string | null
          event_id: string
          google_calendar_id?: string
          google_event_id: string
          last_synced_at?: string
          user_id: string
        }
        Update: {
          etag?: string | null
          event_id?: string
          google_calendar_id?: string
          google_event_id?: string
          last_synced_at?: string
          user_id?: string
        }
        Relationships: []
      }
      candidates: {
        Row: {
          applied_date: string
          applied_for_role: string
          created_at: string
          experience: string | null
          id: string
          name: string
          notes: string | null
          portfolio_url: string | null
          source: string
          stage: string
          updated_at: string
        }
        Insert: {
          applied_date: string
          applied_for_role: string
          created_at?: string
          experience?: string | null
          id: string
          name: string
          notes?: string | null
          portfolio_url?: string | null
          source: string
          stage: string
          updated_at?: string
        }
        Update: {
          applied_date?: string
          applied_for_role?: string
          created_at?: string
          experience?: string | null
          id?: string
          name?: string
          notes?: string | null
          portfolio_url?: string | null
          source?: string
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          assigned_to_id: string | null
          awarded_date: string | null
          awarded_project_id: string | null
          category: Database["public"]["Enums"]["customer_category"]
          client_name: string
          contact: string | null
          contact_log: Json
          created_at: string
          email: string | null
          estimated_budget: number | null
          estimated_size: number | null
          id: string
          inquiry_date: string
          last_updated: string
          location: string
          notes: string | null
          property_type: string
          rejected_date: string | null
          rejection_reason: string | null
          source: string
          stage: Database["public"]["Enums"]["inquiry_stage"]
          tier: Database["public"]["Enums"]["customer_tier"]
          updated_at: string
        }
        Insert: {
          assigned_to_id?: string | null
          awarded_date?: string | null
          awarded_project_id?: string | null
          category: Database["public"]["Enums"]["customer_category"]
          client_name: string
          contact?: string | null
          contact_log?: Json
          created_at?: string
          email?: string | null
          estimated_budget?: number | null
          estimated_size?: number | null
          id: string
          inquiry_date: string
          last_updated: string
          location: string
          notes?: string | null
          property_type: string
          rejected_date?: string | null
          rejection_reason?: string | null
          source: string
          stage?: Database["public"]["Enums"]["inquiry_stage"]
          tier?: Database["public"]["Enums"]["customer_tier"]
          updated_at?: string
        }
        Update: {
          assigned_to_id?: string | null
          awarded_date?: string | null
          awarded_project_id?: string | null
          category?: Database["public"]["Enums"]["customer_category"]
          client_name?: string
          contact?: string | null
          contact_log?: Json
          created_at?: string
          email?: string | null
          estimated_budget?: number | null
          estimated_size?: number | null
          id?: string
          inquiry_date?: string
          last_updated?: string
          location?: string
          notes?: string | null
          property_type?: string
          rejected_date?: string | null
          rejection_reason?: string | null
          source?: string
          stage?: Database["public"]["Enums"]["inquiry_stage"]
          tier?: Database["public"]["Enums"]["customer_tier"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_awarded_project_id_fkey"
            columns: ["awarded_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_records: {
        Row: {
          created_at: string
          id: number
          month: number
          notes: string | null
          part_a_score: number
          part_b_score: number
          part_c_score: number
          rating: string
          reviewer_id: string | null
          staff_id: string
          total_score: number | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: number
          month: number
          notes?: string | null
          part_a_score: number
          part_b_score: number
          part_c_score: number
          rating: string
          reviewer_id?: string | null
          staff_id: string
          total_score?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: number
          month?: number
          notes?: string | null
          part_a_score?: number
          part_b_score?: number
          part_c_score?: number
          rating?: string
          reviewer_id?: string | null
          staff_id?: string
          total_score?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_records_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          applied_date: string
          approved_at: string | null
          approved_by_id: string | null
          created_at: string
          days: number
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          staff_id: string
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
        }
        Insert: {
          applied_date: string
          approved_at?: string | null
          approved_by_id?: string | null
          created_at?: string
          days: number
          end_date: string
          id: string
          leave_type: string
          reason?: string | null
          staff_id: string
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
        }
        Update: {
          applied_date?: string
          approved_at?: string | null
          approved_by_id?: string | null
          created_at?: string
          days?: number
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          staff_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approved_by_id_fkey"
            columns: ["approved_by_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_stages: {
        Row: {
          id: string
          label: string
          order_index: number
          payment_gate: number | null
          phase: string
          signature_key: string | null
          stage_type: string
        }
        Insert: {
          id: string
          label: string
          order_index: number
          payment_gate?: number | null
          phase: string
          signature_key?: string | null
          stage_type: string
        }
        Update: {
          id?: string
          label?: string
          order_index?: number
          payment_gate?: number | null
          phase?: string
          signature_key?: string | null
          stage_type?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          announcements: boolean
          notifications_enabled: boolean
          payment_alerts: boolean
          reminders: boolean
          staff_id: string
          task_updates: boolean
          updated_at: string
        }
        Insert: {
          announcements?: boolean
          notifications_enabled?: boolean
          payment_alerts?: boolean
          reminders?: boolean
          staff_id: string
          task_updates?: boolean
          updated_at?: string
        }
        Update: {
          announcements?: boolean
          notifications_enabled?: boolean
          payment_alerts?: boolean
          reminders?: boolean
          staff_id?: string
          task_updates?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          amount: number
          collected_date: string | null
          created_at: string
          due_date: string | null
          gate: number
          id: number
          instalment: number | null
          label: string
          notes: string | null
          of_instalments: number | null
          project_id: string
          reference: string | null
          status: Database["public"]["Enums"]["checkpoint_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          collected_date?: string | null
          created_at?: string
          due_date?: string | null
          gate: number
          id?: number
          instalment?: number | null
          label: string
          notes?: string | null
          of_instalments?: number | null
          project_id: string
          reference?: string | null
          status?: Database["public"]["Enums"]["checkpoint_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          collected_date?: string | null
          created_at?: string
          due_date?: string | null
          gate?: number
          id?: number
          instalment?: number | null
          label?: string
          notes?: string | null
          of_instalments?: number | null
          project_id?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["checkpoint_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_reviews: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string | null
          id: string
          project_id: string
          rating: number
          reviewer_name: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id: string
          project_id: string
          rating: number
          reviewer_name?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string
          rating?: number
          reviewer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_reviews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          area: string | null
          assignee_id: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          project_id: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id: string
          project_id: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          project_id?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          areas: string[]
          budget: number
          client_access_token: string
          client_address: string | null
          client_contact: string | null
          client_email: string | null
          client_name: string
          created_at: string
          created_by: string | null
          current_stage_id: string | null
          description: string | null
          designer_id: string | null
          id: string
          image_path: string | null
          lifecycle_started_at: string | null
          location: string
          name: string
          photo_count: number
          pm_id: string | null
          priority: Database["public"]["Enums"]["project_priority"]
          progress: number
          project_code: string | null
          project_type: string
          property_type: string
          service_type: string | null
          size_sqft: number
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          target_date: string | null
          task_count: number
          tasks_completed: number
          team: string[]
          updated_at: string
        }
        Insert: {
          areas?: string[]
          budget: number
          client_access_token?: string
          client_address?: string | null
          client_contact?: string | null
          client_email?: string | null
          client_name: string
          created_at?: string
          created_by?: string | null
          current_stage_id?: string | null
          description?: string | null
          designer_id?: string | null
          id: string
          image_path?: string | null
          lifecycle_started_at?: string | null
          location: string
          name: string
          photo_count?: number
          pm_id?: string | null
          priority?: Database["public"]["Enums"]["project_priority"]
          progress?: number
          project_code?: string | null
          project_type: string
          property_type: string
          service_type?: string | null
          size_sqft: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          target_date?: string | null
          task_count?: number
          tasks_completed?: number
          team?: string[]
          updated_at?: string
        }
        Update: {
          areas?: string[]
          budget?: number
          client_access_token?: string
          client_address?: string | null
          client_contact?: string | null
          client_email?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          current_stage_id?: string | null
          description?: string | null
          designer_id?: string | null
          id?: string
          image_path?: string | null
          lifecycle_started_at?: string | null
          location?: string
          name?: string
          photo_count?: number
          pm_id?: string | null
          priority?: Database["public"]["Enums"]["project_priority"]
          progress?: number
          project_code?: string | null
          project_type?: string
          property_type?: string
          service_type?: string | null
          size_sqft?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          target_date?: string | null
          task_count?: number
          tasks_completed?: number
          team?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "lifecycle_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_pm_id_fkey"
            columns: ["pm_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          area: string
          category: Database["public"]["Enums"]["line_item_category"]
          description: string
          discount: number
          id: string
          qty: number
          quotation_id: string
          sort_order: number
          unit: string
          unit_price: number
        }
        Insert: {
          area: string
          category: Database["public"]["Enums"]["line_item_category"]
          description: string
          discount?: number
          id: string
          qty: number
          quotation_id: string
          sort_order?: number
          unit: string
          unit_price: number
        }
        Update: {
          area?: string
          category?: Database["public"]["Enums"]["line_item_category"]
          description?: string
          discount?: number
          id?: string
          qty?: number
          quotation_id?: string
          sort_order?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          client_address: string | null
          client_contact: string | null
          client_email: string | null
          client_name: string
          created_at: string
          created_by: string | null
          doc_type: Database["public"]["Enums"]["quotation_type"]
          due_date: string | null
          id: string
          issue_date: string
          notes: string | null
          project_id: string | null
          revision: number
          status: Database["public"]["Enums"]["quotation_status"]
          tax_rate: number
          terms: string | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          client_address?: string | null
          client_contact?: string | null
          client_email?: string | null
          client_name: string
          created_at?: string
          created_by?: string | null
          doc_type?: Database["public"]["Enums"]["quotation_type"]
          due_date?: string | null
          id: string
          issue_date: string
          notes?: string | null
          project_id?: string | null
          revision?: number
          status?: Database["public"]["Enums"]["quotation_status"]
          tax_rate?: number
          terms?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          client_address?: string | null
          client_contact?: string | null
          client_email?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          doc_type?: Database["public"]["Enums"]["quotation_type"]
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          project_id?: string | null
          revision?: number
          status?: Database["public"]["Enums"]["quotation_status"]
          tax_rate?: number
          terms?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_targets: {
        Row: {
          created_at: string
          effective_from: string
          gp_target_pct: number
          monthly_target: number
          staff_id: string
          updated_at: string
          ytd_target: number
        }
        Insert: {
          created_at?: string
          effective_from: string
          gp_target_pct: number
          monthly_target: number
          staff_id: string
          updated_at?: string
          ytd_target: number
        }
        Update: {
          created_at?: string
          effective_from?: string
          gp_target_pct?: number
          monthly_target?: number
          staff_id?: string
          updated_at?: string
          ytd_target?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_targets_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_records: {
        Row: {
          created_at: string
          document_ref: string | null
          group_name: string
          id: number
          label: string
          notes: string | null
          project_id: string
          signature_key: string
          signed_by: string | null
          signed_date: string | null
          status: Database["public"]["Enums"]["checkpoint_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_ref?: string | null
          group_name: string
          id?: number
          label: string
          notes?: string | null
          project_id: string
          signature_key: string
          signed_by?: string | null
          signed_date?: string | null
          status?: Database["public"]["Enums"]["checkpoint_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_ref?: string | null
          group_name?: string
          id?: number
          label?: string
          notes?: string | null
          project_id?: string
          signature_key?: string
          signed_by?: string | null
          signed_date?: string | null
          status?: Database["public"]["Enums"]["checkpoint_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_photos: {
        Row: {
          id: number
          lat: number | null
          lng: number | null
          notes: string | null
          photo_date: string
          project_id: string
          storage_path: string | null
          uploaded_at: string
          uploaded_by_id: string | null
        }
        Insert: {
          id?: number
          lat?: number | null
          lng?: number | null
          notes?: string | null
          photo_date: string
          project_id: string
          storage_path?: string | null
          uploaded_at?: string
          uploaded_by_id?: string | null
        }
        Update: {
          id?: number
          lat?: number | null
          lng?: number | null
          notes?: string | null
          photo_date?: string
          project_id?: string
          storage_path?: string | null
          uploaded_at?: string
          uploaded_by_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_photos_uploaded_by_id_fkey"
            columns: ["uploaded_by_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      spacology_results: {
        Row: {
          answer_count: number
          answers: Json
          created_at: string
          duration_ms: number | null
          email: string | null
          id: string
          inquiry_id: string | null
          is_tie: boolean
          landing_path: string | null
          locale: string | null
          name: string | null
          notes: string | null
          phone: string | null
          planning_renovation: boolean | null
          quiz_version: string
          referrer: string | null
          result_name_cn: string | null
          result_name_en: string | null
          result_type: string
          scores: Json
          source: string
          submitted_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          answer_count?: number
          answers?: Json
          created_at?: string
          duration_ms?: number | null
          email?: string | null
          id: string
          inquiry_id?: string | null
          is_tie?: boolean
          landing_path?: string | null
          locale?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          planning_renovation?: boolean | null
          quiz_version?: string
          referrer?: string | null
          result_name_cn?: string | null
          result_name_en?: string | null
          result_type: string
          scores?: Json
          source?: string
          submitted_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          answer_count?: number
          answers?: Json
          created_at?: string
          duration_ms?: number | null
          email?: string | null
          id?: string
          inquiry_id?: string | null
          is_tie?: boolean
          landing_path?: string | null
          locale?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          planning_renovation?: boolean | null
          quiz_version?: string
          referrer?: string | null
          result_name_cn?: string | null
          result_name_en?: string | null
          result_type?: string
          scores?: Json
          source?: string
          submitted_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spacology_results_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          auth_user_id: string | null
          avatar_code: string
          created_at: string
          dept: string
          email: string
          id: string
          job_title: string
          join_date: string
          kpi_grade: string | null
          leave_balance_annual: number
          leave_balance_medical: number
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          status: Database["public"]["Enums"]["staff_status"]
          updated_at: string
          whatsapp_opt_in: boolean
        }
        Insert: {
          auth_user_id?: string | null
          avatar_code: string
          created_at?: string
          dept: string
          email: string
          id: string
          job_title: string
          join_date: string
          kpi_grade?: string | null
          leave_balance_annual?: number
          leave_balance_medical?: number
          name: string
          phone?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          status?: Database["public"]["Enums"]["staff_status"]
          updated_at?: string
          whatsapp_opt_in?: boolean
        }
        Update: {
          auth_user_id?: string | null
          avatar_code?: string
          created_at?: string
          dept?: string
          email?: string
          id?: string
          job_title?: string
          join_date?: string
          kpi_grade?: string | null
          leave_balance_annual?: number
          leave_balance_medical?: number
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          status?: Database["public"]["Enums"]["staff_status"]
          updated_at?: string
          whatsapp_opt_in?: boolean
        }
        Relationships: []
      }
      whatsapp_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: number
          phone: string
          project_id: string | null
          provider: string
          provider_message_id: string | null
          reminder_type: string
          sent_at: string
          staff_id: string
          status: string
          template_name: string | null
          template_variables: Json | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: number
          phone: string
          project_id?: string | null
          provider: string
          provider_message_id?: string | null
          reminder_type: string
          sent_at?: string
          staff_id: string
          status: string
          template_name?: string | null
          template_variables?: Json | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: number
          phone?: string
          project_id?: string | null
          provider?: string
          provider_message_id?: string | null
          reminder_type?: string
          sent_at?: string
          staff_id?: string
          status?: string
          template_name?: string | null
          template_variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_log_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      convert_inquiry_to_project: {
        Args: {
          p_areas: string[]
          p_assigned_to_avatar?: string
          p_budget: number
          p_designer_avatar: string
          p_designer_name: string
          p_inquiry_id: string
          p_pm_avatar: string
          p_pm_name: string
          p_priority: string
          p_project_name: string
          p_proposal_deposit: number
          p_service_type?: string
          p_start_date: string
          p_target_date: string
        }
        Returns: string
      }
      create_calendar_event_with_staff: {
        Args: {
          p_color: string
          p_end_date?: string
          p_end_time?: string
          p_event_date: string
          p_event_type: Database["public"]["Enums"]["calendar_event_type"]
          p_notes?: string
          p_project_id?: string
          p_staff_ids?: string[]
          p_start_time?: string
          p_title: string
        }
        Returns: {
          color: string
          created_at: string
          created_by: string | null
          end_date: string | null
          end_time: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          id: string
          leave_id: string | null
          notes: string | null
          project_id: string | null
          staff_id: string | null
          start_time: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "calendar_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_staff_avatar: { Args: never; Returns: string }
      current_staff_id: { Args: never; Returns: string }
      current_staff_role: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      get_client_portal_data: { Args: { p_token: string }; Returns: Json }
      is_admin_tier: { Args: never; Returns: boolean }
      is_ops_tier: { Args: never; Returns: boolean }
      maybe_advance_project_stage: {
        Args: { p_project_id: string }
        Returns: string
      }
      recalc_project_photo_rollup: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      recalc_project_task_rollup: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      staff_email_exists: { Args: { p_email: string }; Returns: boolean }
      submit_client_review: {
        Args: {
          p_comment?: string
          p_rating: number
          p_reviewer_name?: string
          p_token: string
        }
        Returns: undefined
      }
      submit_spacology_result: {
        Args: {
          p_answers?: Json
          p_duration_ms?: number
          p_email?: string
          p_is_tie?: boolean
          p_landing_path?: string
          p_locale?: string
          p_name?: string
          p_phone?: string
          p_planning_renovation?: boolean
          p_quiz_version?: string
          p_referrer?: string
          p_result_name_cn?: string
          p_result_name_en?: string
          p_result_type: string
          p_scores: Json
          p_user_agent?: string
          p_utm_campaign?: string
          p_utm_medium?: string
          p_utm_source?: string
        }
        Returns: string
      }
    }
    Enums: {
      calendar_event_type: "project" | "meeting" | "leave" | "event"
      checkpoint_status:
        | "completed"
        | "in-progress"
        | "pending"
        | "overdue"
        | "skipped"
      customer_category:
        | "Residential"
        | "Commercial"
        | "F&B"
        | "Office"
        | "Investor"
      customer_tier: "VIP" | "Repeat" | "Referral" | "Standard"
      inquiry_stage: "new-inquiry" | "showroom-meet" | "awarded" | "rejected"
      leave_status: "pending" | "approved" | "rejected"
      line_item_category:
        | "Design"
        | "Material"
        | "Labour"
        | "Furniture"
        | "Electrical"
        | "Plumbing"
        | "Others"
      project_priority: "high" | "medium" | "low"
      project_status:
        | "active"
        | "assigned"
        | "under-review"
        | "completed"
        | "on-hold"
      quotation_status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "invoiced"
        | "paid"
      quotation_type: "Quotation" | "Invoice" | "Proforma Invoice"
      staff_role:
        | "admin"
        | "principal"
        | "designer"
        | "sales"
        | "site_supervisor"
        | "pm"
        | "admin_exec"
      staff_status: "active" | "on-leave" | "on-project" | "inactive"
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
      calendar_event_type: ["project", "meeting", "leave", "event"],
      checkpoint_status: [
        "completed",
        "in-progress",
        "pending",
        "overdue",
        "skipped",
      ],
      customer_category: [
        "Residential",
        "Commercial",
        "F&B",
        "Office",
        "Investor",
      ],
      customer_tier: ["VIP", "Repeat", "Referral", "Standard"],
      inquiry_stage: ["new-inquiry", "showroom-meet", "awarded", "rejected"],
      leave_status: ["pending", "approved", "rejected"],
      line_item_category: [
        "Design",
        "Material",
        "Labour",
        "Furniture",
        "Electrical",
        "Plumbing",
        "Others",
      ],
      project_priority: ["high", "medium", "low"],
      project_status: [
        "active",
        "assigned",
        "under-review",
        "completed",
        "on-hold",
      ],
      quotation_status: [
        "draft",
        "sent",
        "accepted",
        "rejected",
        "invoiced",
        "paid",
      ],
      quotation_type: ["Quotation", "Invoice", "Proforma Invoice"],
      staff_role: [
        "admin",
        "principal",
        "designer",
        "sales",
        "site_supervisor",
        "pm",
        "admin_exec",
      ],
      staff_status: ["active", "on-leave", "on-project", "inactive"],
    },
  },
} as const
