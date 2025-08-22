import type { LocaleMessages } from "../types";

export const en: LocaleMessages = {
    // Common buttons
    close: "❌ Close",
    back: "⬅️ Back",
    cancel: "❌ Cancel",
    confirm: "✅ Confirm",
    refresh: "🔄 Refresh",
    next: "Next ➡️",
    previous: "⬅️ Prev",

    // Main menu
    subscriptions: "🔔 Subscriptions",
    trade: "🔥 Trade",
    autoTrade: "🤖 AutoTrade",
    portfolio: "📈 Portfolio",
    walletFunds: "💼 Wallet/Funds",
    viewProfile: "👤 View Profile",

    // Settings
    settings: "⚙️ Settings",
    language: "🌐 Language",
    switchLanguage: "🌐 Switch Language",
    languageSettings: "🌐 Language Settings",
    english: "🇺🇸 English",
    chinese: "🇨🇳 中文",
    languageUpdated: "✅ Language updated successfully!",

    // Wallet actions
    exportEvmKey: "🔑 Export EVM Key",
    exportSolKey: "🔑 Export SOL Key",
    withdrawSol: "💸 Withdraw SOL",
    withdrawUsdc: "💵 Withdraw USDC",
    swapFunds: "🔁 Swap USDC to USDCe",
    resetWallet: "🔄️ Reset Wallet",
    bridgeFunds: "🌉 Bridge Funds",

    // Trading
    marketOrder: "⚡ Market",
    limitOrder: "🎯 Limit",
    setPriceAlert: "🔔 Set Price Alert",
    takeProfit: "💸 Take Profit",
    stopLoss: "🛑 Stop Loss",

    // Messages
    welcome: `Welcome to Predictify
We trade headlines for breakfast. 📰⚔
Your wallet's live. Let's degen.`,
    walletReset: "✅ Wallet Reset Successfully",
    orderCancelled: "✅ Order Cancelled!",
    internalServerError: "❌ Internal Server Error",
    userNotFound: "❌ User not found",

    // Status messages
    success: "✅ Success",
    error: "❌ Error",
    loading: "⌛ Loading...",
    processing: "⌛ Processing...",

    // Balance labels
    totalBalance: "Total Balance",
    availableBalance: "Available Balance",
    lockedBalance: "Locked Balance",

    // Wallet labels
    evmAddress: "Polygon Address",
    solanaAddress: "Solana Address",
    addresses: "Your Wallets",
    balances: "Your Balances",

    // Market/Trading Content
    topMarkets: "🔎 Top Markets",
    viewMarket: "👁️ View Market",
    marketDetails: "📊 Market Details",
    marketPrice: "Market Price",
    volume: "Volume",
    liquidity: "Liquidity",
    probability: "Probability",
    yes: "YES",
    no: "NO",
    buy: "Buy",
    sell: "Sell",
    amount: "Amount",
    price: "Price",
    total: "Total",

    // High Probability Features
    highProbabilityMarkets: "High Probability Markets",
    highProbability: "High Probability",
    filters: "Filters",
    minVolume: "Minimum Volume",
    minLiquidity: "Minimum Liquidity",
    minProbability: "Minimum Probability",
    maxProbability: "Maximum Probability",
    applyFilters: "Apply Filters",
    clearFilters: "Clear Filters",
    noMarketsFound: "No Markets Found",

    // High Probability Command specific
    conservative: "Conservative",
    aggressive: "Aggressive",
    viewMarkets: "View Markets",
    autoSplitTrade: "Auto-Split Trade",
    manualSelection: "Manual Selection",
    adjustFilters: "Adjust Filters",
    whatIsThis: "What's This?",
    highProbDescription: "Target markets with",
    probabilityRange: "probability expiring within 24-48 hours for lower-risk opportunities",
    currentFilters: "Current Filters",
    time: "Time",
    cryptoMarkets: "Crypto Markets",
    sportsMarkets: "Sports Markets",
    zeroDteMarkets: "0DTE Markets",
    resolvedMarkets: "Resolved Markets",
    excluded: "Excluded",
    chooseOption: "Choose an option below to get started",
    found: "Found",
    qualifyingMarkets: "qualifying markets",
    left: "left",
    return: "Return",
    switchTo: "Switch to",
    backToMenu: "Back to Menu",
    noAvailableMarkets: "No Available Markets",
    ends: "Ends",

    // Market Categories
    politics: "Politics",
    crypto: "Crypto",
    sports: "Sports",
    economics: "Economics",
    entertainment: "Entertainment",
    science: "Science",
    weather: "Weather",
    elections: "Elections",

    // Position/Portfolio
    openPositions: "Open Positions",
    closedPositions: "Closed Positions",
    position: "Position",
    pnl: "P&L",
    entry: "Entry",
    exit: "Exit",
    shares: "Shares",
    marketValue: "Market Value",
    unrealizedPnl: "Unrealized P&L",
    realizedPnl: "Realized P&L",

    // Orders
    openOrders: "Open Orders",
    orderHistory: "Order History",
    orderType: "Order Type",
    orderStatus: "Order Status",
    pending: "Pending",
    filled: "Filled",
    cancelled: "Cancelled",
    expired: "Expired",

    // Notifications/Alerts
    priceAlert: "Price Alert",
    priceAlerts: "Price Alerts",
    alertTriggered: "Alert Triggered",
    alertSet: "Alert Set",
    alertRemoved: "Alert Removed",
    notification: "Notification",

    // Time/Date
    today: "Today",
    yesterday: "Yesterday",
    thisWeek: "This Week",
    thisMonth: "This Month",
    hour: "hour",
    hours: "hours",
    day: "day",
    days: "days",
    week: "week",
    weeks: "weeks",
    month: "month",
    months: "months",

    // Actions
    add: "Add",
    remove: "Remove",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    update: "Update",
    create: "Create",
    view: "View",
    manage: "Manage",
    configure: "Configure",

    // Market Resolution
    resolved: "Resolved",
    unresolved: "Unresolved",
    winner: "Winner",
    loser: "Loser",

    // Error Messages
    insufficientFunds: "Insufficient funds",
    invalidAmount: "Invalid amount",
    invalidPrice: "Invalid price",
    marketClosed: "Market is closed",
    orderFailed: "Order failed",
    connectionError: "Connection error",
    errorFetchingMarket: "There Was an Error Fetching Market Details",

    // Copy Trading
    copyTrading: "Copy Trading",
    enableCopyTrading: "Enable Copy Trading",
    disableCopyTrading: "Disable Copy Trading",
    watchedWallets: "Watched Wallets",
    addWallet: "Add Wallet",
    removeWallet: "Remove Wallet",

    // Referral System
    referral: "Referral",
    referralCode: "Referral Code",
    referralLink: "Referral Link",
    referrals: "Referrals",
    earnings: "Earnings",

    // Subscription Categories
    subscriptionCategories: "Subscription Categories",
    subscribe: "Subscribe",
    unsubscribe: "Unsubscribe",
    subscribed: "Subscribed",
    unsubscribed: "Unsubscribed",

    // Common Phrases
    clickToView: "Click to view",
    tapToSelect: "Tap to select",
    enterAmount: "Enter amount",
    enterPrice: "Enter price",
    selectMarket: "Select market",
    confirmOrder: "Confirm order",
    orderPlaced: "Order placed",
    orderExecuted: "Order executed",

    // Market Status
    active: "Active",
    closed: "Closed",
    paused: "Paused",

    // Pagination
    page: "Page",
    of: "of",
    showMore: "Show More",
    showLess: "Show Less",

    // Units
    usd: "USD",
    usdc: "USDC",
    sol: "SOL",
    pol: "POL",
    percent: "%",
};
