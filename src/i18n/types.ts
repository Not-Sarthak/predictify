export interface LocaleMessages {
    // Common buttons
    close: string;
    back: string;
    cancel: string;
    confirm: string;
    refresh: string;
    next: string;
    previous: string;

    // Main menu
    subscriptions: string;
    trade: string;
    tradeStrategies: string;
    autoTrade: string;
    portfolio: string;
    walletFunds: string;
    viewProfile: string;

    // Settings
    settings: string;
    language: string;
    switchLanguage: string;
    languageSettings: string;
    english: string;
    chinese: string;
    languageUpdated: string;

    // Wallet actions
    exportEvmKey: string;
    exportSolKey: string;
    withdrawSol: string;
    withdrawUsdc: string;
    swapFunds: string;
    resetWallet: string;
    bridgeFunds: string;

    // Trading
    marketOrder: string;
    limitOrder: string;
    setPriceAlert: string;
    takeProfit: string;
    stopLoss: string;

    // Messages
    welcome: string;
    walletReset: string;
    orderCancelled: string;
    internalServerError: string;
    userNotFound: string;

    // Status messages
    success: string;
    error: string;
    loading: string;
    processing: string;

    // Balance labels
    totalBalance: string;
    availableBalance: string;
    lockedBalance: string;

    // Wallet labels
    evmAddress: string;
    solanaAddress: string;
    addresses: string;
    balances: string;

    // Market/Trading Content
    topMarkets: string;
    viewMarket: string;
    marketDetails: string;
    marketPrice: string;
    volume: string;
    liquidity: string;
    probability: string;
    yes: string;
    no: string;
    buy: string;
    sell: string;
    amount: string;
    price: string;
    total: string;

    // High Probability Features
    highProbabilityMarkets: string;
    highProbability: string;
    filters: string;
    minVolume: string;
    minLiquidity: string;
    minProbability: string;
    maxProbability: string;
    applyFilters: string;
    clearFilters: string;
    noMarketsFound: string;

    // High Probability Command specific
    conservative: string;
    aggressive: string;
    viewMarkets: string;
    autoSplitTrade: string;
    manualSelection: string;
    adjustFilters: string;
    whatIsThis: string;
    highProbDescription: string;
    probabilityRange: string;
    currentFilters: string;
    time: string;
    cryptoMarkets: string;
    sportsMarkets: string;
    zeroDteMarkets: string;
    resolvedMarkets: string;
    excluded: string;
    included: string;
    chooseOption: string;
    found: string;
    qualifyingMarkets: string;
    left: string;
    return: string;
    switchTo: string;
    backToMenu: string;
    noAvailableMarkets: string;
    ends: string;

    // Welcome message specific
    yourBalances: string;
    lowBalance: string;
    autoAcquisitionEnabled: string;
    yourWallets: string;
    polygonAddress: string;
    whatYouCanDo: string;
    blastYesNoBets: string;
    copyTopWallets: string;
    getAlertsByCategory: string;
    trackPnlPositions: string;
    fundWalletWithSol: string;
    useFundCommand: string;
    noLoginsBrowserTabs: string;

    // Filter translations
    volumeFilter: string;
    newestFilter: string;
    endingSoonFilter: string;

    // Market Categories
    politics: string;
    crypto: string;
    sports: string;
    economics: string;
    entertainment: string;
    science: string;
    weather: string;
    elections: string;
    breakingNews: string;
    geoPolitics: string;
    trump: string;
    elonMusk: string;
    tech: string;
    business: string;
    economy: string;
    popCulture: string;

    // Position/Portfolio
    openPositions: string;
    closedPositions: string;
    position: string;
    pnl: string;
    entry: string;
    exit: string;
    shares: string;
    marketValue: string;
    unrealizedPnl: string;
    realizedPnl: string;

    // Orders
    openOrders: string;
    orderHistory: string;
    orderType: string;
    orderStatus: string;
    pending: string;
    filled: string;
    cancelled: string;
    expired: string;

    // Notifications/Alerts
    priceAlert: string;
    priceAlerts: string;
    alertTriggered: string;
    alertSet: string;
    alertRemoved: string;
    notification: string;

    // Time/Date
    today: string;
    yesterday: string;
    thisWeek: string;
    thisMonth: string;
    hour: string;
    hours: string;
    day: string;
    days: string;
    week: string;
    weeks: string;
    month: string;
    months: string;

    // Actions
    add: string;
    remove: string;
    edit: string;
    delete: string;
    save: string;
    update: string;
    create: string;
    view: string;
    manage: string;
    configure: string;

    // Market Resolution
    resolved: string;
    unresolved: string;
    winner: string;
    loser: string;

    // Error Messages
    insufficientFunds: string;
    invalidAmount: string;
    invalidPrice: string;
    marketClosed: string;
    orderFailed: string;
    connectionError: string;
    errorFetchingMarket: string;

    // Copy Trading
    copyTrading: string;
    enableCopyTrading: string;
    disableCopyTrading: string;
    watchedWallets: string;
    addWallet: string;
    removeWallet: string;

    // Referral System
    referral: string;
    referralCode: string;
    referralLink: string;
    referrals: string;
    earnings: string;

    // Subscription Categories
    subscriptionCategories: string;
    subscribe: string;
    unsubscribe: string;
    subscribed: string;
    unsubscribed: string;

    // Common Phrases
    clickToView: string;
    tapToSelect: string;
    enterAmount: string;
    enterPrice: string;
    selectMarket: string;
    confirmOrder: string;
    orderPlaced: string;
    orderExecuted: string;

    // Market Status
    active: string;
    closed: string;
    paused: string;

    // Pagination
    page: string;
    of: string;
    showMore: string;
    showLess: string;

    // Units
    usd: string;
    usdc: string;
    sol: string;
    pol: string;
    percent: string;

    // Missing UI Button Translations
    mainMenu: string;
    backToMainMenu: string;
    bridgeSolToUsdc: string;
    closePosition: string;
    subscribeAction: string;
    unsubscribeAction: string;
    mySubscriptions: string;
    enterCustom: string;
    managePriceAlerts: string;
    zerodayToExpiry: string;
    openPosition: string;
    closePositionBtn: string;
    highProbMarkets: string;
    deleteWallet: string;
    viewWatchedWallets: string;
    configureCopyTrade: string;
    moreStrategies: string;

    // High Probability Strategy Buttons
    degenStrategy: string;
    turtleStrategy: string;
    addToWatchlist: string;
    marketYes: string;
    marketNo: string;
    limitYes: string;
    limitNo: string;
    aboutThisMarket: string;
    tradeSelected: string;
    clearAll: string;
    conservativeMode: string;
    aggressiveMode: string;
    toggleAlerts: string;
    testFilters: string;

    // Filter Status Texts
    cryptoIncluded: string;
    cryptoExcluded: string;
    sportsExcluded: string;

    // Dynamic Market Content
    question: string;
    market: string;
    details: string;
    aboutMarket: string;

    // Time and Date Expressions
    hoursLeft: string;
    endsIn: string;

    // Trading Actions
    buyYes: string;
    buyNo: string;
    sellYes: string;
    sellNo: string;

    // Referral System
    tryAgain: string;
    refreshStats: string;

    // More button text
    hour1: string;
    hour4: string;
    hour24: string;
    hour48: string;

    // Additional UI text
    chooseTradingOption: string;

    // High Probability Market Data
    foundMarkets: string;
    qualifyingMarketsText: string;

    // Market data labels
    volumeShort: string;
    timeLeft: string;
    notAvailable: string;

    // Filter status
    noCrypto: string;
    includeCrypto: string;
    alertsOn: string;
    alertsOff: string;

    // Strategy descriptions
    aggressiveDescription: string;
    conservativeDescription: string;
    selectStrategyPrompt: string;

    // Strategy button texts
    degenStrategyButton: string;
    turtleStrategyButton: string;

    // Profile page texts
    yourPolymarketProfile: string;
    lifetimePnl: string;
    totalHoldings: string;
    winRate: string;
    yourReferralCode: string;
    viewOnPolymarket: string;
    notAssigned: string;

    // Position messages
    noOpenPositions: string;
    noOpenPositionsFound: string;

    // Search and Trending
    trendingZeroDteMarkets: string;
    enterTermToSearch: string;
    searchTerm: string;
    searchExample: string;
    basketballExample: string;
    enterAnyKeyword: string;
    topZeroDteMarketsFor: string;
    chooseSubscriptionOption: string;
    hourlyMarkets: string;

    // Cryptocurrency names
    bitcoin: string;
    ethereum: string;
    solana: string;
    xrp: string;
    dogecoin: string;
    hyperliquid: string;
    orderbook: string;

    // Market direction words
    up: string;
    or: string;
    down: string;
    what: string;
    where: string;
    will: string;
    with: string;
    and: string;
    nextMarket: string; // renamed to avoid duplicate
    who: string;
    together: string;

    // Time periods
    monthly: string;
    hourly: string;
    daily: string;
    weekly: string;
    priceMarket: string; // renamed to avoid duplicate
    hit: string;
    in: string;
    on: string;
    by: string;

    // Months
    january: string;
    february: string;
    march: string;
    april: string;
    may: string;
    june: string;
    july: string;
    august: string;
    september: string;
    october: string;
    november: string;
    december: string;

    // Price movements
    above: string;
    below: string;
    dip: string;
    allTimeHigh: string;
    marketCap: string;
    fdv: string;
    before: string;
    after: string;

    // Geopolitical terms
    russia: string;
    ukraine: string;
    israel: string;
    iran: string;
    hamas: string;
    ceasefire: string;
    putin: string;
    zelenskyy: string;
    trumpMarket: string; // renamed to avoid duplicate
    meet: string;

    // Economic terms
    fed: string;
    meeting: string;
    chair: string;
    decision: string;
    jeromePowelll: string;
    rate: string;
    cut: string;
    us: string;
    recession: string;
    inflation: string;

    // Additional UI text
    removeFromWatchlist: string;
    watchlist: string;
    from: string;

    // High-probability market messages
    noMarketsFoundMatching: string;
    possibleReasons: string;
    marketsExpiredRecently: string;
    cryptoMightBeExcluded: string;
    tryLongerTimeFrame: string;
    adjustProbabilityRanges: string;
    quickActions: string;
    includeCryptoMarkets: string;

    // Order and alert messages
    priceAlertSetSuccessfully: string;
    marketLabel: string;
    side: string;
    alertAtPrice: string;
    notificationWhenMet: string;
    enterOrderDetails: string;
    formatExample: string;
    priceDescription: string;
    amountDescription: string;
    minimumAmount: string;

    // Bot command descriptions
    cmdStart: string;
    cmdSubscriptions: string;
    cmdTrade: string;
    cmdAutotrade: string;
    cmdFund: string;
    cmdHistory: string;
    cmdPortfolio: string;
    cmdManage: string;
    cmdStats: string;
    cmdWatchlist: string;
    cmdHighprob: string;
    cmdRef: string;
    cmdAnalytics: string;
    cmdDetailed: string;
}
