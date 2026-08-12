class ProbabilityEngine {

    constructor() {
        this.name = "probability";

        this.minSamples = 30;
        this.maxSamples = 300;

        this.recentWindow = 50;
        this.smoothing = 1;

        this.lastResult = {
            module: this.name,
            success: false,
            prediction: null,
            digit: null,
            probability: 0,
            score: 0,
            confidence: 0,
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

    calculateDistribution(data) {
        const counts = Array(10).fill(0);

        for (const digit of data) {
            counts[digit]++;
        }

        const denominator =
            data.length +
            (this.smoothing * 10);

        return counts.map(
            count =>
                (count + this.smoothing) /
                denominator
        );
    }

    getBestDigit(probabilities) {
        let bestDigit = 0;
        let bestProbability = 0;

        for (let digit = 0; digit < 10; digit++) {
            if (
                probabilities[digit] >
                bestProbability
            ) {
                bestProbability =
                    probabilities[digit];

                bestDigit = digit;
            }
        }

        return {
            digit: bestDigit,
            probability: bestProbability
        };
    }

    calculateStrength(probability) {
        /*
         * A fair ten-digit baseline is approximately 10%.
         *
         * This is MODEL STRENGTH, not a guaranteed
         * probability of winning the next contract.
         */
        const baseline = 0.10;

        if (probability <= baseline) {
            return 0;
        }

        const strength =
            (probability - baseline) /
            (1 - baseline);

        return Math.max(
            0,
            Math.min(1, strength)
        );
    }

    calculateConfidence(
        strength,
        sampleSize
    ) {
        if (strength <= 0) {
            return 0;
        }

        const sampleFactor =
            Math.min(
                1,
                sampleSize / this.maxSamples
            );

        /*
         * Keep confidence conservative.
         */
        const confidence =
            strength *
            100 *
            (
                0.70 +
                (0.30 * sampleFactor)
            );

        return Number(
            Math.min(
                100,
                confidence
            ).toFixed(2)
        );
    }

    analyze(digits = []) {

        const data =
            this.normalizeDigits(digits)
                .slice(-this.maxSamples);

        if (data.length < this.minSamples) {

            this.lastResult = {
                module: this.name,
                success: false,
                prediction: null,
                digit: null,
                probability: 0,
                score: 0,
                confidence: 0,
                samples: data.length,
                recommendation: "COLLECTING DATA",
                reason: "Insufficient digit data"
            };

            return this.lastResult;
        }

        /*
         * Use both the complete analysis window and
         * the recent window.
         */
        const recent =
            data.slice(-this.recentWindow);

        const overallProbabilities =
            this.calculateDistribution(data);

        const recentProbabilities =
            this.calculateDistribution(recent);

        const overallBest =
            this.getBestDigit(
                overallProbabilities
            );

        const recentBest =
            this.getBestDigit(
                recentProbabilities
            );

        /*
         * Combine historical and recent evidence.
         *
         * Recent data gets more weight because the
         * analysis engine should respond to changing
         * observations.
         */
        const combined =
            Array(10).fill(0);

        for (let digit = 0; digit < 10; digit++) {

            combined[digit] =
                (
                    overallProbabilities[digit] * 0.40
                ) +
                (
                    recentProbabilities[digit] * 0.60
                );
        }

        const best =
            this.getBestDigit(combined);

        const probability =
            best.probability;

        const strength =
            this.calculateStrength(
                probability
            );

        /*
         * Check whether recent and historical
         * distributions support the same digit.
         */
        const agreement =
            overallBest.digit ===
            recentBest.digit;

        /*
         * Agreement provides supporting evidence,
         * but does not manufacture a signal.
         */
        let adjustedStrength =
            strength;

        if (agreement) {
            adjustedStrength *= 1.10;
        } else {
            adjustedStrength *= 0.90;
        }

        adjustedStrength =
            Math.max(
                0,
                Math.min(
                    1,
                    adjustedStrength
                )
            );

        const confidence =
            this.calculateConfidence(
                adjustedStrength,
                data.length
            );

        let recommendation = "WAIT";

        if (
            confidence >= 85 &&
            adjustedStrength >= 0.40
        ) {
            recommendation = "STRONG SIGNAL";
        } else if (
            confidence >= 70 &&
            adjustedStrength >= 0.25
        ) {
            recommendation = "WATCH";
        } else if (
            adjustedStrength >= 0.15
        ) {
            recommendation = "WEAK SIGNAL";
        }

        this.lastResult = {
            module: this.name,

            success: true,

            prediction: best.digit,

            digit: best.digit,

            probability:
                Number(
                    (
                        probability * 100
                    ).toFixed(2)
                ),

            score:
                Number(
                    (
                        adjustedStrength * 100
                    ).toFixed(2)
                ),

            confidence,

            samples:
                data.length,

            recentSamples:
                recent.length,

            agreement,

            recommendation,

            distribution:
                combined.map(
                    value =>
                        Number(
                            (
                                value * 100
                            ).toFixed(2)
                        )
                ),

            historicalDistribution:
                overallProbabilities.map(
                    value =>
                        Number(
                            (
                                value * 100
                            ).toFixed(2)
                        )
                ),

            recentDistribution:
                recentProbabilities.map(
                    value =>
                        Number(
                            (
                                value * 100
                            ).toFixed(2)
                        )
                )
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
            prediction: null,
            digit: null,
            probability: 0,
            score: 0,
            confidence: 0,
            samples: 0,
            recommendation: "COLLECTING DATA"
        };
    }
}

window.ProbabilityEngine =
    ProbabilityEngine;

window.probabilityEngine =
    new ProbabilityEngine();
