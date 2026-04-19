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
      attendance: {
        Row: {
          absent_count: number
          class_id: string | null
          created_at: string | null
          date: string
          id: string
          notes: string | null
          present_count: number
          reported_by: string | null
          sick_count: number | null
          source: string | null
        }
        Insert: {
          absent_count?: number
          class_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          present_count?: number
          reported_by?: string | null
          sick_count?: number | null
          source?: string | null
        }
        Update: {
          absent_count?: number
          class_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          present_count?: number
          reported_by?: string | null
          sick_count?: number | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          channel: string
          chat_name: string | null
          content: string | null
          created_at: string | null
          id: string
          parsed_data: Json | null
          parsed_intent: string | null
          raw: Json | null
          sender_name: string | null
        }
        Insert: {
          channel: string
          chat_name?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          parsed_data?: Json | null
          parsed_intent?: string | null
          raw?: Json | null
          sender_name?: string | null
        }
        Update: {
          channel?: string
          chat_name?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          parsed_data?: Json | null
          parsed_intent?: string | null
          raw?: Json | null
          sender_name?: string | null
        }
        Relationships: []
      }
      classes: {
        Row: {
          created_at: string | null
          grade: number
          id: string
          letter: string
          name: string
          student_count: number | null
        }
        Insert: {
          created_at?: string | null
          grade: number
          id?: string
          letter: string
          name: string
          student_count?: number | null
        }
        Update: {
          created_at?: string | null
          grade?: number
          id?: string
          letter?: string
          name?: string
          student_count?: number | null
        }
        Relationships: []
      }
      curriculum: {
        Row: {
          class_id: string | null
          hours_per_week: number
          id: string
          subject_id: string | null
        }
        Insert: {
          class_id?: string | null
          hours_per_week?: number
          id?: string
          subject_id?: string | null
        }
        Update: {
          class_id?: string | null
          hours_per_week?: number
          id?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_orders: {
        Row: {
          content_md: string
          created_at: string | null
          created_by: string | null
          id: string
          metadata: Json | null
          status: string | null
          template_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content_md: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          template_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content_md?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_orders_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "order_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          description: string | null
          id: string
          location: string | null
          priority: string | null
          reported_by: string | null
          source: string | null
          source_message: string | null
          status: string | null
          title: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          location?: string | null
          priority?: string | null
          reported_by?: string | null
          source?: string | null
          source_message?: string | null
          status?: string | null
          title: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          location?: string | null
          priority?: string | null
          reported_by?: string | null
          source?: string | null
          source_message?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      nfc_scans: {
        Row: {
          card_id: string
          class_id: string | null
          id: string
          scan_type: string | null
          scanned_at: string | null
          student_name: string
        }
        Insert: {
          card_id: string
          class_id?: string | null
          id?: string
          scan_type?: string | null
          scanned_at?: string | null
          student_name: string
        }
        Update: {
          card_id?: string
          class_id?: string | null
          id?: string
          scan_type?: string | null
          scanned_at?: string | null
          student_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfc_scans_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          payload: Json | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          payload?: Json | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          payload?: Json | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      order_templates: {
        Row: {
          category: string | null
          code: string
          created_at: string | null
          description: string | null
          fields: Json | null
          id: string
          template_md: string
          title: string
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          fields?: Json | null
          id?: string
          template_md: string
          title: string
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          fields?: Json | null
          id?: string
          template_md?: string
          title?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          capacity: number | null
          created_at: string | null
          id: string
          name: string | null
          number: string
          type: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          name?: string | null
          number: string
          type?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          name?: string | null
          number?: string
          type?: string | null
        }
        Relationships: []
      }
      schedule_slots: {
        Row: {
          class_id: string | null
          created_at: string | null
          day_of_week: number
          id: string
          is_substitution: boolean | null
          lenta_group: string | null
          notes: string | null
          original_teacher_id: string | null
          period: number
          room_id: string | null
          subject_id: string | null
          teacher_id: string | null
          week_starting: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          day_of_week: number
          id?: string
          is_substitution?: boolean | null
          lenta_group?: string | null
          notes?: string | null
          original_teacher_id?: string | null
          period: number
          room_id?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          week_starting?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          day_of_week?: number
          id?: string
          is_substitution?: boolean | null
          lenta_group?: string | null
          notes?: string | null
          original_teacher_id?: string | null
          period?: number
          room_id?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          week_starting?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_slots_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_original_teacher_id_fkey"
            columns: ["original_teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          avatar_url: string | null
          constraints: Json | null
          created_at: string | null
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          qualifications: string[] | null
          role: string
          subjects: string[] | null
          telegram_id: string | null
          weekly_hours: number | null
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          constraints?: Json | null
          created_at?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          qualifications?: string[] | null
          role: string
          subjects?: string[] | null
          telegram_id?: string | null
          weekly_hours?: number | null
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          constraints?: Json | null
          created_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          qualifications?: string[] | null
          role?: string
          subjects?: string[] | null
          telegram_id?: string | null
          weekly_hours?: number | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      subjects: {
        Row: {
          color: string | null
          id: string
          is_lenta: boolean | null
          name: string
          short_name: string | null
        }
        Insert: {
          color?: string | null
          id?: string
          is_lenta?: boolean | null
          name: string
          short_name?: string | null
        }
        Update: {
          color?: string | null
          id?: string
          is_lenta?: boolean | null
          name?: string
          short_name?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          source: string | null
          source_message: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          source?: string | null
          source_message?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          source?: string | null
          source_message?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
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
