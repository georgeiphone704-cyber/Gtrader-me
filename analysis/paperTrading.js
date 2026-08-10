class PaperTradingEngine {
    constructor() {
        this.enabled = true;
        this.startingBalance = 100;
        this.balance = this.startingBalance;

        this.tradeHistory = [];
        this.maxHistory = 1000;

        this.stats = {
            total: 0,
            wins: 0,
            losses: 0,
            profit: 0,
            winRate: 0,
            consecutiveWins: 0,
            consecutiveLosses: 0,
            maxConsecutiveLosses: 0,
            peakBalance: this.balance,
            maxDrawdown: 0
        };

        this.activeTrade = null;
        this.lastResult = null;
    }

    enable() {
        this.enabled = true;
        return this.getStatus();
    }

    disable() {
        this.enabled = false;
        return this.getStatus();
    }

    execute(signal, options = {}) {
        if (!this.enabled) {
            return this.reject("Paper trading disabled");
        }

        if (this.activeTrade) {
            return this.reject("A paper trade is already active");
        }

        if (!signal || signal.action !== "ENTRY_READY") {
            return this.reject("Entry signal not confirmed");
        }

        const stake = Number(options.stake ?? 0.20);

        if (!Number.isFinite(stake) || stake <= 0) {
            return this.reject("Invalid stake");
        }

        if (stake > this.balance) {
            return this.reject("Insufficient paper balance");
        }

        const trade = {
            id: this.createId(),
            market: options.market || "UNKNOWN",
            contract: options.contract || "DIGITDIFF",
            prediction: options.prediction ?? null,
            direction: signal.direction || null,

            stake,

            confidence: Number(signal.confidence) || 0,
            agreement: Number(signal.agreement) || 0,

            status: "OPEN",
            result: null,
            profit: 0,

            openedAt: Date.now(),
            closedAt: null
        };

        this.activeTrade = trade;

        this.lastResult = {
            action: "PAPER_TRADE_OPENED",
            success: true,
            trade: { ...trade }
        };

        return this.lastResult;
    }

    settle(result, payout = 0) {
        if (!this.activeTrade) {
            return {
                success: false,
                reason: "No active paper trade"
            };
        }

        const outcome = String(result).toUpperCase();

        if (outcome !== "WIN" && outcome !== "LOSS") {
            return {
                success: false,
                reason: "Result must be WIN or LOSS"
            };
        }

        const trade = this.activeTrade;

        let profit;

        if (outcome === "WIN") {
            const payoutValue = Number(payout);

            if (!Number.isFinite(payoutValue) || payoutValue < 0) {
                return {
                    success: false,
                    reason: "Invalid payout"
                };
            }

            profit = payoutValue;
        } else {
            profit = -trade.stake;
        }

        this.balance += profit;

        trade.result = outcome;
        trade.profit = Number(profit.toFixed(8));
        trade.status = "CLOSED";
        trade.closedAt = Date.now();

        this.tradeHistory.push({ ...trade });

        if (this.tradeHistory.length > this.maxHistory) {
            this.tradeHistory.shift();
        }

        this.activeTrade = null;

        this.updateStats();

        this.lastResult = {
            action: "PAPER_TRADE_CLOSED",
            success: true,
            outcome,
            profit: trade.profit,
            balance: Number(this.balance.toFixed(8)),
            stats: this.getStats()
        };

        return this.lastResult;
    }

    reject(reason) {
        this.lastResult = {
            action: "WAIT",
            success: false,
            reason
        };

        return this.lastResult;
    }

    updateStats() {
        let wins = 0;
        let losses = 0;
        let profit = 0;

        for (const trade of this.tradeHistory) {
            if (trade.result === "WIN") wins++;
            if (trade.result === "LOSS") losses++;

            profit += Number(trade.profit) || 0;
        }

        const total = wins + losses;

        this.stats.total = total;
        this.stats.wins = wins;
        this.stats.losses = losses;
        this.stats.profit = Number(profit.toFixed(8));

        this.stats.winRate =
            total > 0
                ? Number(((wins / total) * 100).toFixed(2))
                : 0;

        this.calculateStreaks();

        if (this.balance > this.stats.peakBalance) {
            this.stats.peakBalance = this.balance;
        }

        const drawdown =
            this.stats.peakBalance - this.balance;

        this.stats.maxDrawdown =
            Number(
                Math.max(
                    this.stats.maxDrawdown,
                    drawdown
                ).toFixed(8)
            );
    }

    calculateStreaks() {
        let currentWins = 0;
        let currentLosses = 0;
        let maxLosses = 0;

        for (const trade of this.tradeHistory) {
            if (trade.result === "WIN") {
                currentWins++;
                currentLosses = 0;
            }

            if (trade.result === "LOSS") {
                currentLosses++;
                currentWins = 0;

                if (currentLosses > maxLosses) {
                    maxLosses = currentLosses;
                }
            }
        }

        this.stats.consecutiveWins = currentWins;
        this.stats.consecutiveLosses = currentLosses;
        this.stats.maxConsecutiveLosses = maxLosses;
    }

    createId() {
        return (
            "P-" +
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .slice(2, 8)
        );
    }

    getStats() {
        return {
            ...this.stats,
            balance: Number(this.balance.toFixed(8)),
            activeTrade: !!this.activeTrade
        };
    }

    getHistory() {
        return [...this.tradeHistory];
    }

    get
