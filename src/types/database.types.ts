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
      couple_settings: {
        Row: {
          relationship_start: string | null
          updated_at: string
          user_a: string
          user_b: string
          wedding_date: string | null
        }
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
      message_favorites: {
        Row: {
          created_at: string
          message_key: string
          user_id: string
        }
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
          content: string | null
          created_at: string | null
          from_user_id: string | null
          id: string | null
          idempotency_key: string | null
          image_url: string | null
          to_user_id: string | null
          written_at: string | null
        }
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
      decline_partner_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      get_my_partner_id: { Args: never; Returns: string }
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

