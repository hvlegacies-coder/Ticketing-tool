export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          brand_color: string
          support_email: string | null
          plan: string
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          brand_color?: string
          support_email?: string | null
          plan?: string
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          brand_color?: string
          support_email?: string | null
          plan?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          id: string
          organization_id: string
          email: string
          role: string
          token: string
          invited_by: string | null
          accepted_at: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          email: string
          role?: string
          token?: string
          invited_by?: string | null
          accepted_at?: string | null
          expires_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          email?: string
          role?: string
          token?: string
          invited_by?: string | null
          accepted_at?: string | null
          expires_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_integrations: {
        Row: {
          organization_id: string
          monday_api_token: string | null
          monday_board_id: string | null
          monday_group_id: string | null
          ai_chat_enabled: boolean
          ai_system_prompt_override: string | null
          updated_at: string
        }
        Insert: {
          organization_id: string
          monday_api_token?: string | null
          monday_board_id?: string | null
          monday_group_id?: string | null
          ai_chat_enabled?: boolean
          ai_system_prompt_override?: string | null
          updated_at?: string
        }
        Update: {
          organization_id?: string
          monday_api_token?: string | null
          monday_board_id?: string | null
          monday_group_id?: string | null
          ai_chat_enabled?: boolean
          ai_system_prompt_override?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          id: string
          organization_id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          color?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_tags: {
        Row: {
          ticket_id: string
          tag_id: string
          created_at: string
        }
        Insert: {
          ticket_id: string
          tag_id: string
          created_at?: string
        }
        Update: {
          ticket_id?: string
          tag_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_tags_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_policies: {
        Row: {
          id: string
          organization_id: string
          priority: string
          first_response_minutes: number
          resolution_minutes: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          priority: string
          first_response_minutes: number
          resolution_minutes: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          priority?: string
          first_response_minutes?: number
          resolution_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      canned_responses: {
        Row: {
          id: string
          organization_id: string
          title: string
          body: string
          category: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          title: string
          body: string
          category?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          title?: string
          body?: string
          category?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canned_responses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_notes: {
        Row: {
          id: string
          ticket_id: string
          author_id: string | null
          author_name: string
          note: string
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          author_id?: string | null
          author_name: string
          note: string
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          author_id?: string | null
          author_name?: string
          note?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_notes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_activity: {
        Row: {
          id: string
          ticket_id: string
          actor_id: string | null
          actor_name: string | null
          action: string
          meta: Json
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          actor_id?: string | null
          actor_name?: string | null
          action: string
          meta?: Json
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          actor_id?: string | null
          actor_name?: string | null
          action?: string
          meta?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_activity_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          sender_email: string | null
          sender_name: string
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_email?: string | null
          sender_name: string
          sender_type: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_email?: string | null
          sender_name?: string
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
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
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
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
      tickets: {
        Row: {
          affected_system: string | null
          assigned_to: string | null
          assigned_to_user_id: string | null
          attachments: string[] | null
          chatbot_transcript: Json | null
          client_access_token: string
          client_full_name: string
          closed_at: string | null
          company_name: string
          created_at: string
          department: string | null
          email: string
          first_responded_at: string | null
          first_response_due_at: string | null
          id: string
          internal_notes: string | null
          issue_category: string
          issue_description: string
          issue_title: string
          monday_item_id: string | null
          organization_id: string
          phone: string | null
          preferred_contact_method: string | null
          priority: string
          related_link: string | null
          resolution_due_at: string | null
          resolved_at: string | null
          sla_breached: boolean
          sla_policy_id: string | null
          status: string
          sync_error_message: string | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          affected_system?: string | null
          assigned_to?: string | null
          assigned_to_user_id?: string | null
          attachments?: string[] | null
          chatbot_transcript?: Json | null
          client_access_token?: string
          client_full_name: string
          closed_at?: string | null
          company_name: string
          created_at?: string
          department?: string | null
          email: string
          first_responded_at?: string | null
          first_response_due_at?: string | null
          id?: string
          internal_notes?: string | null
          issue_category: string
          issue_description: string
          issue_title: string
          monday_item_id?: string | null
          organization_id: string
          phone?: string | null
          preferred_contact_method?: string | null
          priority?: string
          related_link?: string | null
          resolution_due_at?: string | null
          resolved_at?: string | null
          sla_breached?: boolean
          sla_policy_id?: string | null
          status?: string
          sync_error_message?: string | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          affected_system?: string | null
          assigned_to?: string | null
          assigned_to_user_id?: string | null
          attachments?: string[] | null
          chatbot_transcript?: Json | null
          client_access_token?: string
          client_full_name?: string
          closed_at?: string | null
          company_name?: string
          created_at?: string
          department?: string | null
          email?: string
          first_responded_at?: string | null
          first_response_due_at?: string | null
          id?: string
          internal_notes?: string | null
          issue_category?: string
          issue_description?: string
          issue_title?: string
          monday_item_id?: string | null
          organization_id?: string
          phone?: string | null
          preferred_contact_method?: string | null
          priority?: string
          related_link?: string | null
          resolution_due_at?: string | null
          resolved_at?: string | null
          sla_breached?: boolean
          sla_policy_id?: string | null
          status?: string
          sync_error_message?: string | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_sla_policy_id_fkey"
            columns: ["sla_policy_id"]
            isOneToOne: false
            referencedRelation: "sla_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_assigned_to_user_id_profiles_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { _token: string }
        Returns: string
      }
      check_sla_breaches: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_invitation_preview: {
        Args: { _token: string }
        Returns: {
          organization_name: string
          email: string
          role: string
          expires_at: string
          accepted_at: string | null
        }[]
      }
      get_org_integration_settings: {
        Args: { _org_id: string }
        Returns: {
          monday_configured: boolean
          monday_board_id: string | null
          monday_group_id: string | null
          ai_chat_enabled: boolean
          ai_system_prompt_override: string | null
        }[]
      }
      get_org_public_profile: {
        Args: { _slug: string }
        Returns: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          brand_color: string
          support_email: string | null
        }[]
      }
      get_org_role: {
        Args: { _org_id: string; _user_id?: string }
        Returns: string
      }
      get_ticket_by_token: {
        Args: { _token: string }
        Returns: {
          id: string
          issue_title: string
          issue_description: string
          issue_category: string
          priority: string
          status: string
          department: string | null
          affected_system: string | null
          client_full_name: string
          company_name: string
          email: string
          created_at: string
          updated_at: string
          attachments: string[] | null
          organization_id: string
          organization_name: string
          organization_slug: string
        }[]
      }
      get_ticket_messages_by_token: {
        Args: { _token: string }
        Returns: Database["public"]["Tables"]["chat_messages"]["Row"][]
      }
      has_org_role: {
        Args: { _org_id: string; _roles: string[] }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string }
        Returns: boolean
      }
      log_ticket_activity: {
        Args: { _ticket_id: string; _action: string; _meta?: Json }
        Returns: undefined
      }
      organization_exists: {
        Args: { _org_id: string }
        Returns: boolean
      }
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
      send_client_message_by_token: {
        Args: { _token: string; _sender_name: string; _sender_email: string; _message: string }
        Returns: Database["public"]["Tables"]["chat_messages"]["Row"]
      }
      upsert_org_integration_settings: {
        Args: {
          _org_id: string
          _monday_api_token: string
          _monday_board_id: string
          _monday_group_id: string
          _ai_chat_enabled: boolean
          _ai_system_prompt_override: string
        }
        Returns: undefined
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
    Enums: {},
  },
} as const
