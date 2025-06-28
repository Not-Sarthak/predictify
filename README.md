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

Tag bot and give info

### NOW

- Socket Server to Monitor for Copy Trading.

- Add Fees while opening/closing a position in normal and autotrade. (watch fee.ts)
- COMPLETE TODO COMMENTS

### FOR LATER

- Handle Edge Cases where the copy_wallet is ordering on the minimum price & shares.

### REFACTOR

- Cache Data as needed (User profile data, markets etc.)
- Add try-catch function for error handling (Theo's gist)
- Remove Redundant Code
- Custom Error Classes
- Optimize Code wherever needed/possible

### UX Improvements

- Add/Edit Buttons (Back (Prev Menu), Back to Main Menu, Close (Closes the Message))
