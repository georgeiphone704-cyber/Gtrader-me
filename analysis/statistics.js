class StatisticsEngine {

    constructor(memory) {
        this.memory = memory;
    }

    analyze() {

        const totalTicks = this.memory.digits.length;
        const frequencies = this.memory.frequencies;

        if (totalTicks === 0) {

            return {
                module: "statistics",
                score: 0,
                totalTicks: 0,
                averageFrequency: 0,
                highestFrequency: 0,
                lowestFrequency: 0,
                success: false
            };

        }

        const averageFrequency = Number((totalTicks / 10).toFixed(2));
        const highestFrequency = Math.max(...frequencies);
        const lowestFrequency = Math.min(...frequencies);

        let score = 100 - ((highestFrequency - lowestFrequency) * 2);

        score = Math.max(0, Math.min(100, score));

        return {

            module: "statistics",

            score,

            totalTicks,

            averageFrequency,

            highestFrequency,

            lowestFrequency,

            success: true

        };

    }

}

window.statisticsEngine = StatisticsEngine;
