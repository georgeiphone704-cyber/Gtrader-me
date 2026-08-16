/*
 * ============================================================
 * GTRADER-ME STATISTICS ANALYSIS MODULE
 * ============================================================
 *
 * PURPOSE:
 * - Measure statistical properties of recent digit history.
 * - Calculate frequency, mean, variance and standard deviation.
 * - Compare recent distribution with the expected 0-9 baseline.
 * - Detect unusually concentrated digit behaviour.
 * - Produce one structured result for engine.js.
 *
 * IMPORTANT:
 * - This module does NOT place trades.
 * - It does NOT duplicate Pattern, Probability, Transition,
 *   Markov or Cycle analysis.
 * - Statistics describe the observed sample; they do not
 *   guarantee the next digit.
 * ============================================================
 */

class StatisticsEngine {

    constructor(options = {}) {

        this.name =
            "statistics";

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


        const frequency =
            this.calculateFrequency(
                clean
            );


        const mean =
            this.calculateMean(
                clean
            );


        const variance =
            this.calculateVariance(
                clean,
                mean
            );


        const standardDeviation =
            Math.sqrt(
                variance
            );


        const minimum =
            Math.min(
                ...clean
            );


        const maximum =
            Math.max(
                ...clean
            );


        const range =
            maximum -
            minimum;


        const concentration =
            this.calculateConcentration(
                frequency,
                clean.length
            );


        const balance =
            this.calculateBalance(
                frequency,
                clean.length
            );


        const anomaly =
            this.detectAnomaly(
                concentration,
                balance,
                standardDeviation
            );


        const prediction =
            this.selectPrediction(
                frequency
            );


        const score =
            this.calculateScore(
                concentration,
                balance,
                anomaly
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

            prediction,

            digit:
                prediction,

            recommendation:
                score >= 90
                    ? "STRONG"
                    : score >= 75
                        ? "WATCH"
                        : "WAIT",

            frequency,

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

            minimum,

            maximum,

            range,

            concentration:
                Number(
                    concentration.toFixed(4)
                ),

            balance:
                Number(
                    balance.toFixed(2)
                ),

            anomaly
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
     * FREQUENCY
     * ========================================================== */

    calculateFrequency(
        digits
    ) {

        const frequency =
            Array(10).fill(0);


        for (
            const digit of
            digits
        ) {

            frequency[digit]++;
        }


        return frequency;
    }


    /* ==========================================================
     * MEAN
     * ========================================================== */

    calculateMean(
        digits
    ) {

        if (
            !digits.length
        ) {

            return 0;
        }


        const total =
            digits.reduce(
                (
                    sum,
                    digit
                ) =>
                    sum + digit,
                0
            );


        return (
            total /
            digits.length
        );
    }


    /* ==========================================================
     * VARIANCE
     * ========================================================== */

    calculateVariance(
        digits,
        mean
    ) {

        if (
            digits.length < 2
        ) {

            return 0;
        }


        const squared =
            digits.reduce(
                (
                    sum,
                    digit
                ) => {

                    const difference =
                        digit -
                        mean;

                    return (
                        sum +
                        difference *
                        difference
                    );

                },
                0
            );


        /*
         * Population variance is used because
         * the tick history is the complete sample
         * being analysed by this engine.
         */

        return (
            squared /
            digits.length
        );
    }


    /* ==========================================================
     * CONCENTRATION
     * ========================================================== */

    calculateConcentration(
        frequency,
        total
    ) {

        if (
            !total ||
            total <= 0
        ) {

            return 0;
        }


        const highest =
            Math.max(
                ...frequency
            );


        return (
            highest /
            total
        );
    }


    /* ==========================================================
     * BALANCE
     * ========================================================== */

    calculateBalance(
        frequency,
        total
    ) {

        if (
            !total ||
            total <= 0
        ) {

            return 0;
        }


        /*
         * Perfectly uniform distribution:
         * each digit appears 10% of the time.
         *
         * The score measures how close the
         * observed distribution is to that
         * uniform baseline.
         */

        const expected =
            total /
            10;


        let deviation =
            0;


        for (
            let digit = 0;
            digit <= 9;
            digit++
        ) {

            deviation +=
                Math.abs(
                    frequency[digit] -
                    expected
                );
        }


        const maximumDeviation =
            total *
            2;


        const normalized =
            maximumDeviation > 0
                ? deviation /
                  maximumDeviation
                : 0;


        return Math.max(
            0,
            Math.min(
                100,
                (
                    1 -
                    normalized
                ) * 100
            )
        );
    }


    /* ==========================================================
     * ANOMALY DETECTION
     * ========================================================== */

    detectAnomaly(
        concentration,
        balance,
        standardDeviation
    ) {

        const concentrated =
            concentration >=
            0.25;


        const unusuallyLowSpread =
            standardDeviation <
            2.2;


        const unusuallyHighSpread =
            standardDeviation >
            3.8;


        let level =
            "NORMAL";


        if (
            concentrated ||
            unusuallyLowSpread
        ) {

            level =
                "CONCENTRATED";

        } else if (
            unusuallyHighSpread
        ) {

            level =
                "DISPERSED";
        }


        return {

            detected:
                level !==
                "NORMAL",

            level,

            concentration:
                Number(
                    concentration.toFixed(4)
                ),

            standardDeviation:
                Number(
                    standardDeviation.toFixed(4)
                )
        };
    }


    /* ==========================================================
     * PREDICTION
     * ========================================================== */

    selectPrediction(
        frequency
    ) {

        let bestDigit =
            null;

        let bestCount =
            -1;


        for (
            let digit = 0;
            digit <= 9;
            digit++
        ) {

            if (
                frequency[digit] >
                bestCount
            ) {

                bestCount =
                    frequency[digit];

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
        concentration,
        balance,
        anomaly
    ) {

        /*
         * Statistics should not become overly
         * confident simply because a distribution
         * is unusual.
         *
         * The score therefore rewards measurable
         * structure but caps the contribution.
         */

        let score =
            50;


        if (
            concentration >=
            0.30
        ) {

            score += 15;

        } else if (
            concentration >=
            0.25
        ) {

            score += 8;

        } else if (
            concentration >=
            0.20
        ) {

            score += 3;
        }


        if (
            anomaly &&
            anomaly.detected
        ) {

            if (
                anomaly.level ===
                "CONCENTRATED"
            ) {

                score += 12;

            } else if (
                anomaly.level ===
                "DISPERSED"
            ) {

                score += 4;
            }
        }


        /*
         * Balance alone should not create
         * a strong trade signal.
         */

        if (
            balance >=
            80
        ) {

            score += 3;
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

            digit:
                null,

            recommendation:
                "WAIT",

            reason:
                "Not enough statistical data",

            frequency:
                Array(10).fill(0),

            mean:
                0,

            variance:
                0,

            standardDeviation:
                0,

            minimum:
                null,

            maximum:
                null,

            range:
                0,

            concentration:
                0,

            balance:
                0,

            anomaly:
                {
                    detected: false,
                    level: "INSUFFICIENT_DATA"
                }
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

window.StatisticsEngine =
    StatisticsEngine;

window.statisticsEngine =
    new StatisticsEngine();