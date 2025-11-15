/**
 * Database Types - Generated from Supabase Schema
 *
 * This file contains type definitions for the Supabase database schema.
 * Types are structured to work with @supabase/supabase-js v2.x
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          partner_name: string | null
          device_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          partner_name?: string | null
          device_id?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          partner_name?: string | null
          device_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      moods: {
        Row: {
          id: string
          user_id: string
          mood_type: 'loved' | 'happy' | 'content' | 'thoughtful' | 'grateful'
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          mood_type: 'loved' | 'happy' | 'content' | 'thoughtful' | 'grateful'
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          mood_type?: 'loved' | 'happy' | 'content' | 'thoughtful' | 'grateful'
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moods_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      interactions: {
        Row: {
          id: string
          type: 'poke' | 'kiss'
          from_user_id: string
          to_user_id: string
          viewed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          type: 'poke' | 'kiss'
          from_user_id: string
          to_user_id: string
          viewed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          type?: 'poke' | 'kiss'
          from_user_id?: string
          to_user_id?: string
          viewed?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_from_user_id_fkey"
            columns: ["from_user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_to_user_id_fkey"
            columns: ["to_user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
