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

    // High Probability Command specific
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
    bridgeFunds: "🌉 跨链转账",

    // Trading
    marketOrder: "⚡ 市价单",
    limitOrder: "🎯 限价单",
    setPriceAlert: "🔔 设置价格提醒",
    takeProfit: "💸 止盈",
    stopLoss: "🛑 止损",

    // Messages
    welcome: `欢迎使用Predictify
我们以头条新闻为早餐。📰⚔
您的钱包已激活。让我们开始吧。`,
    walletReset: "✅ 钱包重置成功",
    orderCancelled: "✅ 订单已取消！",
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
    shares: "份额",
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
    addWallet: "添加钱包",
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
};
