import type { LocaleMessages } from "../types";

export const zh: LocaleMessages = {
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
};
