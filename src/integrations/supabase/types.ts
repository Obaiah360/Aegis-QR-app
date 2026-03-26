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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          owner_id: string
          qr_id: string | null
          request_id: string | null
          requester_device: string | null
          requester_ip: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          owner_id: string
          qr_id?: string | null
          request_id?: string | null
          requester_device?: string | null
          requester_ip?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          owner_id?: string
          qr_id?: string | null
          request_id?: string | null
          requester_device?: string | null
          requester_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_qr_id_fkey"
            columns: ["qr_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "access_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      access_requests: {
        Row: {
          access_token: string | null
          approved_document_ids: string[] | null
          signed_document_urls: Json | null
          created_at: string
          expires_at: string | null
          id: string
          owner_id: string
          qr_id: string
          requester_device: string | null
          requester_ip: string | null
          requester_location: string | null
          requester_name: string | null
          requester_purpose: string | null
          status: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          approved_document_ids?: string[] | null
          signed_document_urls?: Json | null
          created_at?: string
          expires_at?: string | null
          id?: string
          owner_id: string
          qr_id: string
          requester_device?: string | null
          requester_ip?: string | null
          requester_location?: string | null
          requester_name?: string | null
          requester_purpose?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          approved_document_ids?: string[] | null
          signed_document_urls?: Json | null
          created_at?: string
          expires_at?: string | null
          id?: string
          owner_id?: string
          qr_id?: string
          requester_device?: string | null
          requester_ip?: string | null
          requester_location?: string | null
          requester_name?: string | null
          requester_purpose?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_qr_id_fkey"
            columns: ["qr_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          ai_classification: string | null
          ai_enhanced: boolean
          ai_extracted_text: string | null
          ai_processing_status: string
          category: string
          created_at: string
          display_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          is_emergency_accessible: boolean
          owner_id: string
        }
        Insert: {
          ai_classification?: string | null
          ai_enhanced?: boolean
          ai_extracted_text?: string | null
          ai_processing_status?: string
          category?: string
          created_at?: string
          display_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          is_emergency_accessible?: boolean
          owner_id: string
        }
        Update: {
          ai_classification?: string | null
          ai_enhanced?: boolean
          ai_extracted_text?: string | null
          ai_processing_status?: string
          category?: string
          created_at?: string
          display_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          is_emergency_accessible?: boolean
          owner_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          emergency_mode_enabled: boolean
          full_name: string | null
          id: string
          two_fa_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          emergency_mode_enabled?: boolean
          full_name?: string | null
          id?: string
          two_fa_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          emergency_mode_enabled?: boolean
          full_name?: string | null
          id?: string
          two_fa_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qr_code_documents: {
        Row: {
          created_at: string
          document_id: string
          id: string
          qr_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          qr_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          qr_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_code_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_code_documents_qr_id_fkey"
            columns: ["qr_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_codes: {
        Row: {
          access_count: number
          created_at: string
          download_enabled: boolean
          id: string
          is_active: boolean
          label: string
          owner_id: string
          profile_type: string
          time_limit_seconds: number
          token: string
          updated_at: string
        }
        Insert: {
          access_count?: number
          created_at?: string
          download_enabled?: boolean
          id?: string
          is_active?: boolean
          label?: string
          owner_id: string
          profile_type?: string
          time_limit_seconds?: number
          token?: string
          updated_at?: string
        }
        Update: {
          access_count?: number
          created_at?: string
          download_enabled?: boolean
          id?: string
          is_active?: boolean
          label?: string
          owner_id?: string
          profile_type?: string
          time_limit_seconds?: number
          token?: string
          updated_at?: string
        }
        Relationships: []
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
