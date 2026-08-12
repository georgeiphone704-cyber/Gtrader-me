class StatisticsEngine {

    constructor() {
        this.name = "statistics";

        this.minSamples = 30;
        this.maxSamples = 300;

        this.lastResult = {
            module: this.name,
            success: false,
            score: 0,
            confidence: 0,
            mean: 0,
            variance: 0,
            standardDeviation: 0,
            samples: 0,
            recommendation: "COLLECTING DATA"
        };
    }

    normalizeDigits(digits) {
        if (!Array.isArray(digits)) {
            return [];
        }

        return digits
            .map(Number)
            .filter(
                digit =>
                    Number.isInteger(digit) &&
                    digit >= 0 &&
                    digit <= 9
            );
    }

    calculateMean(data) {
        if (data.length === 0) {
            return 0;
        }

        const total =
            data.reduce(
                (sum, value) => sum + value,
                0
            );

        return total / data.length;
    }

    calculateVariance(data, mean) {
        if (data.length === 0) {
            return 0;
        }

        const squaredDeviation =
            data.reduce(
                (sum, value) =>
                    sum + Math.pow(value - mean, 2),
                0
            );

        /*
         * Population variance is used because the
         * current tick window is treated as the complete
         * observation set being analyzed.
         */
        return squaredDeviation / data.length;
    }

    calculateStandardDeviation
