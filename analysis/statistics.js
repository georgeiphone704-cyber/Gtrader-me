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

    calculateStandardDeviation(variance) {
        return Math.sqrt(
            Math.max(0, variance)
        );
    }

    calculateFrequency(data) {
        const frequency =
            Array(10).fill(0);

        for (const digit of data) {
            frequency[digit]++;
        }

        return frequency;
    }

    calculateEntropy(data) {
        if (data.length === 0) {
            return 0;
        }

        const frequency =
            this.calculateFrequency(data);

        let entropy = 0;

        for (const count of frequency) {

            if (count === 0) {
                continue;
            }

            const probability =
                count / data.length;

            entropy -=
                probability *
                Math.log2(probability);
        }

        return entropy;
    }

    calculateBalance(data) {
        if (data.length === 0) {
            return 0;
        }

        let even = 0;
        let odd = 0;

        for (const digit of data) {
            if (digit % 2 === 0) {
                even++;
            } else {
                odd++;
            }
        }

        return {
            even,
            odd,
            evenRate:
                even / data.length,
            oddRate:
                odd / data.length
        };
    }

    calculateLowHighBalance(data) {
        if (data.length === 0) {
            return {
                low: 0,
                high: 0,
                lowRate: 0,
                highRate: 0
            };
        }

        let low = 0;
        let high = 0;

        for (const digit of data) {

            if (digit <= 4) {
                low++;
            } else {
                high++;
            }
        }

        return {
            low,
            high,
            lowRate:
                low / data.length,
            highRate:
                high / data.length
        };
    }

    calculateRange(data) {
        if (data.length === 0) {
            return 0;
        }

        const minimum =
            Math.min(...data);

        const maximum =
            Math.max(...data);

        return maximum - minimum;
    }

    calculateRecentMean(data) {
        const recentSize =
            Math.min(50, data.length);

        const recent =
            data.slice(-recentSize);

        return this.calculateMean(recent);
    }

    calculateMeanShift(data) {
        if (data.length < 40) {
            return 0;
        }

        const recentSize =
            Math.min(20, Math.floor(data.length / 2));

        const recent =
            data.slice(-recentSize);

        const historical =
            data.slice(
                -(recentSize * 2),
                -recentSize
            );

        const recentMean =
            this.calculateMean(recent);

        const historicalMean =
            this.calculateMean(historical);

        return recentMean - historicalMean;
    }

    /*
     * Measures how far the current distribution is
     * from the ideal uniform ten-digit baseline.
     *
     * This is a descriptive statistic, NOT evidence
     * that the next digit will follow the imbalance.
     */
    calculateDistributionDeviation(data) {

        if (data.length === 0) {
            return 0;
        }

        const frequency =
            this.calculateFrequency(data);

        const expected =
            data.length / 10;

        let deviation = 0;

        for (let digit = 0; digit < 10; digit++) {

            deviation +=
                Math.abs(
                    frequency[digit] -
                    expected
                );
        }

        /*
         * Normalize into approximately 0-1.
         */
        const normalized =
            deviation /
            (data.length * 2);

        return Math.max(
            0,
            Math.min(
                1,
                normalized
            )
        );
    }

    /*
     * Converts descriptive statistical evidence
     * into a conservative module score.
     *
     * It does NOT treat statistical imbalance as
     * guaranteed predictability.
     */
    calculateScore(
        distributionDeviation,
        meanShift,
        entropy,
        sampleSize
    ) {

        const deviationComponent =
            Math.min(
                1,
                distributionDeviation
            );

        const shiftComponent =
            Math.min(
                1,
                Math.abs(meanShift) / 2
            );

        /*
         * Maximum entropy for ten equally likely
         * digits is log2(10) ≈ 3.322.
         *
         * Lower entropy means more concentration.
         */
        const maxEntropy =
            Math.log2(10);

        const concentration =
            Math.max(
                0,
                Math.min(
                    1,
                    1 -
                    (entropy / maxEntropy)
                )
            );

        const sampleFactor =
            Math.min(
                1,
                sampleSize / this.maxSamples
            );

        const score =
            (
                deviationComponent * 0.35
            ) +
            (
                shiftComponent * 0.20
            ) +
            (
                concentration * 0.25
            ) +
            (
                sampleFactor * 0.20
            );

        return Math.max(
            0,
            Math.min(
                1,
                score
            )
        );
    }

    calculateConfidence(score) {

        if (score <= 0) {
            return 0;
        }

        /*
         * Conservative confidence ceiling.
         * Statistical irregularity alone should not
         * create an automatic high-confidence trade.
         */
        return Number(
            Math.min(
                100,
                score * 100
            ).toFixed(2)
        );
    }

    analyze(digits = []) {

        const data =
            this.normalizeDigits(digits)
                .slice(-this.maxSamples);

        if (
            data.length <
            this.minSamples
        ) {

            this.lastResult = {
                module: this.name,
                success: false,
                score: 0,
                confidence: 0,
                mean: 0,
                variance: 0,
                standardDeviation: 0,
                samples: data.length,
                recommendation:
                    "COLLECTING DATA",
                reason:
                    "Insufficient statistical data"
            };

            return this.lastResult;
        }

        const mean =
            this.calculateMean(data);

        const variance =
            this.calculateVariance(
                data,
                mean
            );

        const standardDeviation =
            this.calculateStandardDeviation(
                variance
            );

        const entropy =
            this.calculateEntropy(data);

        const balance =
            this.calculateBalance(data);

        const lowHigh =
            this.calculateLowHighBalance(data);

        const range =
            this.calculateRange(data);

        const recentMean =
            this.calculateRecentMean(data);

        const meanShift =
            this.calculateMeanShift(data);

        const distributionDeviation =
            this.calculateDistributionDeviation(
                data
            );

        const score =
            this.calculateScore(
                distributionDeviation,
                meanShift,
                entropy,
                data.length
            );

        const confidence =
            this.calculateConfidence(score);

        let recommendation =
            "WAIT";

        if (
            confidence >= 85 &&
            score >= 0.40
        ) {

            recommendation =
                "STRONG STATISTICAL SIGNAL";

        } else if (
            confidence >= 70 &&
            score >= 0.25
        ) {

            recommendation =
                "WATCH";

        } else if (
            confidence >= 50 &&
            score >= 0.15
        ) {

            recommendation =
                "WEAK SIGNAL";
        }

        /*
         * Important:
         * Statistics describes the data.
         * It does not independently select a trade.
         */
        this.lastResult = {

            module: this.name,

            success: true,

            score:
                Number(
                    (score * 100)
                        .toFixed(2)
                ),

            confidence,

            samples:
                data.length,

            mean:
                Number(
                    mean.toFixed(4)
                ),

            variance:
                Number(
                    variance.toFixed(4)
                ),

            standardDeviation:
                Number(
                    standardDeviation.toFixed(4)
                ),

            recentMean:
                Number(
                    recentMean.toFixed(4)
                ),

            meanShift:
                Number(
                    meanShift.toFixed(4)
                ),

            entropy:
                Number(
                    entropy.toFixed(4)
                ),

            range,

            distributionDeviation:
                Number(
                    (
                        distributionDeviation * 100
                    ).toFixed(2)
                ),

            even:
                balance.even,

            odd:
                balance.odd,

            evenRate:
                Number(
                    (
                        balance.evenRate * 100
                    ).toFixed(2)
                ),

            oddRate:
                Number(
                    (
                        balance.oddRate * 100
                    ).toFixed(2)
                ),

            low:
                lowHigh.low,

            high:
                lowHigh.high,

            lowRate:
                Number(
                    (
                        lowHigh.lowRate * 100
                    ).toFixed(2)
                ),

            highRate:
                Number(
                    (
                        lowHigh.highRate * 100
                    ).toFixed(2)
                ),

            recommendation
        };

        return this.lastResult;
    }

    getResult() {
        return this.lastResult;
    }

    reset() {

        this.lastResult = {
            module: this.name,
            success: false,
            score: 0,
            confidence: 0,
            mean: 0,
            variance: 0,
            standardDeviation: 0,
            samples: 0,
            recommendation:
                "COLLECTING DATA"
        };
    }
}

window.StatisticsEngine =
    StatisticsEngine;

window.statisticsEngine =
    new StatisticsEngine();
