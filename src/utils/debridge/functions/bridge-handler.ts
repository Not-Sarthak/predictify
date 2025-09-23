import { Markup, type Context } from "telegraf";
// Replaced debridge with Mayan Finance
import {
    handleBridgeFunds as handleMayanBridgeFunds,
    handleBridgeConfirm as handleMayanBridgeConfirm,
    handleBridgeStatus as handleMayanBridgeStatus,
} from "../../mayan/functions/bridge-handler";

// Re-export Mayan functions to maintain compatibility with existing imports
export const handleBridgeFunds = handleMayanBridgeFunds;
export const handleBridgeConfirm = handleMayanBridgeConfirm;
export const handleBridgeStatus = handleMayanBridgeStatus;
