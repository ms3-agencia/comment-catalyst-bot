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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      addons: {
        Row: {
          billing_type: string
          created_at: string
          credits_cost: number
          description: string | null
          features: string[]
          icon: string | null
          id: string
          is_active: boolean
          name: string
          price_brl: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          billing_type?: string
          created_at?: string
          credits_cost?: number
          description?: string | null
          features?: string[]
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_brl?: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          billing_type?: string
          created_at?: string
          credits_cost?: number
          description?: string | null
          features?: string[]
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_brl?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_providers: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          model: string
          priority: number
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          model: string
          priority?: number
          provider: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          model?: string
          priority?: number
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      audio_library: {
        Row: {
          author: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          is_active: boolean
          kind: string
          license: string | null
          mood: string | null
          preview_url: string | null
          sort_order: number
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          kind?: string
          license?: string | null
          mood?: string | null
          preview_url?: string | null
          sort_order?: number
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          author?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          kind?: string
          license?: string | null
          mood?: string | null
          preview_url?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      branding_settings: {
        Row: {
          context: string
          created_at: string
          footer_text: string | null
          id: string
          logo_url: string | null
          site_name: string
          tagline: string | null
          updated_at: string
        }
        Insert: {
          context: string
          created_at?: string
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          site_name?: string
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          context?: string
          created_at?: string
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          site_name?: string
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author: string | null
          author_avatar: string | null
          content: string
          created_at: string
          id: string
          likes: number | null
          project_id: string
          published_at: string | null
          sentiment: string | null
          video_url: string
        }
        Insert: {
          author?: string | null
          author_avatar?: string | null
          content: string
          created_at?: string
          id?: string
          likes?: number | null
          project_id: string
          published_at?: string | null
          sentiment?: string | null
          video_url: string
        }
        Update: {
          author?: string | null
          author_avatar?: string | null
          content?: string
          created_at?: string
          id?: string
          likes?: number | null
          project_id?: string
          published_at?: string | null
          sentiment?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_action_costs: {
        Row: {
          action_key: string
          cost: number
          created_at: string
          description: string | null
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          action_key: string
          cost?: number
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          action_key?: string
          cost?: number
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_audit_log: {
        Row: {
          actor_email: string | null
          actor_user_id: string | null
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          id: string
          operation: string
          reason: string | null
          target_email: string | null
          target_user_id: string
        }
        Insert: {
          actor_email?: string | null
          actor_user_id?: string | null
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          id?: string
          operation: string
          reason?: string | null
          target_email?: string | null
          target_user_id: string
        }
        Update: {
          actor_email?: string | null
          actor_user_id?: string | null
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          id?: string
          operation?: string
          reason?: string | null
          target_email?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      credit_packages: {
        Row: {
          created_at: string
          credits: number
          features: string[]
          id: string
          is_active: boolean
          name: string
          price_brl: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits: number
          features?: string[]
          id?: string
          is_active?: boolean
          name: string
          price_brl: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          features?: string[]
          id?: string
          is_active?: boolean
          name?: string
          price_brl?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          action_key: string | null
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          action_key?: string | null
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          action_key?: string | null
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      email_broadcasts: {
        Row: {
          audience: string
          audience_filter: Json
          completed_at: string | null
          created_at: string
          created_by: string | null
          failed_count: number
          id: string
          sent_count: number
          status: string
          template_id: string
          total_recipients: number
          variables_override: Json
        }
        Insert: {
          audience?: string
          audience_filter?: Json
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          sent_count?: number
          status?: string
          template_id: string
          total_recipients?: number
          variables_override?: Json
        }
        Update: {
          audience?: string
          audience_filter?: Json
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          sent_count?: number
          status?: string
          template_id?: string
          total_recipients?: number
          variables_override?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_broadcasts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_confirmation_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_rule_runs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          rule_id: string
          run_date: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          rule_id: string
          run_date: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          rule_id?: string
          run_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_rule_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "email_template_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          recipient_email: string
          recipient_user_id: string | null
          status: string
          subject: string | null
          template_key: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_email: string
          recipient_user_id?: string | null
          status?: string
          subject?: string | null
          template_key?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          recipient_user_id?: string | null
          status?: string
          subject?: string | null
          template_key?: string | null
        }
        Relationships: []
      }
      email_template_rules: {
        Row: {
          conditions: Json
          created_at: string
          enabled: boolean
          id: string
          offset_days: number
          send_hour: number
          send_minute: number
          template_id: string
          trigger_event: string
          updated_at: string
        }
        Insert: {
          conditions?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          offset_days?: number
          send_hour?: number
          send_minute?: number
          template_id: string
          trigger_event: string
          updated_at?: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          offset_days?: number
          send_hour?: number
          send_minute?: number
          template_id?: string
          trigger_event?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_template_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          category: string
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          is_system: boolean
          key: string
          name: string
          send_email: boolean
          send_inapp: boolean
          subject: string
          trigger_type: string
          updated_at: string
          variables: string[]
        }
        Insert: {
          body_html: string
          category?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          is_system?: boolean
          key: string
          name: string
          send_email?: boolean
          send_inapp?: boolean
          subject: string
          trigger_type?: string
          updated_at?: string
          variables?: string[]
        }
        Update: {
          body_html?: string
          category?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          send_email?: boolean
          send_inapp?: boolean
          subject?: string
          trigger_type?: string
          updated_at?: string
          variables?: string[]
        }
        Relationships: []
      }
      generated_contents: {
        Row: {
          caption: string | null
          content_type: string
          created_at: string
          cta: string | null
          engagement_score: number | null
          hashtags: string[] | null
          id: string
          image_prompt: string | null
          image_url: string | null
          project_id: string
          script: string | null
          slides: Json
          social_network: string
          title: string | null
          updated_at: string
          user_id: string
          visual_idea: string | null
        }
        Insert: {
          caption?: string | null
          content_type: string
          created_at?: string
          cta?: string | null
          engagement_score?: number | null
          hashtags?: string[] | null
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          project_id: string
          script?: string | null
          slides?: Json
          social_network: string
          title?: string | null
          updated_at?: string
          user_id: string
          visual_idea?: string | null
        }
        Update: {
          caption?: string | null
          content_type?: string
          created_at?: string
          cta?: string | null
          engagement_score?: number | null
          hashtags?: string[] | null
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          project_id?: string
          script?: string | null
          slides?: Json
          social_network?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          visual_idea?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_contents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          action_key: string
          client_key: string
          created_at: string
          expires_at: string
          id: string
          response: Json | null
          user_id: string
        }
        Insert: {
          action_key: string
          client_key: string
          created_at?: string
          expires_at?: string
          id?: string
          response?: Json | null
          user_id: string
        }
        Update: {
          action_key?: string
          client_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          response?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      logo_customizations: {
        Row: {
          apply_on_images: boolean
          apply_on_videos: boolean
          created_at: string
          default_opacity: number
          default_size_percent: number
          id: string
          logo_url: string | null
          positions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          apply_on_images?: boolean
          apply_on_videos?: boolean
          created_at?: string
          default_opacity?: number
          default_size_percent?: number
          id?: string
          logo_url?: string | null
          positions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          apply_on_images?: boolean
          apply_on_videos?: boolean
          created_at?: string
          default_opacity?: number
          default_size_percent?: number
          id?: string
          logo_url?: string | null
          positions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_orders: {
        Row: {
          addon_id: string | null
          amount_brl: number
          created_at: string
          credits: number
          id: string
          order_type: string
          package_id: string | null
          payment_id: string | null
          preference_id: string | null
          raw_payload: Json | null
          status: string
          target_plan: Database["public"]["Enums"]["app_plan"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          addon_id?: string | null
          amount_brl: number
          created_at?: string
          credits: number
          id?: string
          order_type?: string
          package_id?: string | null
          payment_id?: string | null
          preference_id?: string | null
          raw_payload?: Json | null
          status?: string
          target_plan?: Database["public"]["Enums"]["app_plan"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          addon_id?: string | null
          amount_brl?: number
          created_at?: string
          credits?: number
          id?: string
          order_type?: string
          package_id?: string | null
          payment_id?: string | null
          preference_id?: string | null
          raw_payload?: Json | null
          status?: string
          target_plan?: Database["public"]["Enums"]["app_plan"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_orders_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_customizations: {
        Row: {
          accent_color: string | null
          active_template_id: string | null
          brand_name: string | null
          brand_position: string
          cover_image_url: string | null
          cover_subtitle: string | null
          cover_title: string | null
          created_at: string
          custom_fields: Json
          font_family: string | null
          footer_text: string | null
          header_alignment: string
          header_show_date: boolean
          header_text: string | null
          id: string
          logo_alignment: string
          logo_size: number
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          templates: Json
          updated_at: string
          user_id: string
          watermark_opacity: number | null
          watermark_text: string | null
        }
        Insert: {
          accent_color?: string | null
          active_template_id?: string | null
          brand_name?: string | null
          brand_position?: string
          cover_image_url?: string | null
          cover_subtitle?: string | null
          cover_title?: string | null
          created_at?: string
          custom_fields?: Json
          font_family?: string | null
          footer_text?: string | null
          header_alignment?: string
          header_show_date?: boolean
          header_text?: string | null
          id?: string
          logo_alignment?: string
          logo_size?: number
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          templates?: Json
          updated_at?: string
          user_id: string
          watermark_opacity?: number | null
          watermark_text?: string | null
        }
        Update: {
          accent_color?: string | null
          active_template_id?: string | null
          brand_name?: string | null
          brand_position?: string
          cover_image_url?: string | null
          cover_subtitle?: string | null
          cover_title?: string | null
          created_at?: string
          custom_fields?: Json
          font_family?: string | null
          footer_text?: string | null
          header_alignment?: string
          header_show_date?: boolean
          header_text?: string | null
          id?: string
          logo_alignment?: string
          logo_size?: number
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          templates?: Json
          updated_at?: string
          user_id?: string
          watermark_opacity?: number | null
          watermark_text?: string | null
        }
        Relationships: []
      }
      plan_addons: {
        Row: {
          addon_id: string
          created_at: string
          discount_percent: number
          id: string
          included_free: boolean
          plan: Database["public"]["Enums"]["app_plan"]
        }
        Insert: {
          addon_id: string
          created_at?: string
          discount_percent?: number
          id?: string
          included_free?: boolean
          plan: Database["public"]["Enums"]["app_plan"]
        }
        Update: {
          addon_id?: string
          created_at?: string
          discount_percent?: number
          id?: string
          included_free?: boolean
          plan?: Database["public"]["Enums"]["app_plan"]
        }
        Relationships: [
          {
            foreignKeyName: "plan_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_configs: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          features: string[]
          id: string
          max_projects: number | null
          monthly_credits: number
          plan: Database["public"]["Enums"]["app_plan"]
          price_brl: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          features?: string[]
          id?: string
          max_projects?: number | null
          monthly_credits?: number
          plan: Database["public"]["Enums"]["app_plan"]
          price_brl?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          features?: string[]
          id?: string
          max_projects?: number | null
          monthly_credits?: number
          plan?: Database["public"]["Enums"]["app_plan"]
          price_brl?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          plan: Database["public"]["Enums"]["app_plan"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["app_plan"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["app_plan"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          ai_profile: string | null
          created_at: string
          id: string
          name: string
          status: string
          total_comments: number | null
          updated_at: string
          user_id: string
          video_urls: string[]
        }
        Insert: {
          ai_profile?: string | null
          created_at?: string
          id?: string
          name: string
          status?: string
          total_comments?: number | null
          updated_at?: string
          user_id: string
          video_urls?: string[]
        }
        Update: {
          ai_profile?: string | null
          created_at?: string
          id?: string
          name?: string
          status?: string
          total_comments?: number | null
          updated_at?: string
          user_id?: string
          video_urls?: string[]
        }
        Relationships: []
      }
      system_notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          author_name: string
          author_role: string | null
          avatar_url: string | null
          content: string
          created_at: string
          id: string
          is_active: boolean
          is_featured: boolean
          rating: number
          result_metric: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          author_name: string
          author_role?: string | null
          avatar_url?: string | null
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_featured?: boolean
          rating?: number
          result_metric?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          author_name?: string
          author_role?: string | null
          avatar_url?: string | null
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_featured?: boolean
          rating?: number
          result_metric?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_addons: {
        Row: {
          activated_at: string
          addon_id: string
          billing_type: string
          created_at: string
          expires_at: string | null
          id: string
          payment_method: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string
          addon_id: string
          billing_type: string
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_method?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string
          addon_id?: string
          billing_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_method?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credits: {
        Row: {
          balance: number
          created_at: string
          id: string
          monthly_allocation: number
          monthly_reset_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          monthly_allocation?: number
          monthly_reset_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          monthly_allocation?: number
          monthly_reset_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_session_logs: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          login_at: string
          logout_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          login_at?: string
          logout_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          login_at?: string
          logout_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      video_editor_draft_versions: {
        Row: {
          content_id: string
          created_at: string
          id: string
          label: string | null
          state: Json
          user_id: string
          version: number
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          label?: string | null
          state?: Json
          user_id: string
          version?: number
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          label?: string | null
          state?: Json
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      video_editor_drafts: {
        Row: {
          content_id: string
          created_at: string
          id: string
          state: Json
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          state?: Json
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          state?: Json
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      video_providers: {
        Row: {
          api_key_secret_name: string | null
          config: Json
          created_at: string
          display_name: string
          enabled: boolean
          id: string
          kind: string
          model: string | null
          provider: string
          updated_at: string
          weight: number
        }
        Insert: {
          api_key_secret_name?: string | null
          config?: Json
          created_at?: string
          display_name: string
          enabled?: boolean
          id?: string
          kind: string
          model?: string | null
          provider: string
          updated_at?: string
          weight?: number
        }
        Update: {
          api_key_secret_name?: string | null
          config?: Json
          created_at?: string
          display_name?: string
          enabled?: boolean
          id?: string
          kind?: string
          model?: string | null
          provider?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      video_render_history: {
        Row: {
          bitrate_kbps: number
          codec: string
          container: string
          content_id: string | null
          created_at: string
          credits_spent: number
          duration_seconds: number
          file_size_bytes: number | null
          format_ratio: string
          height: number
          id: string
          message: string | null
          phase: string | null
          preset_name: string | null
          progress: number
          scenes_count: number
          status: string
          updated_at: string
          user_id: string
          width: number
        }
        Insert: {
          bitrate_kbps: number
          codec: string
          container: string
          content_id?: string | null
          created_at?: string
          credits_spent?: number
          duration_seconds?: number
          file_size_bytes?: number | null
          format_ratio: string
          height: number
          id?: string
          message?: string | null
          phase?: string | null
          preset_name?: string | null
          progress?: number
          scenes_count?: number
          status?: string
          updated_at?: string
          user_id: string
          width: number
        }
        Update: {
          bitrate_kbps?: number
          codec?: string
          container?: string
          content_id?: string | null
          created_at?: string
          credits_spent?: number
          duration_seconds?: number
          file_size_bytes?: number | null
          format_ratio?: string
          height?: number
          id?: string
          message?: string | null
          phase?: string | null
          preset_name?: string | null
          progress?: number
          scenes_count?: number
          status?: string
          updated_at?: string
          user_id?: string
          width?: number
        }
        Relationships: []
      }
      video_style_presets: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_addon_with_credits: {
        Args: { _addon_id: string }
        Returns: Json
      }
      admin_add_credits: {
        Args: { _amount: number; _description?: string; _user_id: string }
        Returns: Json
      }
      admin_delete_user: { Args: { _user_id: string }; Returns: undefined }
      admin_run_draft_cleanup: { Args: never; Returns: Json }
      admin_update_user_email: {
        Args: { _new_email: string; _user_id: string }
        Returns: undefined
      }
      admin_update_user_password: {
        Args: { _new_password: string; _user_id: string }
        Returns: undefined
      }
      check_action_affordable: { Args: { _action_key: string }; Returns: Json }
      cleanup_video_editor_drafts: { Args: never; Returns: Json }
      consume_credits: {
        Args: {
          _action_key: string
          _amount: number
          _description?: string
          _reference_id?: string
        }
        Returns: Json
      }
      get_user_plan_usage: { Args: { _user_id?: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_has_addon: {
        Args: { _addon_slug: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_plan: "free" | "pro" | "enterprise"
      app_role: "admin" | "user"
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
      app_plan: ["free", "pro", "enterprise"],
      app_role: ["admin", "user"],
    },
  },
} as const
