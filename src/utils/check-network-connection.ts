import { ethers } from "ethers";

export async function checkNetworkConnection() {
    try {
        const provider = new ethers.JsonRpcProvider("https://polygon-rpc.com");

        const network = await provider.getNetwork();

        const blockNumber = await provider.getBlockNumber();

        return {
            network: network.name,
            chainId: network.chainId,
            blockNumber: blockNumber,
        };
    } catch (error) {
        console.error("Network Connection Failed:", error);
        return false;
    }
}

// checkNetworkConnection().then((result) => {
//     console.log(result);
// });
