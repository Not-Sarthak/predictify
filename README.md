1. Drop Notifications

--
getMarketTradesEvents.ts
isOrderScoring.ts

getSpreads.ts
getMidPoints.ts
getNofications.ts

implemented but not tested:
marketBuyOrder.ts
marketSellOrder.ts

--- BOT INTEGRATION for Open/Close Position ---

**Open Position Always BUYS, Close Position Always SELLS**

- Add Button in Trade Menu - Close Position (same as Open Position Flow but Sells)

- Trade Button -> Top Markets Button (Calls `getTopMarkets()`)
- Trade Button -> View Postions Button (Calls `getUserPosition(user_address)`)
- Trade Button -> Open Position BUtton
  - User Enters a Term
  - Search markets for that term using this query: `https://polymarket.com/api/events/search?_s=volume_24hr&_sts=active&_q=iran&_l=20&_p=1`
  - Fetch Paginated Markets and send in batches of 5 + Give View More Button that fetches the next 5
  - User selects on a Button (1, 2, 3, 4, 5) + Previous (send prev 5) + Next (send next 5)
  - When a market is selected, send 4 buttons (gtc, gtd, fok, fak) for order type.
  - When an order type is selected, Ask for a text in the format (<yes/no> <price> <size>)
  - When proper text is received, open a position by calling appropriate fn and send the order details in a nice message

Tag bot and give info

solana address