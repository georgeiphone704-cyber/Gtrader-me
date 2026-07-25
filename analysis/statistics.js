class StatisticsEngine {

    constructor(memory) {
        this.memory = memory;
    }

    calculate() {

        const total = this.memory.digits.length;

        if (total === 0) {

            return {
                totalTicks: 0,
                averageFrequency: 0,
                highestFrequency: 0,
                lowestFrequency: 0
            };

        }

        const frequencies = this.memory.frequencies;

        return {

            totalTicks: total,

            averageFrequency:
                Number((total / 10).toFixed(2)),

            highestFrequency:
                Math.max(...frequencies),

            lowestFrequency:
                Math.min(...frequencies)

        };

    }

}
