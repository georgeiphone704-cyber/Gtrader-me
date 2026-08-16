/*
 * ============================================================
 * GTRADER-ME TRANSITION ANALYSIS MODULE
 * ============================================================
 *
 * PURPOSE:
 * - Analyze how one digit transitions to the next digit.
 * - Build a 10 x 10 transition matrix.
 * - Measure the most common next digit for the latest digit.
 * - Produce one structured result for engine.js.
 *
 * IMPORTANT:
 * - This module does NOT place trades.
 * - It does NOT duplicate Markov analysis.
 * - It focuses specifically on direct digit-to-digit
 *   transitions.
 * ============================================================
 */

class TransitionEngine {

    constructor(options = {}) {

        this.name =
            "transition";

        this.minimumSamples =
            Number(options.minimumSamples) > 0
                ? Number(options.minimumSamples)
                : 30;

        this.lastResult =
            null;
    }


    /* ==========================================================
     * MAIN ANALYSIS
     * ========================================================== */

    analyze(digits = []) {

        const clean =
            this.cleanDigits(
                digits
            );


        if (
            clean.length <
            this.minimumSamples
        ) {

            return this.waitResult(
                clean.length
            );
        }


        const matrix =
            this.buildTransitionMatrix(
                clean
            );


        const lastDigit =
            clean[
                clean.length - 1
            ];


        const row =
            matrix[lastDigit];


        const rowTotal =
            row.reduce(
                (
                    sum,
                    value
                ) =>
                    sum + value,
                0
            );


        const probabilities =
            this.toProbabilities(
                row,
                rowTotal
            );


        const predictedDigit =
            this.selectPrediction(
                probabilities
            );


        const strongestProbability =
            predictedDigit !== null
                ? probabilities[
                    predictedDigit
                ]
                : 0;


        const score =
            this.calculateScore(
                strongestProbability,
                rowTotal
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

            predictedDigit,

            digit:
                predictedDigit,

            lastDigit,

            transitionCount:
                rowTotal,

            probabilities,

            transitionMatrix:
                matrix,

            strongestProbability:
                Number(
                    strongestProbability.toFixed(2)
                ),

            recommendation:
                score >= 90
                    ? "STRONG"
                    : score >= 75
                        ? "WATCH"
                        : "WAIT"
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
            !Array.isArray(
                digits
            )
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
     * BUILD TRANSITION MATRIX
     * ========================================================== */

    buildTransitionMatrix(
        digits
    ) {

        const matrix =
            Array.from(
                {
                    length: 10
                },
                () =>
                    Array(10).fill(0)
            );


        for (
            let i = 0;
            i < digits.length - 1;
            i++
        ) {

            const current =
                digits[i];

            const next =
                digits[i + 1];


            matrix[current][next]++;
        }


        return matrix;
    }


    /* ==========================================================
     * CONVERT COUNTS TO PROBABILITIES
     * ========================================================== */

    toProbabilities(
        row,
        total
    ) {

        const probabilities =
            Array(10).fill(0);


        if (
            !total ||
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
                        row[digit] /
                        total *
                        100
                    ).toFixed(2)
                );
        }


        return probabilities;
    }


    /* ==========================================================
     * SELECT MOST LIKELY NEXT DIGIT
     * ========================================================== */

    selectPrediction(
        probabilities
    ) {

        let bestDigit =
            null;

        let bestProbability =
            -1;


        for (
            let digit = 0;
            digit <= 9;
            digit++
        ) {

            if (
                probabilities[digit] >
                bestProbability
            ) {

                bestProbability =
                    probabilities[digit];

                bestDigit =
                    digit;
            }
        }


        /*
         * If the latest digit has never appeared
         * as a transition source, there is no
         * meaningful transition prediction.
         */

        if (
            bestProbability <= 0
        ) {

            return null;
        }


        return bestDigit;
    }


    /* ==========================================================
     * SCORE
     * ========================================================== */

    calculateScore(
        strongestProbability,
        transitionCount
    ) {

        if (
            transitionCount <= 0
        ) {

            return 0;
        }


        /*
         * With ten possible digits, a completely
         * uniform transition is approximately 10%.
         *
         * The score measures the strength of the
         * observed transition without treating it
         * as certainty.
         */

        let score =
            40;


        if (
            strongestProbability >= 50
        ) {

            score += 45;

        } else if (
            strongestProbability >= 40
        ) {

            score += 35;

        } else if (
            strongestProbability >= 30
        ) {

            score += 25;

        } else if (
            strongestProbability >= 20
        ) {

            score += 12;

        } else if (
            strongestProbability >= 15
        ) {

            score += 5;
        }


        /*
         * More transition observations provide
         * more statistical support.
         */

        if (
            transitionCount >= 50
        ) {

            score += 8;

        } else if (
            transitionCount >= 30
        ) {

            score += 5;

        } else if (
            transitionCount >= 15
        ) {

            score += 2;
        }


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

            predictedDigit:
                null,

            digit:
                null,

            lastDigit:
                null,

            transitionCount:
                0,

            probabilities:
                Array(10).fill(0),

            transitionMatrix:
                Array.from(
                    {
                        length: 10
                    },
                    () =>
                        Array(10).fill(0)
                ),

            strongestProbability:
                0,

            recommendation:
                "WAIT",

            reason:
                "Not enough transition data"
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

window.TransitionEngine =
    TransitionEngine;

window.transitionEngine =
    new TransitionEngine();