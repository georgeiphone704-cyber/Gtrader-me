/*
 * ============================================================
 * GTRADER-ME PROBABILITY ANALYSIS MODULE
 * ============================================================
 *
 * PURPOSE:
 * - Calculate digit frequencies and empirical probabilities.
 * - Compare recent probability against a longer baseline.
 * - Produce one structured result for engine.js.
 *
 * IMPORTANT:
 * - This module does NOT place trades.
 * - It does NOT duplicate Pattern, Markov, Transition,
 *   Statistics, or Cycle analysis.
 * - Probability is historical frequency, NOT a guarantee
 *   of the next digit.
 * ============================================================
 */

class ProbabilityEngine {

    constructor(options = {}) {

        this.name = "probability";

        this.minimumSamples =
            Number(options.minimumSamples) > 0
                ? Number(options.minimumSamples)
                : 30;

        this.recentWindow =
            Number(options.recentWindow) > 0
                ? Number(options.recentWindow)
                : 50;

        this.lastResult = null;
    }


    /* ==========================================================
     * MAIN ANALYSIS
     * ========================================================== */

    analyze(digits = []) {

        const clean =
            this.cleanDigits(digits);

        if (
            clean.length <
            this.minimumSamples
        ) {

            return this.waitResult(
                clean.length
            );
        }


        const recent =
            clean.slice(
                -Math.min(
                    this.recentWindow,
                    clean.length
                )
            );


        const recentFrequency =
            this.frequency(recent);

        const overallFrequency =
            this.frequency(clean);


        const recentProbability =
            this.toProbability(
                recentFrequency,
                recent.length
            );

        const overallProbability =
            this.toProbability(
                overallFrequency,
                clean.length
            );


        const predictedDigit =
            this.selectDigit(
                recentProbability,
                overallProbability
            );


        const score =
            this.calculateScore(
                recentProbability,
                overallProbability
            );


        const result = {

            module:
                this.name,

            success:
                true,

            score:
                Number(
                    score.toFixed(2)
                ),

            confidence:
                Number(
                    score.toFixed(2)
                ),

            samples:
                clean.length,

            prediction:
                predictedDigit,

            digit:
                predictedDigit,

            recommendation:
                score >= 90
                    ? "STRONG"
                    : score >= 75
                        ? "WATCH"
                        : "WAIT",

            recentSamples:
                recent.length,

            recentFrequency,

            overallFrequency,

            recentProbability,

            overallProbability
        };


        this.lastResult =
            result;


        return result;
    }


    /* ==========================================================
     * CLEAN DIGITS
     * ========================================================== */

    cleanDigits(
        digits
    ) {

        if (
            !Array.isArray(digits)
        ) {

            return [];
        }


        return digits
            .map(
                digit =>
                    Number(digit)
            )
            .filter(
                digit =>
                    Number.isInteger(
                        digit
                    ) &&
                    digit >= 0 &&
                    digit <= 9
            );
    }


    /* ==========================================================
     * FREQUENCY
     * ========================================================== */

    frequency(
        digits
    ) {

        const counts =
            Array(10).fill(0);


        for (
            const digit of
            digits
        ) {

            counts[digit]++;
        }


        return counts;
    }


    /* ==========================================================
     * PROBABILITY
     * ========================================================== */

    toProbability(
        frequency,
        total
    ) {

        const probabilities =
            Array(10).fill(0);


        if (
            !Number.isFinite(total) ||
            total <= 0
        ) {

            return probabilities;
        }


        for (
            let digit = 0;
            digit <= 9;
            digit++
        ) {

            probabilities[digit] =
                Number(
                    (
                        frequency[digit] /
                        total *
                        100
                    ).toFixed(2)
                );
        }


        return probabilities;
    }


    /* ==========================================================
     * SELECT MOST SUPPORTED DIGIT
     * ========================================================== */

    selectDigit(
        recentProbability,
        overallProbability
    ) {

        let bestDigit =
            null;

        let bestScore =
            -Infinity;


        for (
            let digit = 0;
            digit <= 9;
            digit++
        ) {

            /*
             * Recent data receives more weight
             * than the longer baseline.
             */

            const score =
                (
                    recentProbability[digit] *
                    0.70
                ) +
                (
                    overallProbability[digit] *
                    0.30
                );


            if (
                score >
                bestScore
            ) {

                bestScore =
                    score;

                bestDigit =
                    digit;
            }
        }


        return bestDigit;
    }


    /* ==========================================================
     * SCORE
     * ========================================================== */

    calculateScore(
        recentProbability,
        overallProbability
    ) {

        const recent =
            Math.max(
                ...recentProbability
            );


        const overall =
            Math.max(
                ...overallProbability
            );


        /*
         * A uniform ten-digit distribution
         * has an expected frequency of 10%.
         *
         * This score measures how much the
         * observed distribution deviates from
         * that baseline.
         */

        const recentStrength =
            Math.max(
                0,
                Math.min(
                    100,
                    50 +
                    (
                        recent -
                        10
                    ) * 4
                )
            );


        const overallStrength =
            Math.max(
                0,
                Math.min(
                    100,
                    50 +
                    (
                        overall -
                        10
                    ) * 2
                )
            );


        const score =
            (
                recentStrength *
                0.70
            ) +
            (
                overallStrength *
                0.30
            );


        return Math.max(
            0,
            Math.min(
                100,
                score
            )
        );
    }


    /* ==========================================================
     * WAIT RESULT
     * ========================================================== */

    waitResult(
        samples
    ) {

        const result = {

            module:
                this.name,

            success:
                false,

            score:
                0,

            confidence:
                0,

            samples,

            prediction:
                null,

            digit:
                null,

            recommendation:
                "WAIT",

            reason:
                "Not enough probability data",

            recentSamples:
                0,

            recentFrequency:
                Array(10).fill(0),

            overallFrequency:
                Array(10).fill(0),

            recentProbability:
                Array(10).fill(0),

            overallProbability:
                Array(10).fill(0)
        };


        this.lastResult =
            result;


        return result;
    }


    /* ==========================================================
     * RESET
     * ========================================================== */

    reset() {

        this.lastResult =
            null;
    }
}


/* ==============================================================
 * GLOBAL MODULE
 * ============================================================== */

window.ProbabilityEngine =
    ProbabilityEngine;

window.probabilityEngine =
    new ProbabilityEngine();