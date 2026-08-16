/*
 * ============================================================
 * GTRADER-ME CYCLE ANALYSIS MODULE
 * ============================================================
 *
 * PURPOSE:
 * - Detect recurring short digit patterns.
 * - Compare the latest sequence with previous sequences.
 * - Identify repeating cycle candidates.
 * - Produce one structured result for engine.js.
 *
 * IMPORTANT:
 * - This module does NOT place trades.
 * - It does NOT duplicate Markov or Transition analysis.
 * - A detected cycle is only historical pattern evidence,
 *   not a guarantee of the next digit.
 * ============================================================
 */

class CycleEngine {

    constructor(options = {}) {

        this.name =
            "cycle";

        this.minimumSamples =
            Number(options.minimumSamples) > 0
                ? Number(options.minimumSamples)
                : 40;

        this.maxCycleLength =
            Number(options.maxCycleLength) > 0
                ? Number(options.maxCycleLength)
                : 10;

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


        const detected =
            this.findBestCycle(
                clean
            );


        const prediction =
            detected
                ? detected.prediction
                : null;


        const score =
            this.calculateScore(
                detected
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

            cycleLength:
                detected
                    ? detected.length
                    : 0,

            matches:
                detected
                    ? detected.matches
                    : 0,

            matchRate:
                detected
                    ? Number(
                        detected.matchRate.toFixed(2)
                    )
                    : 0,

            pattern:
                detected
                    ? detected.pattern
                    : [],

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
     * FIND BEST CYCLE
     * ========================================================== */

    findBestCycle(
        digits
    ) {

        let best =
            null;


        const maximumLength =
            Math.min(
                this.maxCycleLength,
                Math.floor(
                    digits.length / 3
                )
            );


        for (
            let length = 2;
            length <= maximumLength;
            length++
        ) {

            const candidate =
                this.testCycle(
                    digits,
                    length
                );


            if (
                !candidate
            ) {
                continue;
            }


            if (
                !best ||
                candidate.matchRate >
                    best.matchRate
            ) {

                best =
                    candidate;

            } else if (
                best &&
                candidate.matchRate ===
                    best.matchRate &&
                candidate.matches >
                    best.matches
            ) {

                best =
                    candidate;
            }
        }


        return best;
    }


    /* ==========================================================
     * TEST ONE CYCLE LENGTH
     * ========================================================== */

    testCycle(
        digits,
        length
    ) {

        if (
            digits.length <
            length * 3
        ) {

            return null;
        }


        const pattern =
            digits.slice(
                -length
            );


        let matches =
            0;

        let comparisons =
            0;


        /*
         * Compare historical positions against
         * the latest cycle pattern.
         */

        for (
            let i = 0;
            i <=
            digits.length -
            length;
            i++
        ) {

            const segment =
                digits.slice(
                    i,
                    i + length
                );


            let equal =
                true;


            for (
                let j = 0;
                j < length;
                j++
            ) {

                if (
                    segment[j] !==
                    pattern[j]
                ) {

                    equal =
                        false;

                    break;
                }
            }


            comparisons++;


            if (
                equal
            ) {

                matches++;
            }
        }


        /*
         * Ignore a cycle that only appears once.
         * We need historical repetition before
         * treating it as meaningful.
         */

        if (
            matches < 2
        ) {

            return null;
        }


        const matchRate =
            comparisons > 0
                ? (
                    matches /
                    comparisons
                ) * 100
                : 0;


        /*
         * The digit following each historical
         * matching pattern becomes evidence for
         * the next prediction.
         */

        const nextDigits =
            Array(10).fill(0);


        for (
            let i = 0;
            i <=
            digits.length -
            length -
            1;
            i++
        ) {

            const segment =
                digits.slice(
                    i,
                    i + length
                );


            let equal =
                true;


            for (
                let j = 0;
                j < length;
                j++
            ) {

                if (
                    segment[j] !==
                    pattern[j]
                ) {

                    equal =
                        false;

                    break;
                }
            }


            if (
                equal
            ) {

                const next =
                    digits[
                        i + length
                    ];


                if (
                    Number.isInteger(
                        next
                    )
                ) {

                    nextDigits[next]++;
                }
            }
        }


        const prediction =
            this.selectPrediction(
                nextDigits
            );


        return {

            length,

            pattern: [
                ...pattern
            ],

            matches,

            comparisons,

            matchRate,

            nextDigits,

            prediction
        };
    }


    /* ==========================================================
     * SELECT NEXT DIGIT
     * ========================================================== */

    selectPrediction(
        counts
    ) {

        let bestDigit =
            null;

        let bestCount =
            0;


        for (
            let digit = 0;
            digit <= 9;
            digit++
        ) {

            if (
                counts[digit] >
                bestCount
            ) {

                bestCount =
                    counts[digit];

                bestDigit =
                    digit;
            }
        }


        if (
            bestCount <= 0
        ) {

            return null;
        }


        return bestDigit;
    }


    /* ==========================================================
     * SCORE
     * ========================================================== */

    calculateScore(
        cycle
    ) {

        if (
            !cycle
        ) {

            return 0;
        }


        let score =
            45;


        /*
         * Stronger repeated matching increases
         * the score.
         */

        if (
            cycle.matchRate >=
            30
        ) {

            score += 30;

        } else if (
            cycle.matchRate >=
            20
        ) {

            score += 20;

        } else if (
            cycle.matchRate >=
            10
        ) {

            score += 10;

        } else if (
            cycle.matchRate >=
            5
        ) {

            score += 5;
        }


        /*
         * Multiple historical matches provide
         * additional support.
         */

        if (
            cycle.matches >=
            5
        ) {

            score += 12;

        } else if (
            cycle.matches >=
            3
        ) {

            score += 7;

        } else if (
            cycle.matches >=
            2
        ) {

            score += 3;
        }


        /*
         * A cycle with no predicted following
         * digit cannot produce a useful signal.
         */

        if (
            cycle.prediction ===
            null
        ) {

            score -= 20;
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

            cycleLength:
                0,

            matches:
                0,

            matchRate:
                0,

            pattern:
                [],

            recommendation:
                "WAIT",

            reason:
                "Not enough cycle data"
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

window.CycleEngine =
    CycleEngine;

window.cycleEngine =
    new CycleEngine();