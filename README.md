Database:
User
- TG ID [index]
- TG Username
- Wallet Address
- Pvt Key [Encrypt]
- API Creds
- Fees Total
- Positions []
- Copy Wallets[] -> 3 Max


Positions
- TG ID from User [FK]
- Wallet address
- market/condition id
- market slug
- question
- description
- open/close and yes/no token id
- buys array
- sells array
- amount [total volume]
- pnl for individual position
- pnl for all position
- fees [0.1%]


Copy Wallet[3]
- user tg id [User] [FK]
- id
- Name for wallet address
- Wallet address[index]
- % ratio
- type enabled | disabled


Endpoints:
/user [POST] -> create
/user [GET] -> get details
/trade[POST] [open/close + yes/no + stop loss/take profit] -> create order
/trade[GET] -> get all active positions of user
/watch-wallet[GET] -> watch wallet copy trade | by default disabled /// On enable starts copy-trading



/user-subscriptions[GET] -> get active subscriptions of user [in Redis]
/user-subscriptions[POST] -> subscribe/unsubscribe + categories  [in Redis]