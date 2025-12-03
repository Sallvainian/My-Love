/**
 * Database Types - Generated from Supabase Schema
 *
 * This file contains type definitions for the Supabase database schema.
 * Types are structured to work with @supabase/supabase-js v2.x
 *
 * UPDATED: 2025-11-16 - Added partner_requests table and partner_id column
 * UPDATED: 2025-11-25 - Added photos table for Photo Gallery (Epic 6, Story 6.0)
 * UPDATED: 2025-11-30 - Added love_notes table for Love Notes (Epic 2, Story 2.0)
 * UPDATED: 2025-12-03 - Added mood_types TEXT[] column for multi-mood selection (migration 006)
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          partner_id: string | null;
          partner_name: string | null;
          device_id: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          partner_id?: string | null;
          partner_name?: string | null;
          device_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          partner_id?: string | null;
          partner_name?: string | null;
          device_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'users_partner_id_fkey';
            columns: ['partner_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      moods: {
        Row: {
          id: string;
          user_id: string;
          mood_type:
            | 'loved'
            | 'happy'
            | 'content'
            | 'thoughtful'
            | 'grateful'
            | 'sad'
            | 'anxious'
            | 'frustrated'
            | 'lonely'
            | 'tired';
          mood_types: string[] | null; // Multi-mood selection array (migration 006)
          note: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          mood_type:
            | 'loved'
            | 'happy'
            | 'content'
            | 'thoughtful'
            | 'grateful'
            | 'sad'
            | 'anxious'
            | 'frustrated'
            | 'lonely'
            | 'tired';
          mood_types?: string[] | null; // Multi-mood selection array (migration 006)
          note?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          mood_type?:
            | 'loved'
            | 'happy'
            | 'content'
            | 'thoughtful'
            | 'grateful'
            | 'sad'
            | 'anxious'
            | 'frustrated'
            | 'lonely'
            | 'tired';
          mood_types?: string[] | null; // Multi-mood selection array (migration 006)
          note?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'moods_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      interactions: {
        Row: {
          id: string;
          type: 'poke' | 'kiss';
          from_user_id: string;
          to_user_id: string;
          viewed: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          type: 'poke' | 'kiss';
          from_user_id: string;
          to_user_id: string;
          viewed?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          type?: 'poke' | 'kiss';
          from_user_id?: string;
          to_user_id?: string;
          viewed?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'interactions_from_user_id_fkey';
            columns: ['from_user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'interactions_to_user_id_fkey';
            columns: ['to_user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      partner_requests: {
        Row: {
          id: string;
          from_user_id: string;
          to_user_id: string;
          status: 'pending' | 'accepted' | 'declined';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          from_user_id: string;
          to_user_id: string;
          status?: 'pending' | 'accepted' | 'declined';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          from_user_id?: string;
          to_user_id?: string;
          status?: 'pending' | 'accepted' | 'declined';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'partner_requests_from_user_id_fkey';
            columns: ['from_user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'partner_requests_to_user_id_fkey';
            columns: ['to_user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      photos: {
        Row: {
          id: string;
          user_id: string;
          storage_path: string;
          filename: string;
          caption: string | null;
          mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
          file_size: number;
          width: number;
          height: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          storage_path: string;
          filename: string;
          caption?: string | null;
          mime_type?: 'image/jpeg' | 'image/png' | 'image/webp';
          file_size: number;
          width: number;
          height: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          storage_path?: string;
          filename?: string;
          caption?: string | null;
          mime_type?: 'image/jpeg' | 'image/png' | 'image/webp';
          file_size?: number;
          width?: number;
          height?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'photos_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      love_notes: {
        Row: {
          id: string;
          from_user_id: string;
          to_user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          from_user_id: string;
          to_user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          from_user_id?: string;
          to_user_id?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'love_notes_from_user_id_fkey';
            columns: ['from_user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'love_notes_to_user_id_fkey';
            columns: ['to_user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_partner_request: {
        Args: { p_request_id: string };
        Returns: undefined;
      };
      decline_partner_request: {
        Args: { p_request_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
