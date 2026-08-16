/*
 * ============================================================
 * GTRADER-ME LEARNING ENGINE
 * ============================================================
 *
 * PURPOSE:
 * - Record decisions and their outcomes.
 * - Track analytical performance over time.
 * - Provide feedback to the analysis engine.
 *
 * IMPORTANT:
 * - This module does NOT place trades.
 * - It does NOT change the decision instantly.
 * - It records results so the system can evaluate
 *   which analytical conditions have historically worked.
 * ============================================================
 */

class LearningEngine {

    constructor(options = {}) {

        this.name =
            "learning";

        this.maxHistory =
            Number(options.maxHistory) > 0
                ? Number(options.maxHistory)
                : 500;

        this.history = [];

        this.stats = {

            total:
                0,

            correct:
                0,

            incorrect:
                0,

            pending:
                0,

            accuracy:
                0
        };

        this.lastResult =
            null;
    }


    /* ==========================================================
     * ANALYZE DECISION
     * ========================================================== */

    analyze(
        decisionResult,
        context = {}
    ) {

        if (
            !decisionResult ||
            typeof decisionResult !==
            "object"
        ) {

            return null;
        }


        const record = {

            id:
                Date.now(),

            timestamp:
                Date.now(),

            market:
                context.market ||
                null,

            decision:
                decisionResult.decision ||
                decisionResult.signal ||
                "WAIT",

            signal:
                decisionResult.signal ||
                "WAIT",

            prediction:
                this.extractPrediction(
                    decisionResult
                ),

            confidence:
                this.safeNumber(
                    decisionResult.confidence
                ),

            agreement:
                this.safeNumber(
                    decisionResult.agreement
                ),

            outcome:
                null,

            correct:
                null
        };


        this.addRecord(
            record
        );


        return record;
    }


    /* ==========================================================
     * UPDATE OUTCOME
     * ========================================================== */

    update(
        data = {}
    ) {

        if (
            !data ||
            typeof data !==
            "object"
        ) {

            return null;
        }


        /*
         * If a complete decision is supplied,
         * record it first.
         */

        if (
            data.decision &&
            typeof data.decision ===
            "object"
        ) {

            this.analyze(
                data.decision,
                {
                    market:
                        data.market ||
                        null
                }
            );
        }


        /*
         * Outcome can be supplied directly.
         */

        if (
            data.outcome !==
            undefined
        ) {

            return this.recordOutcome(
                data.outcome,
                data.prediction
            );
        }


        return this.getStats();
    }


    /* ==========================================================
     * RECORD OUTCOME
     * ========================================================== */

    recordOutcome(
        outcome,
        actualDigit = null
    ) {

        if (
            !this.history.length
        ) {

            return null;
        }


        const latest =
            this.history[
                this.history.length - 1
            ];


        latest.outcome =
            outcome;


        if (
            Number.isInteger(
                actualDigit
            )
        ) {

            latest.actualDigit =
                actualDigit;
        }


        if (
            typeof outcome ===
            "boolean"
        ) {

            latest.correct =
                outcome;

        } else if (
            typeof outcome ===
            "string"
        ) {

            const normalized =
                outcome
                    .toLowerCase()
                    .trim();


            if (
                normalized ===
                "win" ||
                normalized ===
                "correct" ||
                normalized ===
                "success"
            ) {

                latest.correct =
                    true;

            } else if (
                normalized ===
                "loss" ||
                normalized ===
                "incorrect" ||
                normalized ===
                "failed"
            ) {

                latest.correct =
                    false;
            }
        }


        /*
         * If the actual digit is known,
         * independently verify the prediction.
         */

        if (
            Number.isInteger(
                actualDigit
            ) &&
            Number.isInteger(
                latest.prediction
            )
        ) {

            latest.correct =
                latest.prediction ===
                actualDigit;
        }


        this.recalculateStats();

        this.lastResult =
            latest;


        return latest;
    }


    /* ==========================================================
     * ADD RECORD
     * ========================================================== */

    addRecord(
        record
    ) {

        if (
            !record ||
            typeof record !==
            "object"
        ) {

            return false;
        }


        this.history.push(
            record
        );


        /*
         * Keep memory bounded.
         */

        if (
            this.history.length >
            this.maxHistory
        ) {

            this.history =
                this.history.slice(
                    -this.maxHistory
                );
        }


        this.recalculateStats();


        return true;
    }


    /* ==========================================================
     * RECALCULATE STATS
     * ========================================================== */

    recalculateStats() {

        let total =
            0;

        let correct =
            0;

        let incorrect =
            0;

        let pending =
            0;


        for (
            const record of
            this.history
        ) {

            if (
                record.correct ===
                true
            ) {

                correct++;

                total++;

            } else if (
                record.correct ===
                false
            ) {

                incorrect++;

                total++;

            } else {

                pending++;
            }
        }


        const accuracy =
            total > 0
                ? (
                    correct /
                    total
                ) * 100
                : 0;


        this.stats = {

            total,

            correct,

            incorrect,

            pending,

            accuracy:
                Number(
                    accuracy.toFixed(2)
                )
        };


        return this.stats;
    }


    /* ==========================================================
     * EXTRACT PREDICTION
     * ========================================================== */

    extractPrediction(
        result
    ) {

        if (
            !result
        ) {

            return null;
        }


        if (
            Number.isInteger(
                result.prediction
            )
        ) {

            return result.prediction;
        }


        if (
            result.prediction &&
            typeof result.prediction ===
            "object" &&
            Number.isInteger(
                result.prediction.digit
            )
        ) {

            return result.prediction.digit;
        }


        if (
            Number.isInteger(
                result.digit
            )
        ) {

            return result.digit;
        }


        return null;
    }


    /* ==========================================================
     * GET HISTORY
     * ========================================================== */

    getHistory(
        count = this.maxHistory
    ) {

        const amount =
            Math.max(
                1,
                Number(count) ||
                this.maxHistory
            );


        return this.history
            .slice(
                -amount
            )
            .map(
                record =>
                    ({
                        ...record
                    })
            );
    }


    /* ==========================================================
     * GET STATS
     * ========================================================== */

    getStats() {

        return {
            ...this.stats
        };
    }


    /* ==========================================================
     * GET STATE
     * ========================================================== */

    getState() {

        return {

            module:
                this.name,

            historyCount:
                this.history.length,

            stats:
                this.getStats(),

            lastResult:
                this.lastResult
                    ? {
                        ...this.lastResult
                    }
                    : null
        };
    }


    /* ==========================================================
     * SAFE NUMBER
     * ========================================================== */

    safeNumber(
        value,
        fallback = 0
    ) {

        const number =
            Number(value);


        if (
            !Number.isFinite(
                number
            )
        ) {

            return fallback;
        }


        return Math.max(
            0,
            Math.min(
                100,
                number
            )
        );
    }


    /* ==========================================================
     * RESET
     * ========================================================== */

    reset() {

        this.history =
            [];

        this.stats = {

            total:
                0,

            correct:
                0,

            incorrect:
                0,

            pending:
                0,

            accuracy:
                0
        };

        this.lastResult =
            null;
    }
}


/* ==============================================================
 * GLOBAL MODULE
 * ============================================================== */

window.LearningEngine =
    LearningEngine;

window.learningEngine =
    new LearningEngine();