import { getPOLBalance } from "../helpers/get-user-balance";
import { needsPOLForGas } from "../helpers/get-pol-balance";
import { getSOLPriceUSD, getPOLPriceUSD } from "../utils/crypto-prices";
import { calculateBridgeAllocation } from "../utils/debridge/functions/pol-bridge-handler";

/**
 * Test utilities for POL auto-acquisition feature
 */

export class POLTestUtils {
    static async testPOLBalance(address: string) {
        console.log("🧪 Testing POL Balance for:", address);

        try {
            const polBalance = await getPOLBalance(address);
            const needsPOL = await needsPOLForGas(address);

            console.log("✅ POL Balance:", polBalance.toFixed(4), "POL");
            console.log("✅ Needs POL:", needsPOL ? "YES" : "NO");

            return { polBalance, needsPOL };
        } catch (error) {
            console.error("❌ Error testing POL balance:", error);
            return null;
        }
    }

    /**
     * Test price API functionality
     */
    static async testPriceAPIs() {
        console.log("🧪 Testing Price APIs...");

        try {
            const [solPrice, polPrice] = await Promise.all([getSOLPriceUSD(), getPOLPriceUSD()]);

            console.log("✅ SOL Price:", "$" + solPrice.toFixed(2));
            console.log("✅ POL Price:", "$" + polPrice.toFixed(4));

            return { solPrice, polPrice };
        } catch (error) {
            console.error("❌ Error testing price APIs:", error);
            return null;
        }
    }

    /**
     * Test allocation calculation logic
     */
    static async testAllocationCalculation(solAmount: number = 10) {
        console.log("🧪 Testing Allocation Calculation for", solAmount, "SOL...");

        try {
            const allocation = await calculateBridgeAllocation(solAmount, 0.03, 1);

            console.log("✅ Allocation Results:");
            console.log("  - Total Available:", allocation.totalAvailable.toFixed(4), "SOL");
            console.log("  - POL Allocation:", allocation.polAllocation.toFixed(4), "SOL");
            console.log("  - USDC Allocation:", allocation.usdcAllocation.toFixed(4), "SOL");
            console.log("  - SOL Price:", "$" + allocation.solPriceUSD.toFixed(2));

            return allocation;
        } catch (error) {
            console.error("❌ Error testing allocation calculation:", error);
            return null;
        }
    }

    /**
     * Test complete POL workflow for a user
     */
    static async testCompleteWorkflow(walletAddress: string, solBalance: number = 10) {
        console.log("🧪 Testing Complete POL Workflow...");
        console.log("📍 Wallet:", walletAddress);
        console.log("📍 SOL Balance:", solBalance);

        // Step 1: Check POL balance
        console.log("\n1️⃣ Checking POL Balance...");
        const polTest = await this.testPOLBalance(walletAddress);
        if (!polTest) return null;

        // Step 2: Check prices
        console.log("\n2️⃣ Checking Prices...");
        const priceTest = await this.testPriceAPIs();
        if (!priceTest) return null;

        // Step 3: Calculate allocation
        console.log("\n3️⃣ Calculating Allocation...");
        const allocationTest = await this.testAllocationCalculation(solBalance);
        if (!allocationTest) return null;

        // Step 4: Determine bridge strategy
        console.log("\n4️⃣ Bridge Strategy:");
        if (polTest.needsPOL) {
            console.log("🟡 POL Auto-Acquisition ENABLED");
            console.log("  - Will bridge", allocationTest.polAllocation.toFixed(4), "SOL to POL");
            console.log("  - Will bridge", allocationTest.usdcAllocation.toFixed(4), "SOL to USDC");
        } else {
            console.log("🟢 Standard Bridge (POL sufficient)");
            console.log("  - Will bridge all", solBalance, "SOL to USDC");
        }

        return {
            polBalance: polTest.polBalance,
            needsPOL: polTest.needsPOL,
            solPrice: priceTest.solPrice,
            polPrice: priceTest.polPrice,
            allocation: allocationTest,
        };
    }

    /**
     * Mock bridge quote for testing UI
     */
    static generateMockBridgeQuote(solAmount: number, usdcAmount: number, needsPOL: boolean) {
        const baseQuote = {
            userId: "test_user",
            amount: solAmount.toString(),
            estimatedOutput: usdcAmount.toString(),
            fees: "0",
            quoteData: {
                /* mock data */
            },
        };

        if (needsPOL) {
            return {
                ...baseQuote,
                polAllocation: solAmount * 0.067, // ~$1 worth at $150/SOL
                usdcAllocation: solAmount * 0.933,
                needsPOL: true,
                polBridgeData: {
                    /* mock POL bridge data */
                },
            };
        }

        return baseQuote;
    }

    /**
     * Test error scenarios
     */
    static async testErrorScenarios() {
        console.log("🧪 Testing Error Scenarios...");

        // Test invalid address
        console.log("\n❌ Testing invalid address...");
        try {
            await getPOLBalance("invalid_address");
        } catch (error) {
            console.log("✅ Invalid address handled correctly");
        }

        // Test network timeout simulation
        console.log("\n⏱️ Testing timeout scenario...");
        // This would require mocking the RPC provider

        // Test price API failure
        console.log("\n📈 Testing price API fallback...");
        // This would show fallback to default prices
    }
}

/**
 * Quick test command for development
 */
export async function runQuickTest(walletAddress?: string) {
    console.log("🚀 Running Quick POL Feature Test...\n");

    // Use a sample address if none provided
    const testAddress = walletAddress || "0x742d35Cc6635C0532925a3b8D9f8B3b4c2D9F33F";

    const result = await POLTestUtils.testCompleteWorkflow(testAddress, 10);

    if (result) {
        console.log("\n✅ All tests completed successfully!");
        console.log("📊 Summary:");
        console.log("  - POL Balance:", result.polBalance.toFixed(4), "POL");
        console.log("  - Needs Auto-Acquisition:", result.needsPOL ? "YES" : "NO");
        console.log("  - SOL Price:", "$" + result.solPrice.toFixed(2));
        console.log("  - Strategy:", result.needsPOL ? "Dual Bridge" : "USDC Only");
    } else {
        console.log("\n❌ Tests failed - check implementation");
    }

    return result;
}

// Export for easy import in bot
export { POLTestUtils as default };
