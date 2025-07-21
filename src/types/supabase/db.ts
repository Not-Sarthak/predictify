export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
    // Allows to automatically instanciate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: "12.2.3 (519615d)";
    };
    public: {
        Tables: {
            Copy_Wallets: {
                Row: {
                    created_at: string;
                    id: string;
                    is_enabled: boolean;
                    percent_ratio: number;
                    user_id: number;
                    wallet_address: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    is_enabled?: boolean;
                    percent_ratio?: number;
                    user_id: number;
                    wallet_address: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    is_enabled?: boolean;
                    percent_ratio?: number;
                    user_id?: number;
                    wallet_address?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "Copy_Wallets_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "Users";
                        referencedColumns: ["id"];
                    },
                ];
            };
            Users: {
                Row: {
                    amount_deposited: number;
                    api_credentials: string;
                    config_type: string | null;
                    config_value: string | null;
                    created_at: string;
                    fees_total: number;
                    id: number;
                    is_copytrading_enabled: boolean;
                    locked_balance: number;
                    number_of_referrals: number | null;
                    private_key: string;
                    referral_code: string | null;
                    referred_code: string | null;
                    solana_address: string | null;
                    solana_private_key: string | null;
                    telegram_username: string;
                    total_balance: number | null;
                    total_pnl: number;
                    total_volume: number;
                    treasury_wallet_address: string | null;
                    wallet_address: string;
                };
                Insert: {
                    amount_deposited?: number;
                    api_credentials: string;
                    config_type?: string | null;
                    config_value?: string | null;
                    created_at?: string;
                    fees_total?: number;
                    id: number;
                    is_copytrading_enabled?: boolean;
                    locked_balance?: number;
                    number_of_referrals?: number | null;
                    private_key: string;
                    referral_code?: string | null;
                    referred_code?: string | null;
                    solana_address?: string | null;
                    solana_private_key?: string | null;
                    telegram_username: string;
                    total_balance?: number | null;
                    total_pnl?: number;
                    total_volume?: number;
                    treasury_wallet_address?: string | null;
                    wallet_address: string;
                };
                Update: {
                    amount_deposited?: number;
                    api_credentials?: string;
                    config_type?: string | null;
                    config_value?: string | null;
                    created_at?: string;
                    fees_total?: number;
                    id?: number;
                    is_copytrading_enabled?: boolean;
                    locked_balance?: number;
                    number_of_referrals?: number | null;
                    private_key?: string;
                    referral_code?: string | null;
                    referred_code?: string | null;
                    solana_address?: string | null;
                    solana_private_key?: string | null;
                    telegram_username?: string;
                    total_balance?: number | null;
                    total_pnl?: number;
                    total_volume?: number;
                    treasury_wallet_address?: string | null;
                    wallet_address?: string;
                };
                Relationships: [];
            };
            wallet_subscriptions: {
                Row: {
                    created_at: string;
                    is_active: boolean;
                    user_id: number;
                    wallet_address: string;
                };
                Insert: {
                    created_at?: string;
                    is_active?: boolean;
                    user_id: number;
                    wallet_address: string;
                };
                Update: {
                    created_at?: string;
                    is_active?: boolean;
                    user_id?: number;
                    wallet_address?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "wallet_subscriptions_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: true;
                        referencedRelation: "Users";
                        referencedColumns: ["id"];
                    },
                ];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
          DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
          Row: infer R;
      }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
            DefaultSchema["Views"])
      ? (DefaultSchema["Tables"] &
            DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R;
        }
          ? R
          : never
      : never;

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema["Tables"]
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
          Insert: infer I;
      }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
      ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
            Insert: infer I;
        }
          ? I
          : never
      : never;

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema["Tables"]
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
          Update: infer U;
      }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
      ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
            Update: infer U;
        }
          ? U
          : never
      : never;

export type Enums<
    DefaultSchemaEnumNameOrOptions extends
        | keyof DefaultSchema["Enums"]
        | { schema: keyof DatabaseWithoutInternals },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
        : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
      ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
      : never;

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema["CompositeTypes"]
        | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
        : never = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
      ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
      : never;

export const Constants = {
    public: {
        Enums: {},
    },
} as const;
