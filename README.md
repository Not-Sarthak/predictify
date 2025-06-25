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

-> Replace Deleting Messages with Editing Messages and Answer Callbacks after each button pressed (using `ctx.answerCbQuery()`) (Better Flow)
-> Trade Button -> Top Markets Button (Calls `getTopMarkets()`)
-> Show Markets from the Events (if no market, just show yes/no)
-> Show Order Book before Selling to show available Prices
-> Setup Prettier
-> When Order BUY placed, add the Amount to Volume in User

Tag bot and give info
