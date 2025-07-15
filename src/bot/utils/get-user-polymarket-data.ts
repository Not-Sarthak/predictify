export async function getUserTotalHoldings(address: string) {
    try {
        const response = await fetch(`https://data-api.polymarket.com/value?user=${address}`);
        if (!response.ok) {
            throw new Error(await response.text());
        }

        const data = await response.json();
        return data[0].value;
    } catch (error) {
        console.log("Error fetching User Total Holdings: ", error);
        return null;
    }
}

export async function getUserTotalPnL(address: string) {
    try {
        const response = await fetch(
            `https://data-api.polymarket.com/positions?sizeThreshold=1&limit=500&sortDirection=DESC&user=${address}`
        );

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const data = await response.json();

        const totalPnl = data.reduce((sum: number, pos: any) => {
            const cash = typeof pos.cashPnl === "number" ? pos.cashPnl : 0;
            const realized = typeof pos.realizedPnl === "number" ? pos.realizedPnl : 0;
            return sum + cash + realized;
        }, 0);

        return totalPnl;
    } catch (error) {
        console.log("Error fetching User Total Holdings: ", error);
        return null;
    }
}
