class LearningEngine {

    constructor() {
        this.history = [];
        this.maxHistory = 1000;

        this.stats = {
            total: 0,
            wins: 0,
            losses: 0,
            winRate: 0
        };
    }

    analyze(decision) {
        if (!decision) return null;

        const record = {
            time: Date.now(),
            signal: decision.signal || "NONE",
            confidence: Number(decision.confidence) || 0,
            prediction: decision.prediction ?? null,
            result: null,
            outcome: "PENDING"
        };

        this.history.push(record);

        this.limitHistory();

        return {
            module: "learning",
            stored: this.history.length,
            winRate: this.stats.winRate,
            pending: this.getPendingCount(),
            success: true
        };
    }

    recordResult(result) {
        if (!result) return null;

        const outcome = String(result.outcome || "").toUpperCase();

        if (outcome !== "WIN" && outcome !== "LOSS") {
            return {
                success: false,
                reason: "Invalid outcome"
            };
        }

        const record = this.findLatestPending(result);

        if (!record) {
            return {
                success: false,
                reason: "No matching pending decision"
            };
        }

        record.result = result.result ?? null;
        record.outcome = outcome;

        this.updateStats();

        return {
            success: true,
            outcome,
            winRate: this.stats.winRate,
            total: this.stats.total
        };
    }

    findLatestPending(result) {
        if (result.id !== undefined) {
            const match = this.history.find(
                item =>
                    item.outcome === "PENDING" &&
                    item.id === result.id
            );

            if (match) return match;
        }

        for (let i = this.history.length - 1; i >= 0; i--) {
            if (this.history[i].outcome === "PENDING") {
                return this.history[i];
            }
        }

        return null;
    }

    updateStats() {
        let wins = 0;
        let losses = 0;

        for (const record of this.history) {
            if (record.outcome === "WIN") wins++;
            if (record.outcome === "LOSS") losses++;
        }

        const total = wins + losses;

        this.stats.wins = wins;
        this.stats.losses = losses;
        this.stats.total = total;

        this.stats.winRate =
            total > 0
                ? Number(((wins / total) * 100).toFixed(2))
                : 0;
    }

    getPerformance(signal = null) {
        const completed = this.history.filter(
            item =>
                item.outcome === "WIN" ||
                item.outcome === "LOSS"
        );

        const filtered = signal
            ? completed.filter(item => item.signal === signal)
            : completed;

        let wins = 0;
        let losses = 0;

        for (const record of filtered) {
            if (record.outcome === "WIN") wins++;
            if (record.outcome === "LOSS") losses++;
        }

        const total = wins + losses;

        return {
            signal: signal || "ALL",
            total,
            wins,
            losses,
            winRate:
                total > 0
                    ? Number(((wins / total) * 100).toFixed(2))
                    : 0
        };
    }

    getRecentPerformance(count = 50) {
        const completed = this.history
            .filter(
                item =>
                    item.outcome === "WIN" ||
                    item.outcome === "LOSS"
            )
            .slice(-count);

        let wins = 0;
        let losses = 0;

        for (const record of completed) {
            if (record.outcome === "WIN") wins++;
            if (record.outcome === "LOSS") losses++;
        }

        const total = wins + losses;

        return {
            sample: total,
            wins,
            losses,
            winRate:
                total > 0
                    ? Number(((wins / total) * 100).toFixed(2))
                    : 0
        };
    }

    getPendingCount() {
        return this.history.filter(
            item => item.outcome === "PENDING"
        ).length;
    }

    limitHistory() {
        while (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }

    getHistory() {
        return this.history;
    }

    getStats() {
        return {
            ...this.stats,
            pending: this.getPendingCount()
        };
    }

    reset() {
        this.history = [];

        this.stats = {
            total: 0,
            wins: 0,
            losses: 0,
            winRate: 0
        };
    }
}

window.learningEngine = new LearningEngine();
