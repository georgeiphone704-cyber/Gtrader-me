/*
 * ============================================================
 * GTRADER-ME PATTERN ANALYSIS MODULE
 * ============================================================
 *
 * PURPOSE:
 * - Analyze recent digit patterns.
 * - Detect repeated digits.
 * - Detect streaks.
 * - Detect simple digit sequences.
 * - Produce ONE structured result for engine.js.
 *
 * IMPORTANT:
 * - This module does NOT place trades.
 * - It does NOT duplicate probability, Markov,
 *   transition, statistics, or cycle analysis.
 * - The master engine decides what to do with this result.
 * ============================================================
 */

class PatternEngine {

    constructor(options = {}) {

        this.name =
            "patterns";

        this.minimumSamples =
            Number(options.minimumSamples) > 0
                ? Number(options.minimumSamples)
                : 20;

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


        const recent =
            clean.slice(-20);


        const frequency =
            this.calculateFrequency(
                recent
            );


        const streak =
            this.detectStreak(
                recent
            );


        const repetition =
            this.detectRepetition(
                recent
            );


        const sequence =
            this.detectSequence(
                recent
            );


        const dominantDigit =
            this.getDominantDigit(
                frequency
            );


        const score =
            this.calculateScore({
                streak,
                repetition,
                sequence,
                frequency
            });


        const prediction =
            this.choosePrediction({
                dominantDigit,
                streak,
                repetition,
                sequence
            });


        const recommendation =
            score >= 90
                ? "STRONG"
                : score >= 75
                    ? "WATCH"
                    : "WAIT";


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

            recommendation,

            dominantDigit,

            streak,

            repetition,

            sequence,

            frequency
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
     * DOMINANT DIGIT
     * ========================================================== */

    getDominantDigit(
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
     * STREAK DETECTION
     * ========================================================== */

    detectStreak(
        digits
    ) {

        if (
            !digits.length
        ) {

            return {
                active: false,
                digit: null,
                length: 0
            };
        }


        const last =
            digits[
                digits.length - 1
            ];


        let length =
            1;


        for (
            let i =
                digits.length - 2;
            i >= 0;
            i--
        ) {

            if (
                digits[i] ===
                last
            ) {

                length++;

            } else {

                break;
            }
        }


        return {

            active:
                length >= 2,

            digit:
                last,

            length
        };
    }


    /* ==========================================================
     * REPETITION DETECTION
     * ========================================================== */

    detectRepetition(
        digits
    ) {

        if (
            digits.length < 4
        ) {

            return {
                detected: false,
                digit: null,
                occurrences: 0
            };
        }


        const last =
            digits[
                digits.length - 1
            ];


        let occurrences =
            0;


        for (
            const digit of
            digits
        ) {

            if (
                digit ===
                last
            ) {

                occurrences++;
            }
        }


        return {

            detected:
                occurrences >= 3,

            digit:
                last,

            occurrences
        };
    }


    /* ==========================================================
     * SIMPLE SEQUENCE DETECTION
     * ========================================================== */

    detectSequence(
        digits
    ) {

        if (
            digits.length < 4
        ) {

            return {
                detected: false,
                direction: null,
                length: 0
            };
        }


        const lastFour =
            digits.slice(-4);


        const increasing =
            lastFour[1] ===
                lastFour[0] + 1 &&
            lastFour[2] ===
                lastFour[1] + 1 &&
            lastFour[3] ===
                lastFour[2] + 1;


        const decreasing =
            lastFour[1] ===
                lastFour[0] - 1 &&
            lastFour[2] ===
                lastFour[1] - 1 &&
            lastFour[3] ===
                lastFour[2] - 1;


        if (increasing) {

            return {

                detected:
                    true,

                direction:
                    "UP",

                length:
                    4
            };
        }


        if (decreasing) {

            return {

                detected:
                    true,

                direction:
                    "DOWN",

                length:
                    4
            };
        }


        return {

            detected:
                false,

            direction:
                null,

            length:
                0
        };
    }


    /* ==========================================================
     * SCORE
     * ========================================================== */

    calculateScore(
        data
    ) {

        let score =
            50;


        const streak =
            data.streak;


        const repetition =
            data.repetition;


        const sequence =
            data.sequence;


        if (
            streak &&
            streak.active
        ) {

            if (
                streak.length >= 4
            ) {

                score += 18;

            } else if (
                streak.length >= 3
            ) {

                score += 10;

            } else {

                score += 5;
            }
        }


        if (
            repetition &&
            repetition.detected
        ) {

            score += 8;
        }


        if (
            sequence &&
            sequence.detected
        ) {

            score += 10;
        }


        /*
         * Pattern analysis should never
         * claim certainty from frequency
         * alone.
         */

        const frequency =
            data.frequency || [];


        if (
            frequency.length === 10
        ) {

            const total =
                frequency.reduce(
                    (sum, value) =>
                        sum + value,
                    0
                );


            if (total > 0) {

                const highest =
                    Math.max(
                        ...frequency
                    );


                const concentration =
                    highest /
                    total;


                if (
                    concentration >= 0.30
                ) {

                    score += 8;

                } else if (
                    concentration >= 0.25
                ) {

                    score += 4;
                }
            }
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
     * PREDICTION
     * ========================================================== */

    choosePrediction(
        data
    ) {

        if (
            data.streak &&
            data.streak.active &&
            data.streak.length >= 3
        ) {

            return data.streak.digit;
        }


        if (
            data.repetition &&
            data.repetition.detected
        ) {

            return data.repetition.digit;
        }


        if (
            Number.isInteger(
                data.dominantDigit
            )
        ) {

            return data.dominantDigit;
        }


        return null;
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
                "Not enough pattern data"
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

window.PatternEngine =
    PatternEngine;

window.patternsEngine =
    new PatternEngine();