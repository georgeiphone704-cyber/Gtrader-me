class PerformanceEngine {
    constructor() {
        this.enabled = true;
        this.maxHistory = 1000;

        this.trades = [];

        this.stats = this.emptyStats();

        this.byMarket = {};
        this.byConfidence = {
            "90-92": this.emptyStats(),
            "93-95": this.emptyStats(),
            "96-100": this.emptyStats()
        };

        this.lastResult = null;
    }

    emptyStats() {
        return {
            total: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            profit: 0,
            averageProfit: 0,
            consecutiveWins: 0,
            consecutiveLosses: 0,
            maxConsecutiveLosses: 0,
            peakProfit: 0,
            maxDrawdown: 0
        };
    }

    recordTrade(trade = {}) {
        if (!this.enabled) {
            return {
                success: false,
                reason: "Performance tracking disabled"
            };
        }

        const result = String(
            trade.result || ""
        ).toUpperCase();

        if (result !== "WIN" && result !== "LOSS") {
            return {
                success: false,
                reason: "Result must be WIN or LOSS"
            };
        }

        const profit = Number(trade.profit);

        if (!Number.isFinite(profit)) {
            return {
                success: false,
                reason: "Invalid profit"
            };
        }

        const record = {
            id: trade.id || this.createId(),
            market: trade.market || "UNKNOWN",
            confidence: Number(trade.confidence) || 0,
            result,
            profit,
            timestamp: Date.now()
        };

        this.trades.push(record);

        if (this.trades.length > this.maxHistory) {
            this.trades.shift();
        }

        this.recalculate();

        this.lastResult = {
            success: true,
            recorded: record,
            stats: this.getStats()
        };

        return this.lastResult;
    }

    recalculate() {
        this.stats = this.calculateStats(this.trades);

        this.byMarket = {};
        this.byConfidence = {
            "90-92": this.emptyStats(),
            "93-95": this.emptyStats(),
            "96-100": this.emptyStats()
        };

        for (const trade of this.trades) {
            const market =
                trade.market || "UNKNOWN";

            if (!this.byMarket[market]) {
                this.byMarket[market] =
                    this.emptyStats();
            }

            this.addToStats(
                this.byMarket[market],
                trade
            );

            const bucket =
                this.getConfidenceBucket(
                    trade.confidence
                );

            if (bucket) {
                this.addToStats(
                    this.byConfidence[bucket],
                    trade
                );
            }
        }

        this.finalizeGroupedStats();
    }

    calculateStats(trades) {
        const stats = this.emptyStats();

        let runningProfit = 0;
        let currentWins = 0;
        let currentLosses = 0;

        for (const trade of trades) {
            this.addToStats(stats, trade);

            runningProfit += trade.profit;

            if (runningProfit > stats.peakProfit) {
                stats.peakProfit = runningProfit;
            }

            const drawdown =
                stats.peakProfit - runningProfit;

            if (drawdown > stats.maxDrawdown) {
                stats.maxDrawdown = drawdown;
            }

            if (trade.result === "WIN") {
                currentWins++;
                currentLosses = 0;
            } else {
                currentLosses++;
                currentWins = 0;
            }

            if (
                currentLosses >
                stats.maxConsecutiveLosses
            ) {
                stats.maxConsecutiveLosses =
                    currentLosses;
            }
        }

        stats.consecutiveWins = currentWins;
        stats.consecutiveLosses = currentLosses;

        this.finalizeStats(stats);

        return stats;
    }

    addToStats(stats, trade) {
        stats.total++;

        if (trade.result === "WIN") {
            stats.wins++;
        }

        if (trade.result === "LOSS") {
            stats.losses++;
        }

        stats.profit +=
            Number(trade.profit) || 0;
    }

    finalizeStats(stats) {
        if (stats.total > 0) {
            stats.winRate =
                Number(
                    (
                        (stats.wins / stats.total) *
                        100
                    ).toFixed(2)
                );

            stats.averageProfit =
                Number(
                    (
                        stats.profit /
                        stats.total
                    ).toFixed(8)
                );
        }

        stats.profit =
            Number(stats.profit.toFixed(8));

        stats.averageProfit =
            Number(stats.averageProfit.toFixed(8));

        stats.peakProfit =
            Number(stats.peakProfit.toFixed(8));

        stats.maxDrawdown =
            Number(stats.maxDrawdown.toFixed(8));
    }

    finalizeGroupedStats() {
        for (const market
