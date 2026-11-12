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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      about_paragraphs: {
        Row: {
          about_section_id: string
          active: boolean
          body: string
          created_at: string
          id: string
          order_index: number
          updated_at: string
        }
        Insert: {
          about_section_id: string
          active?: boolean
          body: string
          created_at?: string
          id: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          about_section_id?: string
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "about_paragraphs_about_section_id_fkey"
            columns: ["about_section_id"]
            isOneToOne: false
            referencedRelation: "about_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      about_sections: {
        Row: {
          active: boolean
          created_at: string
          cta_id: string | null
          cta_target_section_id: string | null
          cta_text: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cta_id?: string | null
          cta_target_section_id?: string | null
          cta_text?: string | null
          id: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cta_id?: string | null
          cta_target_section_id?: string | null
          cta_text?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_memberships: {
        Row: {
          created_at: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      certificate_images: {
        Row: {
          certificate_id: string
          created_at: string
          id: string
          media_asset_id: string | null
          object_position: string
          order_index: number
          placeholder_config: Json
          role: string
          updated_at: string
        }
        Insert: {
          certificate_id: string
          created_at?: string
          id: string
          media_asset_id?: string | null
          object_position?: string
          order_index?: number
          placeholder_config?: Json
          role: string
          updated_at?: string
        }
        Update: {
          certificate_id?: string
          created_at?: string
          id?: string
          media_asset_id?: string | null
          object_position?: string
          order_index?: number
          placeholder_config?: Json
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_images_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_images_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_sections: {
        Row: {
          active: boolean
          autoplay: boolean
          created_at: string
          id: string
          slideshow_interval_ms: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          autoplay?: boolean
          created_at?: string
          id: string
          slideshow_interval_ms?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          autoplay?: boolean
          created_at?: string
          id?: string
          slideshow_interval_ms?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          active: boolean
          created_at: string
          date: string
          description: string
          id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          date: string
          description: string
          id: string
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          date?: string
          description?: string
          id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      college_entries: {
        Row: {
          active: boolean
          created_at: string
          description: string
          frame_back_id: string
          frame_front_id: string
          id: string
          label: string
          order_index: number
          period: string
          school: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description: string
          frame_back_id: string
          frame_front_id: string
          id: string
          label: string
          order_index?: number
          period: string
          school: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          frame_back_id?: string
          frame_front_id?: string
          id?: string
          label?: string
          order_index?: number
          period?: string
          school?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_profiles: {
        Row: {
          active: boolean
          created_at: string
          cta_href: string | null
          cta_id: string | null
          cta_text: string | null
          cv_href: string
          id: string
          line1: string
          line2: string
          linkedin_href: string
          person_media_usage_id: string | null
          social_links_updated_at: string | null
          updated_at: string
          whatsapp_href: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cta_href?: string | null
          cta_id?: string | null
          cta_text?: string | null
          cv_href?: string
          id: string
          line1: string
          line2: string
          linkedin_href?: string
          person_media_usage_id?: string | null
          social_links_updated_at?: string | null
          updated_at?: string
          whatsapp_href?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cta_href?: string | null
          cta_id?: string | null
          cta_text?: string | null
          cv_href?: string
          id?: string
          line1?: string
          line2?: string
          linkedin_href?: string
          person_media_usage_id?: string | null
          social_links_updated_at?: string | null
          updated_at?: string
          whatsapp_href?: string
        }
        Relationships: []
      }
      design_system_workspaces: {
        Row: {
          created_at: string
          updated_at: string
          user_id: string
          workspace: Json
        }
        Insert: {
          created_at?: string
          updated_at?: string
          user_id?: string
          workspace: Json
        }
        Update: {
          created_at?: string
          updated_at?: string
          user_id?: string
          workspace?: Json
        }
        Relationships: []
      }
      editor_favorites: {
        Row: {
          created_at: string
          id: string
          revision_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          revision_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          revision_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "editor_favorites_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "site_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      education_sections: {
        Row: {
          active: boolean
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      entity_media: {
        Row: {
          created_at: string
          id: string
          media_asset_id: string
          object_position: string
          owner_id: string
          owner_type: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          media_asset_id: string
          object_position?: string
          owner_id: string
          owner_type: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          media_asset_id?: string
          object_position?: string
          owner_id?: string
          owner_type?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_media_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_visual_configs: {
        Row: {
          config: Json
          created_at: string
          entity_id: string
          entity_type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          entity_id: string
          entity_type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          entity_id?: string
          entity_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      experiences: {
        Row: {
          active: boolean
          created_at: string
          date: string
          description: string
          frame_id: string
          id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          date: string
          description: string
          frame_id: string
          id: string
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          date?: string
          description?: string
          frame_id?: string
          id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          alt_text: string
          created_at: string
          file_size: number | null
          height: number | null
          id: string
          mime_type: string
          source_url: string | null
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          alt_text?: string
          created_at?: string
          file_size?: number | null
          height?: number | null
          id: string
          mime_type?: string
          source_url?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt_text?: string
          created_at?: string
          file_size?: number | null
          height?: number | null
          id?: string
          mime_type?: string
          source_url?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          email: string | null
          expires_at: string | null
          id: string
          ip_hash: string
          is_saved: boolean
          message: string
          name: string
          read_at: string | null
          status: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          ip_hash: string
          is_saved?: boolean
          message: string
          name: string
          read_at?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          ip_hash?: string
          is_saved?: boolean
          message?: string
          name?: string
          read_at?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      navigation_config: {
        Row: {
          brand: string
          created_at: string
          id: string
          sections: Json
          updated_at: string
        }
        Insert: {
          brand: string
          created_at?: string
          id: string
          sections?: Json
          updated_at?: string
        }
        Update: {
          brand?: string
          created_at?: string
          id?: string
          sections?: Json
          updated_at?: string
        }
        Relationships: []
      }
      navigation_items: {
        Row: {
          created_at: string
          id: string
          item_key: string
          label: string
          offset_mode: string
          offset_value: number
          order_index: number
          target_section_id: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          id: string
          item_key: string
          label: string
          offset_mode: string
          offset_value?: number
          order_index?: number
          target_section_id: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          item_key?: string
          label?: string
          offset_mode?: string
          offset_value?: number
          order_index?: number
          target_section_id?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      photo_frames: {
        Row: {
          created_at: string
          id: string
          label: string
          media_asset_id: string | null
          object_position: string
          owner_id: string
          owner_type: string
          placeholder_config: Json
          role: string
          section: string
          updated_at: string
          visual_config: Json
        }
        Insert: {
          created_at?: string
          id: string
          label?: string
          media_asset_id?: string | null
          object_position?: string
          owner_id: string
          owner_type: string
          placeholder_config?: Json
          role: string
          section?: string
          updated_at?: string
          visual_config?: Json
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          media_asset_id?: string | null
          object_position?: string
          owner_id?: string
          owner_type?: string
          placeholder_config?: Json
          role?: string
          section?: string
          updated_at?: string
          visual_config?: Json
        }
        Relationships: [
          {
            foreignKeyName: "photo_frames_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_profile: {
        Row: {
          active: boolean
          created_at: string
          id: string
          media_usage_id: string | null
          name: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id: string
          media_usage_id?: string | null
          name: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          media_usage_id?: string | null
          name?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      shs_entries: {
        Row: {
          active: boolean
          created_at: string
          description: string
          frame_back_id: string
          frame_front_id: string
          id: string
          label: string
          order_index: number
          period: string
          school: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description: string
          frame_back_id: string
          frame_front_id: string
          id: string
          label: string
          order_index?: number
          period: string
          school: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          frame_back_id?: string
          frame_front_id?: string
          id?: string
          label?: string
          order_index?: number
          period?: string
          school?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_revisions: {
        Row: {
          base_revision_number: number | null
          created_at: string
          created_by: string
          id: string
          lock_version: number
          publication_kind: string | null
          publish_note: string | null
          published_at: string | null
          published_by: string | null
          revision_number: number
          rollback_source_revision_id: string | null
          snapshot: Json
          source_draft_revision_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          base_revision_number?: number | null
          created_at?: string
          created_by: string
          id?: string
          lock_version?: number
          publication_kind?: string | null
          publish_note?: string | null
          published_at?: string | null
          published_by?: string | null
          revision_number: number
          rollback_source_revision_id?: string | null
          snapshot: Json
          source_draft_revision_id?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          base_revision_number?: number | null
          created_at?: string
          created_by?: string
          id?: string
          lock_version?: number
          publication_kind?: string | null
          publish_note?: string | null
          published_at?: string | null
          published_by?: string | null
          revision_number?: number
          rollback_source_revision_id?: string | null
          snapshot?: Json
          source_draft_revision_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_revisions_rollback_source_revision_id_fkey"
            columns: ["rollback_source_revision_id"]
            isOneToOne: false
            referencedRelation: "site_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_revisions_source_draft_revision_id_fkey"
            columns: ["source_draft_revision_id"]
            isOneToOne: false
            referencedRelation: "site_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_editor_favorite: {
        Args: { p_revision_id: string }
        Returns: {
          created_at: string
          id: string
          revision_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "editor_favorites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bootstrap_first_admin: { Args: never; Returns: boolean }
      discard_editor_draft: { Args: { p_draft_id: string }; Returns: undefined }
      get_active_published_snapshot: {
        Args: never
        Returns: {
          base_revision_number: number | null
          created_at: string
          created_by: string
          id: string
          lock_version: number
          publication_kind: string | null
          publish_note: string | null
          published_at: string | null
          published_by: string | null
          revision_number: number
          rollback_source_revision_id: string | null
          snapshot: Json
          source_draft_revision_id: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "site_revisions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_referenced_storage_paths: { Args: never; Returns: string[] }
      publish_editor_draft: {
        Args: {
          p_draft_id: string
          p_expected_draft_lock_version: number
          p_expected_published_revision: number
          p_note?: string
          p_prepared_snapshot: Json
        }
        Returns: {
          base_revision_number: number | null
          created_at: string
          created_by: string
          id: string
          lock_version: number
          publication_kind: string | null
          publish_note: string | null
          published_at: string | null
          published_by: string | null
          revision_number: number
          rollback_source_revision_id: string | null
          snapshot: Json
          source_draft_revision_id: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "site_revisions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      remove_editor_favorite: {
        Args: { p_revision_id: string }
        Returns: undefined
      }
      reset_site_to_default: { Args: never; Returns: undefined }
      rollback_published_revision: {
        Args: {
          p_expected_published_revision: number
          p_note?: string
          p_target_revision_id: string
        }
        Returns: {
          base_revision_number: number | null
          created_at: string
          created_by: string
          id: string
          lock_version: number
          publication_kind: string | null
          publish_note: string | null
          published_at: string | null
          published_by: string | null
          revision_number: number
          rollback_source_revision_id: string | null
          snapshot: Json
          source_draft_revision_id: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "site_revisions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      save_editor_draft: {
        Args: {
          p_create_new?: boolean
          p_draft_id: string
          p_expected_base_revision: number
          p_expected_lock_version?: number
          p_snapshot: Json
        }
        Returns: {
          base_revision_number: number | null
          created_at: string
          created_by: string
          id: string
          lock_version: number
          publication_kind: string | null
          publish_note: string | null
          published_at: string | null
          published_by: string | null
          revision_number: number
          rollback_source_revision_id: string | null
          snapshot: Json
          source_draft_revision_id: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "site_revisions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      test_reset: { Args: never; Returns: string }
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
