import type { LocaleMessages } from "../types";

export const zh: LocaleMessages = {
    // High Probability Features
    highProbabilityMarkets: "高概率市场",
    highProbability: "高概率",
    filters: "筛选器",
    minVolume: "最小交易量",
    minLiquidity: "最小流动性",
    minProbability: "最小概率",
    maxProbability: "最大概率",
    applyFilters: "应用筛选器",
    clearFilters: "清除筛选器",
    noMarketsFound: "未找到市场",
    order: "命令",
    book: "书",
    // High Probability Command
    conservative: "保守型",
    aggressive: "激进型",
    viewMarkets: "查看市场",
    autoSplitTrade: "自动分割交易",
    manualSelection: "手动选择",
    adjustFilters: "调整筛选器",
    whatIsThis: "这是什么？",
    highProbDescription: "针对24-48小时内到期的",
    probabilityRange: "概率市场进行低风险投资",
    currentFilters: "当前筛选器",
    time: "时间",
    cryptoMarkets: "加密货币市场",
    sportsMarkets: "体育市场",
    zeroDteMarkets: "当日到期市场",
    resolvedMarkets: "已结算市场",
    excluded: "已排除",
    included: "已包含",
    chooseOption: "选择以下选项开始",
    found: "找到",
    qualifyingMarkets: "符合条件的市场",
    left: "剩余",
    return: "回报",
    switchTo: "切换到",
    backToMenu: "返回菜单",
    noAvailableMarkets: "没有可用的市场",
    ends: "结束时间",

    // Welcome message specific
    yourBalances: "您的余额",
    lowBalance: "余额不足",
    autoAcquisitionEnabled: "已启用自动获取",
    yourWallets: "您的钱包",
    polygonAddress: "Polygon地址",
    whatYouCanDo: "您可以执行的操作",
    blastYesNoBets: "通过市价或限价单进行YES/NO投注",
    copyTopWallets: "即时复制顶级钱包",
    getAlertsByCategory: '按类别获取提醒 — "选举"、"加密货币"、"AI"',
    trackPnlPositions: "跟踪盈亏和持仓",
    fundWalletWithSol: "使用SOL或Polygon USDC为钱包充值 — 您的选择",
    useFundCommand: "使用 /fund 充值并开始交易",
    noLoginsBrowserTabs: "无需登录。无需浏览器标签。纯粹的预测市场流程。",

    // Filter translations
    volumeFilter: "💧 交易量",
    newestFilter: "🆕 最新",
    endingSoonFilter: "⏳ 即将结束",

    // Common buttons
    close: "❌ 关闭",
    back: "⬅️ 返回",
    cancel: "❌ 取消",
    confirm: "✅ 确认",
    refresh: "🔄 刷新",
    next: "下一页 ➡️",
    previous: "⬅️ 上一页",

    // Main menu
    subscriptions: "🔔 订阅",
    trade: "🔥 交易",
    tradeStrategies: "🎯 交易策略",
    autoTrade: "🤖 自动交易",
    portfolio: "📈 投资组合",
    walletFunds: "💼 钱包/资金",
    viewProfile: "👤 查看资料",

    // Settings
    settings: "⚙️ 设置",
    language: "🌐 语言",
    switchLanguage: "🌐 切换语言",
    languageSettings: "🌐 语言设置",
    english: "🇺🇸 English",
    chinese: "🇨🇳 中文",
    languageUpdated: "✅ 语言更新成功！",

    // Wallet actions
    exportEvmKey: "🔑 导出EVM私钥",
    exportSolKey: "🔑 导出SOL私钥",
    withdrawSol: "💸 提取SOL",
    withdrawUsdc: "💵 提取USDC",
    swapFunds: "🔁 兑换USDC为USDCe",
    resetWallet: "🔄️ 重置钱包",
    confirmResetWallet: "✅ 確認重置錢包",
    confirmResetMsg: `⚠️⚠️ *确认重置钱包* ⚠️⚠️

您即将重置您的钱包。请在继续操作前仔细阅读以下内容：

- *不可逆操作*：重置钱包将永久删除所有钱包数据，包括地址、余额、交易记录以及任何本地存储的信息。本操作不可撤销。

- *私钥*：在继续操作前，您必须导出并安全保存与钱包关联的所有私钥。如未执行此操作，可能会导致永久丢失对资金的访问权限。

- *用户责任*：通过确认此操作，您承认并同意：
  - 您对导出和安全保存私钥负全部责任。
  - 因未导出或未安全保存私钥而导致的资金或钱包数据损失，完全由您自行承担。
  - 本服务及其开发者不对因本操作产生的任何损失、损害或问题承担责任。
  - 您是在充分了解后果的情况下，自愿执行此操作。

- *确认*：如果您理解并接受上述风险，可以继续操作。否则，请取消以保留您的钱包。`,
    bridgeFunds: "🌉 跨链转账",

    // Trading
    marketOrder: "⚡ 市价单",
    limitOrder: "🎯 限价单",
    setPriceAlert: "🔔 设置价格提醒",
    takeProfit: "💸 止盈",
    stopLoss: "🛑 止损",
    redeem: "💵 贖回倉位",

    // Messages
    welcome: `欢迎使用Predictify
我们以头条新闻为早餐。📰⚔
您的钱包已激活。让我们开始吧。`,
    walletReset: "✅ 钱包重置成功",
    orderCancelled: "✅ 订单已取消！",

    // Terms of Service
    termsTitle: "🔒 **服务条款协议**",
    termsContent: `使用此服务，即表示您同意 Polymarket 的[使用条款](https://polymarket.com/tos)，并证明您并非
    (i) 美国公民；
    (ii) 位于美国或其他受限制的司法管辖区；
    (iii) 使用 VPN 或其他措施规避或试图规避限制。
    请阅读并接受这些条款，以便继续使用该机器人`,
    acceptTerms: "✅ 接受",
    rejectTerms: "❌ 拒绝",
    termsRejected:
        "❌ 您必须接受服务条款才能使用此机器人。\n\n如果您改变主意，可以通过发送 /start 重新开始",
    internalServerError: "❌ 内部服务器错误",
    userNotFound: "❌ 未找到用户",

    // Status messages
    success: "✅ 成功",
    error: "❌ 错误",
    loading: "⌛ 加载中...",
    processing: "⌛ 处理中...",

    // Balance labels
    totalBalance: "总余额",
    availableBalance: "可用余额",
    lockedBalance: "锁定余额",

    // Wallet labels
    evmAddress: "Polygon地址",
    solanaAddress: "Solana地址",
    addresses: "您的钱包",
    balances: "您的余额",

    // Market/Trading Content
    topMarkets: "🔎 热门市场",
    viewMarket: "👁️ 查看市场",
    marketDetails: "📊 市场详情",
    marketPrice: "市场价格",
    volume: "交易量",
    liquidity: "流动性",
    probability: "概率",
    yes: "是",
    no: "否",
    buy: "买入",
    sell: "卖出",
    amount: "数量",
    price: "价格",
    total: "总计",

    // Market Categories
    politics: "政治",
    crypto: "加密货币",
    sports: "体育",
    economics: "经济学",
    entertainment: "娱乐",
    science: "科学",
    weather: "天气",
    elections: "选举",
    breakingNews: "突发新闻",
    geoPolitics: "地缘政治",
    trump: "特朗普",
    elonMusk: "埃隆·马斯克",
    tech: "科技",
    business: "商业",
    economy: "经济",
    popCulture: "流行文化",

    // Position/Portfolio
    openPositions: "持仓中",
    closedPositions: "已平仓",
    position: "持仓",
    pnl: "盈亏",
    entry: "入场",
    exit: "出场",
    shares: "• 份额",
    marketValue: "市值",
    unrealizedPnl: "未实现盈亏",
    realizedPnl: "已实现盈亏",

    // Orders
    openOrders: "待成交订单",
    orderHistory: "订单历史",
    orderType: "订单类型",
    orderStatus: "订单状态",
    pending: "待成交",
    filled: "已成交",
    cancelled: "已取消",
    expired: "已过期",

    // Notifications/Alerts
    priceAlert: "价格提醒",
    priceAlerts: "价格提醒",
    alertTriggered: "提醒已触发",
    alertSet: "提醒已设置",
    alertRemoved: "提醒已移除",
    notification: "通知",

    // Time/Date
    today: "今天",
    yesterday: "昨天",
    thisWeek: "本周",
    thisMonth: "本月",
    hour: "小时",
    hours: "小时",
    day: "天",
    days: "天",
    week: "周",
    weeks: "周",
    month: "月",
    months: "月",

    // Actions
    add: "添加",
    remove: "移除",
    edit: "编辑",
    delete: "删除",
    save: "保存",
    update: "更新",
    create: "创建",
    view: "查看",
    manage: "管理",
    configure: "配置",

    // Market Resolution
    resolved: "已结算",
    unresolved: "未结算",
    winner: "获胜者",
    loser: "失败者",

    // Error Messages
    insufficientFunds: "余额不足",
    invalidAmount: "无效数量",
    invalidPrice: "无效价格",
    marketClosed: "市场已关闭",
    orderFailed: "订单失败",
    connectionError: "连接错误",
    errorFetchingMarket: "获取市场详情时出错",

    // Copy Trading
    copyTrading: "跟单交易",
    enableCopyTrading: "启用跟单交易",
    disableCopyTrading: "禁用跟单交易",
    watchedWallets: "监控钱包",
    addWallet: "➕ 添加钱包",
    removeWallet: "移除钱包",

    // Referral System
    referral: "推荐",
    referralCode: "推荐码",
    referralLink: "推荐链接",
    referrals: "推荐人数",
    earnings: "收益",

    // Subscription Categories
    subscriptionCategories: "订阅分类",
    subscribe: "订阅",
    unsubscribe: "取消订阅",
    subscribed: "已订阅",
    unsubscribed: "已取消订阅",

    // Common Phrases
    clickToView: "点击查看",
    tapToSelect: "点击选择",
    enterAmount: "输入数量",
    enterPrice: "输入价格",
    selectMarket: "选择市场",
    confirmOrder: "确认订单",
    orderPlaced: "订单已下达",
    orderExecuted: "订单已执行",

    // Market Status
    active: "活跃",
    closed: "已关闭",
    paused: "已暂停",

    // Pagination
    page: "页",
    of: "共",
    showMore: "显示更多",
    showLess: "显示更少",

    // Units
    usd: "美元",
    usdc: "USDC",
    sol: "SOL",
    pol: "POL",
    percent: "%",

    // Missing UI Button Translations
    mainMenu: "主菜单",
    backToMainMenu: "🔙 返回主菜单",
    bridgeSolToUsdc: "🚀 跨链SOL → USDC + 自动POL获取",
    closePosition: "💵 平仓",
    subscribeAction: "🔔 订阅",
    unsubscribeAction: "🔕 取消订阅",
    mySubscriptions: "📋 我的订阅",
    enterCustom: "✨ 输入自定义",
    managePriceAlerts: "🛎️ 管理价格提醒",
    zerodayToExpiry: "⏰ 当日到期",
    openPosition: "⚡ 开仓",
    closePositionBtn: "🌂 平仓",
    highProbMarkets: "🎯 高概率市场",
    deleteWallet: "🗑️ 删除钱包",
    viewWatchedWallets: "👁️ 查看监控钱包",
    configureCopyTrade: "💰 配置",
    moreStrategies: "🔬 更多策略（即将推出）",

    // High Probability Strategy Buttons
    degenStrategy: "🔥 激进策略 (70-85%)",
    turtleStrategy: "🐢 保守策略 (85.5-97.5%)",
    addToWatchlist: "❤️ 添加到我的观察列表",
    marketYes: "⚡ 市价 是",
    marketNo: "⚡ 市价 否",
    limitYes: "🎯 限价 是",
    limitNo: "🎯 限价 否",
    aboutThisMarket: "ℹ️ 关于此市场",
    tradeSelected: "🎯 交易选中项",
    clearAll: "🔄 清除所有",
    conservativeMode: "保守模式",
    aggressiveMode: "激进模式",
    toggleAlerts: "🔔 切换提醒",
    testFilters: "🔄 测试筛选器",

    // Filter Status Texts
    cryptoIncluded: "✅ 包含加密货币",
    cryptoExcluded: "❌ 排除加密货币",
    sportsExcluded: "体育市场：已排除（永久）",

    // Dynamic Market Content
    question: "问题",
    market: "市场",
    details: "详情",
    aboutMarket: "市场信息",

    // Time and Date Expressions
    hoursLeft: "小时剩余",
    endsIn: "剩余时间",

    // Trading Actions
    buyYes: "买入 是",
    buyNo: "买入 否",
    sellYes: "卖出 是",
    sellNo: "卖出 否",

    // Referral System
    tryAgain: "🔄 重试",
    refreshStats: "🔄 刷新统计",

    // More button text
    hour1: "1小时",
    hour4: "4小时",
    hour24: "24小时",
    hour48: "48小时",

    // Additional UI text
    chooseTradingOption: "选择您的交易策略：",

    // Strategy descriptions
    aggressiveDescription: "针对70-85%概率的市场进行高交易量机会交易",
    conservativeDescription: "针对85.5-97.5%概率的市场进行更安全、低风险的交易",
    selectStrategyPrompt: "选择策略开始：",

    // Position messages
    noOpenPositions: "⚠️ 您的账户没有持仓！",
    noOpenPositionsFound: "✅ 未找到持仓。",
    noRedeemablePositionsFound: "⚠️ 無可贖回倉位",

    // Search and Trending
    trendingZeroDteMarkets: "⚡ 热门当日到期市场：",
    enterTermToSearch: "✍️ 输入搜索词",
    searchTerm: "<搜索词>",
    searchExample: "示例：",
    basketballExample: "篮球",
    enterAnyKeyword: "您可以输入任何关键词来获取相关结果。",
    topZeroDteMarketsFor: "⚡ 热门当日到期市场：",
    chooseSubscriptionOption: "选择订阅选项",
    hourlyMarkets: "⚡ 每小时市场",

    // Cryptocurrency names
    bitcoin: "比特币",
    ethereum: "以太坊",
    solana: "索拉纳",
    polygon: "多边形",
    xrp: "瑞波币",
    dogecoin: "狗狗币",
    hyperliquid: "超流动性",
    orderbook: "订单簿",

    // Profile toggle
    showUsernameInPnLCards: "✅ 在PnL卡显示用户名",
    hideUsernameInPnLCards: "❌ 在PnL卡隐藏用户名",

    // Market direction words
    up: "上涨",
    or: "或",
    down: "下跌",
    what: "什么",
    where: "哪里",
    will: "将会",
    with: "与",
    and: "和",
    nextMarket: "下一个",
    who: "谁",
    together: "一起",

    // Time periods
    monthly: "每月",
    hourly: "每小时",
    daily: "每日",
    weekly: "每周",
    priceMarket: "价格",
    hit: "达到",
    in: "在",
    on: "在",
    by: "到",

    // Months
    january: "一月",
    february: "二月",
    march: "三月",
    april: "四月",
    may: "五月",
    june: "六月",
    july: "七月",
    august: "八月",
    september: "九月",
    october: "十月",
    november: "十一月",
    december: "十二月",

    // Price movements
    above: "高于",
    below: "低于",
    dip: "回调",
    allTimeHigh: "历史新高",
    marketCap: "市值",
    fdv: "完全稀释市值",
    before: "之前",
    after: "之后",

    // Geopolitical terms
    russia: "俄罗斯",
    ukraine: "乌克兰",
    israel: "以色列",
    iran: "伊朗",
    hamas: "哈马斯",
    ceasefire: "停火",
    putin: "普京",
    zelenskyy: "泽连斯基",
    trumpMarket: "特朗普",
    meet: "会面",

    // Economic terms
    fed: "美联储",
    meeting: "会议",
    chair: "主席",
    decision: "决定",
    jeromePowelll: "杰罗姆·鲍威尔",
    rate: "利率",
    cut: "降息",
    us: "美国",
    recession: "衰退",
    inflation: "通胀",

    // Additional UI text
    removeFromWatchlist: "💔 从观察列表移除",
    watchlist: "观察列表",
    from: "从",

    // High Probability Market Data
    foundMarkets: "找到市场",
    qualifyingMarketsText: "符合条件的市场",

    // Market data labels
    volumeShort: "成交量",
    timeLeft: "剩余",
    notAvailable: "不可用",

    // Filter status
    noCrypto: "❌ 不包含加密货币",
    includeCrypto: "✅ 包含加密货币",
    alertsOn: "🔔 提醒开启",
    alertsOff: "🔕 提醒关闭",

    // Strategy button texts
    degenStrategyButton: "🔥 激进策略 (70-85%)",
    turtleStrategyButton: "🐢 保守策略 (85.5-97.5%)",

    // Profile page texts
    yourPolymarketProfile: "您的Polymarket档案",
    lifetimePnl: "终身盈亏:",
    totalHoldings: "总持仓:",
    winRate: "胜率:",
    yourReferralCode: "您的推荐码:",
    viewOnPolymarket: "🔗 在Polymarket查看",
    notAssigned: "未分配",
    health: "健康",
    // High-probability market messages
    noMarketsFoundMatching: "未找到匹配的市场",
    possibleReasons: "可能的原因:",
    marketsExpiredRecently: "市场可能刚刚到期或关闭",
    cryptoMightBeExcluded: "加密货币市场可能在您的筛选条件中被排除",
    tryLongerTimeFrame: "尝试更长的时间范围（4小时、24小时或48小时）",
    adjustProbabilityRanges: "在筛选设置中调整概率范围",
    quickActions: "快速操作:",
    includeCryptoMarkets: "🪙 包含加密货币",

    // Order and alert messages
    priceAlertSetSuccessfully: "🔔 价格提醒设置成功！",
    marketLabel: "市场:",
    side: "方向:",
    alertAtPrice: "提醒价格:",
    notificationWhenMet: "当条件满足时，您将收到通知。",
    enterOrderDetails: "输入您的订单详情:",
    formatExample: "格式: <价格> <金额>\n示例: 0.65 100",
    priceDescription: "价格: 您想要支付的限价",
    amountDescription: "金额: 您想要以此限价花费的美元金额",
    minimumAmount: "注意: 金额 / 价格 应至少为 10",

    // Bot command descriptions
    cmdStart: "开始使用并了解此机器人的功能",
    cmdSubscriptions: "查看和管理您的市场订阅",
    cmdTrade: "手动下市价单",
    cmdAutotrade: "启用或配置钱包跟单交易",
    cmdFund: "更新钱包或通知设置等偏好",
    cmdHistory: "查看您的交易历史",
    cmdPortfolio: "查看您的投资组合",
    cmdManage: "管理您的开放限价单",
    cmdStats: "查看您的交易统计",
    cmdWatchlist: "查看您的收藏市场列表",
    cmdHighprob: "交易高概率市场（1小时-48小时时间框架）",
    cmdRef: "查看推荐统计并分享您的推荐链接",
    cmdAnalytics: "查看活跃用户分析（仅限管理员）",
    cmdDetailed: "查看详细分析仪表板（仅限管理员）",
    cmdRedeem: "從已解決的市場部位贖回",
    cmdHealth: "检查机器人的运行状态",
    // Hourly Market Specific
    priceToBeat: "目标价格",
    currentPrice: "当前价格",

    // AutoTrade Menu
    autoTradeMenu: "自动交易菜单",
    monitoring: "监控",
    wallets: "钱包",
    selectAction: "选择操作:",
    enableCopyTrade: "启用跟单交易",
    disableCopyTrade: "禁用跟单交易",

    // Watched Wallets View
    watchedWalletsTitle: "👀 监控钱包",
    noWalletsAdded: "尚未添加钱包。",
    configurePosition: "⚙️ 配置仓位",
    backToAutoTrade: "↩️ 返回自动交易",
    enabled: "启用",
    disabled: "禁用",

    // Additional AutoTrade translations
    addWalletTitle: "🧾 添加钱包地址",
    addWalletDescription: "请输入您要监控的钱包地址：",
    walletMonitoringEnabled: "✅ 钱包监控已启用",
    walletMonitoringDisabled: "❌ 钱包监控已禁用",
    copyTradingEnabled: "✅ 跟单交易已启用",
    copyTradingDisabled: "❌ 跟单交易已禁用",
    copyTradingEnabledMessage: "✅ 跟单交易已启用。您现在将自动跟随监控钱包的交易。",
    copyTradingDisabledMessage: "❌ 跟单交易已禁用。您仍会收到通知，但不会跟随交易。",
    configurePositionForWallet: "💰 配置钱包仓位百分比",
    configureWalletPositionTitle: "💰 配置钱包仓位百分比",
    selectWalletToConfigurePosition: "选择要配置仓位百分比的钱包：",
    noWalletsAddedYet: "⚠️ 尚未添加钱包。请先添加钱包。",
    globalCopyTraderPositionTitle: "💰 全局跟单交易仓位百分比",
    setDefaultPositionPercentage: "设置新钱包的默认仓位百分比：",
    currentDefault: "📊 当前默认：",
    defaultNotSet: "默认（未设置）",
    individualWalletOverride: "注意：单个钱包百分比会覆盖此默认设置。",
    insufficientSolBalance: "SOL余额不足。",
    youHaveSol: "您有",
    butNeedAtLeast: "SOL，但至少需要",
    solToBridge: "SOL才能进行桥接。",
    butNeedToKeep: "SOL，但需要保留",
    solForFees: "SOL作为手续费。",
    notEnoughLeftToBridge: "剩余不足以进行桥接。",
    shortage: "缺少：",

    // Market Order Interface
    marketOrderYes: "⚡ 市价单 - 看涨",
    marketOrderNo: "⚡ 市价单 - 看跌",
    enterAmountInUsdc: "输入您要花费的USDC金额：",
    formatAmount: "格式：<金额>",
    exampleAmount: "示例：50",
    minimumAmountNote: "注意：最小金额应为10",
    currentMarketPrice: "💵 当前市场价格：",
    avgOfTopOrders: "（前3个订单的平均值）",
    willExecuteImmediately: "🚀 将立即以市场价格执行",
    estimatedFill: "预计成交：",
    executionPrice: "• 执行价格：",
    totalCost: "• 总成本：",
    potentialWinIfResolves: "• 如果结果为{CONDITION}的潜在收益：",
    pressConfirmOrCancel: "按确认下单或取消。",

    // Order Confirmation
    buyOrderPlaced: "✅ 您的买单已下达！",
    matched: "已成交",
    viewOnPolygonscan: "在Polygonscan上查看",

    // Subscription Interface
    noActiveSubscriptions: "⚠️ 您没有活跃的订阅。",
    enterCustomCategory: "✍️ 输入自定义类别",
    exampleCategories: "示例：bitcoin或video-games",
    chooseCategoryToSubscribe: "选择要订阅的类别",

    // Subscription Alerts
    youWillReceiveAlertsFor: "📬 您现在将收到以下内容的提醒：",
    alertsRemovedFor: "🗑️ 已移除提醒：",
    chooseCategoryToUnsubscribe: "选择要取消订阅的类别",
    noActivePriceAlerts: "📭 未找到活跃的价格提醒。",
    priceAlertNumber: "🔔 价格提醒",
    outcome: "结果：",
    triggerPrice: "触发价格：",
    willBeNotifiedWhen: "当满足此条件时，您将收到通知。",
    editAlert: "✏️ 编辑提醒",
    deleteAlert: "🗑️ 删除提醒",

    // Edit Price Alert flow
    editPriceAlertTitle: "✏️ <b>编辑 价格 提示</b>",
    editPriceAlertMarketLabel: "<b>市场：</b>",
    editPriceAlertCurrentTrigger: "<b>当前触发价：</b>",
    editPriceAlertPrompt: "请为此提醒发送一个新的价格（介于 0 和 1 之间）。",

    // Set Price Alert flow
    setPriceAlertTitle: "🔔 <b>为此市场设置价格提醒</b>",
    setPriceAlertEnterDetails: "请输入以下 <b>价格</b> 和 <b>方向</b>：",
    setPriceAlertFormat: "格式: <code>价格</code> <code>是/否</code>",
    setPriceAlertExample: "示例: <code>0.7</code> <code>否</code>",

    // Portfolio Command Translations
    noWalletLinked: "⚠️ 您的账户未关联钱包地址！",
    generatingPortfolioCard: "⚡ 正在生成您的投资组合卡片...",
    noActivePositionsForCard: "📭 未找到活跃头寸来生成投资组合卡片。",
    portfolioSummaryFor: "📊 投资组合摘要",
    yourPolymarketDashboard: "📊 您的 Polymarket 仪表板",
    profit: "盈利",
    loss: "亏损",
    invested: "投资",
    value: "价值",
    expires: "到期",
    sellFiftyPercent: "卖出 50%",
    sellHundredPercent: "卖出 100%",
    sellCustom: "自定义卖出",
    buyMoreMarket: "市价买入更多",
    buyMoreLimit: "限价买入更多",
    cancelTakeProfit: "❌ 取消止盈",
    cancelStopLoss: "❌ 取消止损",
    generatePortfolioCard: "⚡ 生成投资组合卡片",
    redeemableDashboard: "您的可贖回倉位",

    // Portfolio refresh messages
    noLinkedWallet: "⚠️ 未关联钱包。",
    invalidIndex: "⚠️ 无效索引。",
    pageNotFound: "未找到页面",

    // Subscription action messages
    subscriptionAdded: "📬 您现在将收到以下提醒：",
    subscriptionRemoved: "🗑️ 已移除以下提醒：",

    // 0DTE and hourly market labels
    volumeLabel: "💧 交易量：",
    timeLeftLabel: "⌛ 剩余时间：",
    endsLabel: "⌛ 结束时间：",
    marketsAvailable: "可用市场",
    minutesShort: "分钟",

    // Error messages for markets
    noActiveMarketsInEvent: "❌ 此事件中没有活跃的市场。",
    noAvailableZeroDteMarkets: "⚠️ 没有可用的0DTE市场！",

    // Watchlist messages
    watchlistEmpty: "❤️ 您的观察列表为空",
    watchlistEmptyDescription: "将市场添加到您的观察列表以便轻松跟踪。",
    addToWatchlistInstruction: "您可以在查看任何市场时点击'❤️ 添加到我的观察列表'按钮来添加市场。",
    yourWatchlist: "❤️ 您的观察列表",
    errorFetchingWatchlist: "❌ 获取观察列表时出错。请稍后重试。",
    watchlistErrorGeneral: "❌ 获取观察列表时发生错误。请稍后重试。",
    unableToDisplayMarkets: "无法显示市场。请稍后重试。",
    pricesRefreshForLatest: "价格：*刷新获取最新价格*",
    unknownMarket: "未知市场",
    unknownEndDate: "未知",
};
