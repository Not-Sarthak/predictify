export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: "12.2.3 (519615d)";
    };
    public: {
        Tables: {
            Auto_Trade: {
                Row: {
                    copied_price: number | null;
                    copied_size: number | null;
                    copied_trade_hash: string | null;
                    created_at: string;
                    error_message: string | null;
                    executed_at: string | null;
                    id: string;
                    market_id: string;
                    market_title: string;
                    original_price: number;
                    original_size: number;
                    original_timestamp: string;
                    original_trade_hash: string;
                    outcome: string;
                    position_percentage: number;
                    side: string;
                    status: string;
                    user_id: number;
                    watched_wallet: string;
                };
                Insert: {
                    copied_price?: number | null;
                    copied_size?: number | null;
                    copied_trade_hash?: string | null;
                    created_at?: string;
                    error_message?: string | null;
                    executed_at?: string | null;
                    id?: string;
                    market_id: string;
                    market_title: string;
                    original_price: number;
                    original_size: number;
                    original_timestamp: string;
                    original_trade_hash: string;
                    outcome: string;
                    position_percentage: number;
                    side: string;
                    status?: string;
                    user_id: number;
                    watched_wallet: string;
                };
                Update: {
                    copied_price?: number | null;
                    copied_size?: number | null;
                    copied_trade_hash?: string | null;
                    created_at?: string;
                    error_message?: string | null;
                    executed_at?: string | null;
                    id?: string;
                    market_id?: string;
                    market_title?: string;
                    original_price?: number;
                    original_size?: number;
                    original_timestamp?: string;
                    original_trade_hash?: string;
                    outcome?: string;
                    position_percentage?: number;
                    side?: string;
                    status?: string;
                    user_id?: number;
                    watched_wallet?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "Auto_Trade_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "Users";
                        referencedColumns: ["id"];
                    },
                ];
            };
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
            Monthly_Active_Users: {
                Row: {
                    created_at: string | null;
                    id: string;
                    month_number: number;
                    month_start: string;
                    transaction_count: number | null;
                    user_id: number;
                    year: number;
                };
                Insert: {
                    created_at?: string | null;
                    id?: string;
                    month_number: number;
                    month_start: string;
                    transaction_count?: number | null;
                    user_id: number;
                    year: number;
                };
                Update: {
                    created_at?: string | null;
                    id?: string;
                    month_number?: number;
                    month_start?: string;
                    transaction_count?: number | null;
                    user_id?: number;
                    year?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: "Monthly_Active_Users_user_id_fkey";
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
                    market_watchlist: Json | null;
                    markets_traded: number;
                    number_of_referrals: number | null;
                    private_key: string;
                    referral_code: string | null;
                    referred_code: string | null;
                    show_username_in_cards: boolean;
                    solana_address: string;
                    solana_private_key: string;
                    telegram_username: string;
                    total_pnl: number;
                    total_volume: number;
                    treasury_wallet_address: string | null;
                    txns_executed: number;
                    wallet_address: string;
                    watched_wallets: string[] | null;
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
                    market_watchlist?: Json | null;
                    markets_traded?: number;
                    number_of_referrals?: number | null;
                    private_key: string;
                    referral_code?: string | null;
                    referred_code?: string | null;
                    show_username_in_cards?: boolean;
                    solana_address?: string;
                    solana_private_key?: string;
                    telegram_username: string;
                    total_pnl?: number;
                    total_volume?: number;
                    treasury_wallet_address?: string | null;
                    txns_executed?: number;
                    wallet_address: string;
                    watched_wallets?: string[] | null;
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
                    market_watchlist?: Json | null;
                    markets_traded?: number;
                    number_of_referrals?: number | null;
                    private_key?: string;
                    referral_code?: string | null;
                    referred_code?: string | null;
                    show_username_in_cards?: boolean;
                    solana_address?: string;
                    solana_private_key?: string;
                    telegram_username?: string;
                    total_pnl?: number;
                    total_volume?: number;
                    treasury_wallet_address?: string | null;
                    txns_executed?: number;
                    wallet_address?: string;
                    watched_wallets?: string[] | null;
                };
                Relationships: [];
            };
            Weekly_Active_Users: {
                Row: {
                    created_at: string | null;
                    id: string;
                    transaction_count: number | null;
                    user_id: number;
                    week_number: number;
                    week_start: string;
                    year: number;
                };
                Insert: {
                    created_at?: string | null;
                    id?: string;
                    transaction_count?: number | null;
                    user_id: number;
                    week_number: number;
                    week_start: string;
                    year: number;
                };
                Update: {
                    created_at?: string | null;
                    id?: string;
                    transaction_count?: number | null;
                    user_id?: number;
                    week_number?: number;
                    week_start?: string;
                    year?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: "Weekly_Active_Users_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
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
            increment_user_stats: {
                Args: {
                    p_user_id: number;
                    p_amount_deposited?: number;
                    p_fees_total?: number;
                    p_markets_traded?: number;
                    p_txns_executed?: number;
                    p_total_volume?: number;
                    p_total_pnl?: number;
                    p_number_of_referrals?: number;
                };
                Returns: undefined;
            };
            record_user_activity: {
                Args: {
                    p_user_id: number;
                    p_year: number;
                    p_week_number: number;
                    p_week_start: string;
                    p_month_number: number;
                    p_month_start: string;
                };
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
