export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
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
                    wallet_name: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    is_enabled?: boolean;
                    percent_ratio?: number;
                    user_id: number;
                    wallet_address: string;
                    wallet_name: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    is_enabled?: boolean;
                    percent_ratio?: number;
                    user_id?: number;
                    wallet_address?: string;
                    wallet_name?: string;
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
            Positions: {
                Row: {
                    amount: number;
                    buys: string[];
                    created_at: string;
                    description: string;
                    fees: number;
                    id: number;
                    is_open: boolean;
                    market: string;
                    market_slug: string;
                    pnl_all: number;
                    pnl_individual: number;
                    question: string;
                    sells: string[];
                    token_id: string;
                    wallet_address: string;
                };
                Insert: {
                    amount: number;
                    buys: string[];
                    created_at?: string;
                    description: string;
                    fees?: number;
                    id: number;
                    is_open?: boolean;
                    market: string;
                    market_slug: string;
                    pnl_all: number;
                    pnl_individual: number;
                    question: string;
                    sells: string[];
                    token_id: string;
                    wallet_address: string;
                };
                Update: {
                    amount?: number;
                    buys?: string[];
                    created_at?: string;
                    description?: string;
                    fees?: number;
                    id?: number;
                    is_open?: boolean;
                    market?: string;
                    market_slug?: string;
                    pnl_all?: number;
                    pnl_individual?: number;
                    question?: string;
                    sells?: string[];
                    token_id?: string;
                    wallet_address?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "Positions_id_fkey";
                        columns: ["id"];
                        isOneToOne: true;
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
                    private_key: string;
                    solana_address: string | null;
                    solana_private_key: string | null;
                    telegram_username: string;
                    total_balance: number | null;
                    total_pnl: number;
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
                    private_key: string;
                    solana_address?: string | null;
                    solana_private_key?: string | null;
                    telegram_username: string;
                    total_balance?: number | null;
                    total_pnl?: number;
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
                    private_key?: string;
                    solana_address?: string | null;
                    solana_private_key?: string | null;
                    telegram_username?: string;
                    total_balance?: number | null;
                    total_pnl?: number;
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

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
              Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
        : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
          Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
        | { schema: keyof Database },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
        : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
      ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
      : never;

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema["CompositeTypes"]
        | { schema: keyof Database },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
        : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
    ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
      ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
      : never;

export const Constants = {
    public: {
        Enums: {},
    },
} as const;
