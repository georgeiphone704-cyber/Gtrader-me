class StatisticsEngine {

    constructor(memory) {
        this.memory = memory;
    }

    analyze() {

        const digits = this.memory.digits;

        if (digits.length < 50) {
            return {
                module: "statistics",
                score: 0,
                average: 0,
                trend: "UNKNOWN",
                volatility: 0,
                success: false
            };
        }

        const last50 = digits.slice(-50);

        const average =
            last50.reduce((sum, digit) => sum + digit, 0) / last50.length;

        const firstHalf =
            last50.slice(0, 25).reduce((a, b) => a + b, 0) / 25;

        const secondHalf =
            last50.slice(25).reduce((a, b) => a + b, 0) / 25;

        const trend =
            secondHalf > firstHalf
                ? "UP"
                : secondHalf < firstHalf
                ? "DOWN"
                : "SIDEWAYS";

        const variance =
            last50.reduce(
                (sum, value) => sum + Math.pow(value - average, 2),
                0
            ) / last50.length;

        const volatility = Math.sqrt(variance);

        let score = 100 - Math.round(volatility * 10);

        score = Math.max(0, Math.min(score, 100));

        return {
            module: "statistics",
            score,
            average: Number(average.toFixed(2)),
            trend,
            volatility: Number(volatility.toFixed(2)),
            success: true
        };
    }
}

window.statisticsEngine = StatisticsEngine;
