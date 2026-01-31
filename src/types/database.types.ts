Connecting to db 5432
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
      love_notes: {
        Row: {
          content: string
          created_at: string
          from_user_id: string
          id: string
          image_url: string | null
          to_user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          from_user_id: string
          id?: string
          image_url?: string | null
          to_user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          from_user_id?: string
          id?: string
          image_url?: string | null
          to_user_id?: string
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
      scripture_bookmarks: {
        Row: {
          created_at: string
          id: string
          session_id: string
          share_with_partner: boolean
          step_index: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          share_with_partner?: boolean
          step_index: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          share_with_partner?: boolean
          step_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scripture_bookmarks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scripture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      scripture_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scripture_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scripture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      scripture_reflections: {
        Row: {
          created_at: string
          id: string
          is_shared: boolean
          notes: string | null
          rating: number | null
          session_id: string
          step_index: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_shared?: boolean
          notes?: string | null
          rating?: number | null
          session_id: string
          step_index: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_shared?: boolean
          notes?: string | null
          rating?: number | null
          session_id?: string
          step_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scripture_reflections_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scripture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      scripture_sessions: {
        Row: {
          completed_at: string | null
          current_phase: Database["public"]["Enums"]["scripture_session_phase"]
          current_step_index: number
          id: string
          mode: Database["public"]["Enums"]["scripture_session_mode"]
          snapshot_json: Json | null
          started_at: string
          status: Database["public"]["Enums"]["scripture_session_status"]
          user1_id: string
          user2_id: string | null
          version: number
        }
        Insert: {
          completed_at?: string | null
          current_phase?: Database["public"]["Enums"]["scripture_session_phase"]
          current_step_index?: number
          id?: string
          mode: Database["public"]["Enums"]["scripture_session_mode"]
          snapshot_json?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["scripture_session_status"]
          user1_id: string
          user2_id?: string | null
          version?: number
        }
        Update: {
          completed_at?: string | null
          current_phase?: Database["public"]["Enums"]["scripture_session_phase"]
          current_step_index?: number
          id?: string
          mode?: Database["public"]["Enums"]["scripture_session_mode"]
          snapshot_json?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["scripture_session_status"]
          user1_id?: string
          user2_id?: string | null
          version?: number
        }
        Relationships: []
      }
      scripture_step_states: {
        Row: {
          advanced_at: string | null
          id: string
          session_id: string
          step_index: number
          user1_locked_at: string | null
          user2_locked_at: string | null
        }
        Insert: {
          advanced_at?: string | null
          id?: string
          session_id: string
          step_index: number
          user1_locked_at?: string | null
          user2_locked_at?: string | null
        }
        Update: {
          advanced_at?: string | null
          id?: string
          session_id?: string
          step_index?: number
          user1_locked_at?: string | null
          user2_locked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scripture_step_states_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scripture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
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
      [_ in never]: never
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
      is_scripture_session_member: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      scripture_create_session: {
        Args: { p_mode: string; p_partner_id?: string }
        Returns: Json
      }
      scripture_seed_test_data: {
        Args: {
          p_include_messages?: boolean
          p_include_reflections?: boolean
          p_preset?: string
          p_session_count?: number
        }
        Returns: Json
      }
      scripture_submit_reflection: {
        Args: {
          p_is_shared: boolean
          p_notes: string
          p_rating: number
          p_session_id: string
          p_step_index: number
        }
        Returns: Json
      }
    }
    Enums: {
      scripture_session_mode: "solo" | "together"
      scripture_session_phase:
        | "lobby"
        | "countdown"
        | "reading"
        | "reflection"
        | "report"
        | "complete"
      scripture_session_status:
        | "pending"
        | "in_progress"
        | "complete"
        | "abandoned"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      scripture_session_mode: ["solo", "together"],
      scripture_session_phase: [
        "lobby",
        "countdown",
        "reading",
        "reflection",
        "report",
        "complete",
      ],
      scripture_session_status: [
        "pending",
        "in_progress",
        "complete",
        "abandoned",
      ],
    },
  },
} as const

