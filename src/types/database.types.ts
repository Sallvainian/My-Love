export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      anniversaries: {
        Row: {
          client_key: string
          created_at: string
          description: string | null
          event_date: string
          id: string
          label: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          client_key?: string
          created_at?: string
          description?: string | null
          event_date: string
          id?: string
          label: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_key?: string
          created_at?: string
          description?: string | null
          event_date?: string
          id?: string
          label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      claude_bot_config: {
        Row: {
          created_at: string | null
          key: string
          value: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          key: string
          value: string
        }
        Update: {
          created_at?: string | null
          key?: string
          value?: string
        }
        Relationships: []
      }
      countdown_marks: {
        Row: {
          created_at: string
          date_key: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          date_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_key?: string
          user_id?: string
        }
        Relationships: []
      }
      couple_days: {
        Row: {
          created_at: string
          cycle: number
          day: string
          id: string
          question_id: string
          user_a: string
          user_b: string
          writer: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          cycle: number
          day: string
          id?: string
          question_id: string
          user_a: string
          user_b: string
          writer: string
        }
        Update: {
          created_at?: string
          cycle?: number
          day?: string
          id?: string
          question_id?: string
          user_a?: string
          user_b?: string
          writer?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_days_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "daily_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_days_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_days_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_settings: {
        Row: {
          relationship_start: string | null
          updated_at: string
          user_a: string
          user_b: string
          wedding_date: string | null
        }
        ComputedFields: never
        Insert: {
          relationship_start?: string | null
          updated_at?: string
          user_a: string
          user_b: string
          wedding_date?: string | null
        }
        Update: {
          relationship_start?: string | null
          updated_at?: string
          user_a?: string
          user_b?: string
          wedding_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couple_settings_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_settings_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_messages: {
        Row: {
          active: boolean
          category: string
          client_key: string
          created_at: string
          id: string
          is_favorite: boolean
          tags: string[]
          text: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          category: string
          client_key?: string
          created_at?: string
          id?: string
          is_favorite?: boolean
          tags?: string[]
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          category?: string
          client_key?: string
          created_at?: string
          id?: string
          is_favorite?: boolean
          tags?: string[]
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_picks: {
        Row: {
          choice: string
          created_at: string
          day_id: string
          effective_zone: string
          id: string
          is_second: boolean
          picked_at: string
          time_zone: string
          user_id: string
          utc_offset_minutes: number
        }
        ComputedFields: never
        Insert: {
          choice: string
          created_at?: string
          day_id: string
          effective_zone: string
          id?: string
          is_second: boolean
          picked_at: string
          time_zone: string
          user_id: string
          utc_offset_minutes: number
        }
        Update: {
          choice?: string
          created_at?: string
          day_id?: string
          effective_zone?: string
          id?: string
          is_second?: boolean
          picked_at?: string
          time_zone?: string
          user_id?: string
          utc_offset_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_picks_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "couple_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_picks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_questions: {
        Row: {
          id: string
          source_day_id: string | null
          target_day: string | null
          that_text: string
          this_text: string
          user_a: string | null
          user_b: string | null
        }
        ComputedFields: never
        Insert: {
          id?: string
          source_day_id?: string | null
          target_day?: string | null
          that_text: string
          this_text: string
          user_a?: string | null
          user_b?: string | null
        }
        Update: {
          id?: string
          source_day_id?: string | null
          target_day?: string | null
          that_text?: string
          this_text?: string
          user_a?: string | null
          user_b?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_questions_source_day_id_fkey"
            columns: ["source_day_id"]
            isOneToOne: true
            referencedRelation: "couple_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_questions_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_questions_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          event_date: string
          icon: string
          id: string
          label: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          description?: string | null
          event_date: string
          icon?: string
          id?: string
          label: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_date?: string
          icon?: string
          id?: string
          label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      interactions: {
        Row: {
          created_at: string | null
          from_user_id: string
          id: string
          to_user_id: string
          type: string
          viewed: boolean | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          from_user_id: string
          id?: string
          to_user_id: string
          type: string
          viewed?: boolean | null
        }
        Update: {
          created_at?: string | null
          from_user_id?: string
          id?: string
          to_user_id?: string
          type?: string
          viewed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      love_note_removals: {
        Row: {
          note_id: string
          removed_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          note_id: string
          removed_at?: string
          user_id: string
        }
        Update: {
          note_id?: string
          removed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "love_note_removals_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "love_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "love_note_removals_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "love_notes_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      love_note_upload_counts: {
        Row: {
          upload_count: number
          user_id: string
          window_started_at: string
        }
        ComputedFields: never
        Insert: {
          upload_count?: number
          user_id: string
          window_started_at?: string
        }
        Update: {
          upload_count?: number
          user_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
      love_notes: {
        Row: {
          content: string
          created_at: string
          from_user_id: string
          id: string
          idempotency_key: string
          image_url: string | null
          to_user_id: string
          written_at: string | null
        }
        ComputedFields: never
        Insert: {
          content: string
          created_at?: string
          from_user_id: string
          id?: string
          idempotency_key?: string
          image_url?: string | null
          to_user_id: string
          written_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          from_user_id?: string
          id?: string
          idempotency_key?: string
          image_url?: string | null
          to_user_id?: string
          written_at?: string | null
        }
        Relationships: []
      }
      love_notes_read_markers: {
        Row: {
          last_opened_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          last_opened_at?: string
          user_id: string
        }
        Update: {
          last_opened_at?: string
          user_id?: string
        }
        Relationships: []
      }
      message_favorites: {
        Row: {
          created_at: string
          message_key: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          message_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          message_key?: string
          user_id?: string
        }
        Relationships: []
      }
      moods: {
        Row: {
          created_at: string | null
          id: string
          mood_type: string
          mood_types: string[] | null
          note: string | null
          updated_at: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          id?: string
          mood_type: string
          mood_types?: string[] | null
          note?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mood_type?: string
          mood_types?: string[] | null
          note?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_requests: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          status: string
          to_user_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          status?: string
          to_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          status?: string
          to_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_requests_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_requests_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          caption: string | null
          created_at: string
          file_size: number
          filename: string
          height: number
          id: string
          mime_type: string
          storage_path: string
          user_id: string
          width: number
        }
        ComputedFields: never
        Insert: {
          caption?: string | null
          created_at?: string
          file_size: number
          filename: string
          height: number
          id?: string
          mime_type?: string
          storage_path: string
          user_id: string
          width: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_size?: number
          filename?: string
          height?: number
          id?: string
          mime_type?: string
          storage_path?: string
          user_id?: string
          width?: number
        }
        Relationships: []
      }
      push_devices: {
        Row: {
          created_at: string
          environment: string
          id: string
          token: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          environment: string
          id?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          environment?: string
          id?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_preferences: {
        Row: {
          created_at: string
          date_reminders: boolean
          love_notes: boolean
          moods: boolean
          partner_requests: boolean
          photos: boolean
          pokes_and_kisses: boolean
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          date_reminders?: boolean
          love_notes?: boolean
          moods?: boolean
          partner_requests?: boolean
          photos?: boolean
          pokes_and_kisses?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          date_reminders?: boolean
          love_notes?: boolean
          moods?: boolean
          partner_requests?: boolean
          photos?: boolean
          pokes_and_kisses?: boolean
          user_id?: string
        }
        Relationships: []
      }
      push_requests: {
        Row: {
          created_at: string
          delivery: string
          environment: string
          id: string
          interaction_id: string | null
          mood_id: string | null
          note_id: string | null
          partner_accept_id: string | null
          partner_request_id: string | null
          payload: NonNullable<Json>
          photo_id: string | null
          token: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          delivery: string
          environment: string
          id?: string
          interaction_id?: string | null
          mood_id?: string | null
          note_id?: string | null
          partner_accept_id?: string | null
          partner_request_id?: string | null
          payload: NonNullable<Json>
          photo_id?: string | null
          token: string
        }
        Update: {
          created_at?: string
          delivery?: string
          environment?: string
          id?: string
          interaction_id?: string | null
          mood_id?: string | null
          note_id?: string | null
          partner_accept_id?: string | null
          partner_request_id?: string | null
          payload?: NonNullable<Json>
          photo_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_requests_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_requests_mood_id_fkey"
            columns: ["mood_id"]
            isOneToOne: false
            referencedRelation: "moods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_requests_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "love_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_requests_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "love_notes_visible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_requests_partner_accept_id_fkey"
            columns: ["partner_accept_id"]
            isOneToOne: false
            referencedRelation: "partner_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_requests_partner_request_id_fkey"
            columns: ["partner_request_id"]
            isOneToOne: false
            referencedRelation: "partner_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_requests_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      push_sender_settings: {
        Row: {
          sender_secret: string
          sender_url: string
          singleton: boolean
        }
        ComputedFields: never
        Insert: {
          sender_secret: string
          sender_url: string
          singleton?: boolean
        }
        Update: {
          sender_secret?: string
          sender_url?: string
          singleton?: boolean
        }
        Relationships: []
      }
      user_time_zones: {
        Row: {
          effective_zone: string
          reported_at: string
          time_zone: string
          user_id: string
          utc_offset_minutes: number
        }
        ComputedFields: never
        Insert: {
          effective_zone: string
          reported_at: string
          time_zone: string
          user_id: string
          utc_offset_minutes: number
        }
        Update: {
          effective_zone?: string
          reported_at?: string
          time_zone?: string
          user_id?: string
          utc_offset_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_time_zones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          birthday: string | null
          created_at: string | null
          device_id: string | null
          display_name: string | null
          email: string | null
          id: string
          partner_id: string | null
          partner_name: string | null
          updated_at: string | null
        }
        ComputedFields: never
        Insert: {
          birthday?: string | null
          created_at?: string | null
          device_id?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          partner_id?: string | null
          partner_name?: string | null
          updated_at?: string | null
        }
        Update: {
          birthday?: string | null
          created_at?: string | null
          device_id?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          partner_id?: string | null
          partner_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      love_notes_visible: {
        Row: {
          content: string
          created_at: string
          from_user_id: string
          id: string
          idempotency_key: string
          image_url: string | null
          to_user_id: string
          written_at: string | null
        }
        ComputedFields: never
        Insert: {
          content?: string | null
          created_at?: string | null
          from_user_id?: string | null
          id?: string | null
          idempotency_key?: string | null
          image_url?: string | null
          to_user_id?: string | null
          written_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          from_user_id?: string | null
          id?: string | null
          idempotency_key?: string | null
          image_url?: string | null
          to_user_id?: string | null
          written_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_partner_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      assign_couple_day: {
        Args: { day: string; user_a: string; user_b: string }
        Returns: {
          created_at: string
          cycle: number
          day: string
          id: string
          question_id: string
          user_a: string
          user_b: string
          writer: string
        }
        SetofOptions: {
          from: "*"
          to: "couple_days"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_love_note_upload: {
        Args: Record<PropertyKey, never>
        Returns: {
          allowed: boolean
          remaining: number
        }[]
      }
      daily_day_snapshot: {
        Args: { at: string; day_id: string; viewer: string }
        Returns: Json
      }
      decline_partner_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      effective_zone: {
        Args: { time_zone: string; utc_offset_minutes: number }
        Returns: string
      }
      find_partner_by_email: {
        Args: { p_email: string }
        Returns: {
          display_name: string
          id: string
          is_taken: boolean
        }[]
      }
      get_daily_day: {
        Args: {
          reported_at: string
          time_zone: string
          utc_offset_minutes: number
        }
        Returns: Json
      }
      get_daily_day_by_id: { Args: { day_id: string }; Returns: Json }
      get_my_partner_id: { Args: Record<PropertyKey, never>; Returns: string }
      get_my_pending_partner_requests: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          from_user_id: string
          id: string
          other_display_name: string
          other_email: string
          to_user_id: string
        }[]
      }
      mark_love_notes_read: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      record_daily_pick: {
        Args: {
          at: string
          choice: string
          day_id: string
          picked_at: string
          time_zone: string
          utc_offset_minutes: number
          viewer: string
        }
        Returns: Json
      }
      record_user_time_zone: {
        Args: {
          at: string
          reported_at: string
          time_zone: string
          utc_offset_minutes: number
          viewer: string
        }
        Returns: undefined
      }
      record_written_question: {
        Args: {
          at: string
          day_id: string
          that_text: string
          this_text: string
          viewer: string
        }
        Returns: Json
      }
      register_push_device: {
        Args: { p_environment: string; p_token: string }
        Returns: undefined
      }
      submit_daily_pick: {
        Args: {
          choice: string
          day_id: string
          picked_at: string
          time_zone: string
          utc_offset_minutes: number
        }
        Returns: Json
      }
      submit_written_question: {
        Args: { day_id: string; that_text: string; this_text: string }
        Returns: Json
      }
      unread_love_note_count: { Args: { p_user_id: string }; Returns: number }
      unregister_all_push_devices: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      unregister_push_device: { Args: { p_token: string }; Returns: undefined }
      visible_daily_picks: {
        Args: { at: string; viewer: string }
        Returns: {
          choice: string
          day_id: string
          picked_at: string
          user_id: string
        }[]
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
