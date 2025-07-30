TODO:

- [ ] Refactor & Optimize
- [ ] Use an ORM
- [ ] ADD UNIT TESTS
- [ ] Setup Monorepo
- [ ] Use Docker Compose
- [ ] Add Status Service (for monitoring services & logs)

<!-- FOR LATER (SCALING) -->

- [ ] Lambda for Trade Execution
- [ ] SQS + Lambda for Notification

---

3. admin dashboard: Total user, Total volume, Total market order traded, Total limit order traded

 <!-- VERY VERY LATER -->

5. Tag Bot and Give Info
6. Twitter Bot

Manav:

- TP & SL Conditions and Edit TP SL
- tp sl and price alert ux (both take once price and it automatically decides price_above/price_below or take_profit/stop_loss depending on the current price)
- dont show pnl card when limit order is not matched
- show pnl card when limit order is matched w/ notif
- if manually closed, then remove limit orders as well of that particular market
- edge case in tp sl after sell 50% (close the prev tp/sl order and place new one at new available amount)

Sarthak:

- fix execution price (show similar to pnl)
- share on x in position card
- strategy 1 -> take notes from scalper
- position card / in portfolio section
