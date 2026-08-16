/*
 * ============================================================
 * GTRADER-ME MARKOV ANALYSIS MODULE
 * ============================================================
 *
 * PURPOSE:
 * - Model the probability of the next digit using recent
 *   digit-state transitions.
 * - Use first-order and second-order transition information.
 * - Produce one structured result for engine.js.
 *
 * IMPORTANT:
 * - This module does NOT place trades.
 * - It is separate from transition.js:
 *   transition.js = direct transition analysis.
 *   markov.js     = state-based probabilistic analysis.
 * - A Markov result is a statistical estimate, NOT certainty.
 * ============================================================
 */

class MarkovEngine {

    constructor(options = {}) {

        this.name =
            "markov";

        this.minimumSamples =
            Number(options.minimumSamples) > 0
                ? Number(options.minimumSamples)
                : 40;

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


        const firstOrder =
            this.buildFirstOrder(
                clean
            );


        const secondOrder =
            this.buildSecondOrder(
                clean
            );


        const lastDigit =
            clean[
                clean.length - 1
            ];


        const previousDigit =
            clean.length >= 2
                ? clean[
                    clean.length - 2
                ]
                : null;


        const firstProbabilities =
            this.getFirstOrderProbabilities(
                firstOrder,
                lastDigit
            );


        const secondProbabilities =
            this.getSecondOrderProbabilities(
                secondOrder,
                previousDigit,
                lastDigit
            );


        const combined =
            this.combineProbabilities(
                firstProbabilities,
                secondProbabilities
            );


        const prediction =
            this.selectPrediction(
                combined
            );


        const strength =
            prediction !== null
                ? combined[prediction]
                : 0;


        const score =
            this.calculateScore(
                strength,
                clean.length
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

            prediction: {

                digit:
                    prediction,

                probability:
                    Number(
                        strength.toFixed(2)
                    )
            },

            digit:
                prediction,

            lastDigit,

            previousDigit,

            probabilities:
                combined,

            firstOrderProbabilities:
                firstProbabilities,

            secondOrderProbabilities:
                secondProbabilities,

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
     * FIRST-ORDER MODEL
     * ========================================================== */

    buildFirstOrder(
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
     * SECOND-ORDER MODEL
     * ========================================================== */

    buildSecondOrder(
        digits
    ) {

        const model = {};


        for (
            let i = 0;
            i < digits.length - 2;
            i++
        ) {

            const first =
                digits[i];

            const second =
                digits[i + 1];

            const next =
                digits[i + 2];


            const key =
                `${first}_${second}`;


            if (
                !model[key]
            ) {

                model[key] =
                    Array(10).fill(0);
            }


            model[key][next]++;
        }


        return model;
    }


    /* ==========================================================
     * FIRST-ORDER PROBABILITIES
     * ========================================================== */

    getFirstOrderProbabilities(
        matrix,
        lastDigit
    ) {

        if (
            !Number.isInteger(
                lastDigit
            ) ||
            !matrix[lastDigit]
        ) {

            return Array(10).fill(0);
        }


        const row =
            matrix[lastDigit];


        const total =
            row.reduce(
                (
                    sum,
                    value
                ) =>
                    sum + value,
                0
            );


        return this.normalize(
            row,
            total
        );
    }


    /* ==========================================================
     * SECOND-ORDER PROBABILITIES
     * ========================================================== */

    getSecondOrderProbabilities(
        model,
        previousDigit,
        lastDigit
    ) {

        if (
            !Number.isInteger(
                previousDigit
            ) ||
            !Number.isInteger(
                lastDigit
            )
        ) {

            return Array(10).fill(0);
        }


        const key =
            `${previousDigit}_${lastDigit}`;


        const row =
            model[key];


        if (
            !row
        ) {

            return Array(10).fill(0);
        }


        const total =
            row.reduce(
                (
                    sum,
                    value
                ) =>
                    sum + value,
                0
            );


        return this.normalize(
            row,
            total
        );
    }


    /* ==========================================================
     * NORMALIZE
     * ========================================================== */

    normalize(
        values,
        total
    ) {

        const result =
            Array(10).fill(0);


        if (
            !total ||
            total <= 0
        ) {

            return result;
        }


        for (
            let digit = 0;
            digit <= 9;
            digit++
        ) {

            result[digit] =
                (
                    values[digit] /
                    total
                ) * 100;
        }


        return result;
    }


    /* ==========================================================
     * COMBINE MODELS
     * ========================================================== */

    combineProbabilities(
        firstOrder,
        secondOrder
    ) {

        const combined =
            Array(10).fill(0);


        const secondHasData =
            secondOrder.some(
                value =>
                    value > 0
            );


        for (
            let digit = 0;
            digit <= 9;
            digit++
        ) {

            if (
                secondHasData
            ) {

                /*
                 * Second-order context receives
                 * more weight because it contains
                 * the previous two states.
                 */

                combined[digit] =
                    (
                        firstOrder[digit] *
                        0.40
                    ) +
                    (
                        secondOrder[digit] *
                        0.60
                    );

            } else {

                combined[digit] =
                    firstOrder[digit];
            }
        }


        return combined;
    }


    /* ==========================================================
     * SELECT PREDICTION
     * ========================================================== */

    selectPrediction(
        probabilities
    ) {

        let bestDigit =
            null;

        let bestProbability =
            0;


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
        probability,
        samples
    ) {

        if (
            probability <= 0
        ) {

            return 0;
        }


        let score =
            40;


        if (
            probability >= 50
        ) {

            score += 45;

        } else if (
            probability >= 40
        ) {

            score += 35;

        } else if (
            probability >= 30
        ) {

            score += 25;

        } else if (
            probability >= 20
        ) {

            score += 12;

        } else if (
            probability >= 15
        ) {

            score += 5;
        }


        if (
            samples >= 100
        ) {

            score += 10;

        } else if (
            samples >= 60
        ) {

            score += 7;

        } else if (
            samples >= 40
        ) {

            score += 4;
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

            prediction: {

                digit:
                    null,

                probability:
                    0
            },

            digit
          
                null,

            lastDigit:
                null,

            previousDigit:
                null,

            probabilities:
                Array(10).fill(0),

            firstOrderProbabilities:
                Array(10).fill(0),

            secondOrderProbabilities:
                Array(10).fill(0),

            recommendation:
                "WAIT",

            reason:
                "Not enough Markov data"
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

window.MarkovEngine =
    MarkovEngine;

window.markovEngine =
    new MarkovEngine();