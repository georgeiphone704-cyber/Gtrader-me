/*
 * ============================================================
 * GTRADER-ME DECISION ENGINE
 * ============================================================
 *
 * PURPOSE:
 * - Combine confidence + validation + module results.
 * - Produce the final analytical signal.
 * - Return TRADE or WAIT.
 *
 * IMPORTANT:
 * - This module does NOT execute the Deriv contract.
 * - It only produces the decision.
 * - Actual execution should remain in the trading/execution layer.
 * ============================================================
 */

class DecisionEngine {

    constructor(options = {}) {

        this.name =
            "decision";

        this.minimumConfidence =
            Number(options.minimumConfidence) > 0
                ? Number(options.minimumConfidence)
                : 90;

        this.minimumAgreement =
            Number(options.minimumAgreement) > 0
                ? Number(options.minimumAgreement)
                : 60;

        this.minimumModules =
            Number(options.minimumModules) > 0
                ? Number(options.minimumModules)
                : 2;

        this.lastResult =
            null;
    }


    /* ==========================================================
     * MAIN DECISION
     * ========================================================== */

    analyze(
        confidenceResult,
        validationResult,
        results = {}
    ) {

        const confidence =
            this.safeNumber(
                confidenceResult &&
                (
                    confidenceResult.confidence ??
                    confidenceResult.score
                )
            );


        const agreement =
            this.safeNumber(
                confidenceResult &&
                confidenceResult.agreement
            );


        const activeModules =
            this.countActiveModules(
                results
            );


        const prediction =
            this.extractPrediction(
                confidenceResult,
                results
            );


        const validationPassed =
            !!(
                validationResult &&
                (
                    validationResult.valid === true ||
                    validationResult.success === true
                )
            );


        const confidencePassed =
            confidence >=
            this.minimumConfidence;


        const agreementPassed =
            agreement >=
            this.minimumAgreement;


        const modulesPassed =
            activeModules >=
            this.minimumModules;


        const predictionPassed =
            prediction !== null;


        const approved =
            validationPassed &&
            confidencePassed &&
            agreementPassed &&
            modulesPassed &&
            predictionPassed;


        const signal =
            approved
                ? "TRADE"
                : "WAIT";


        const reason =
            approved
                ? "All decision conditions passed"
                : this.buildReason(
                    validationPassed,
                    confidencePassed,
                    agreementPassed,
                    modulesPassed,
                    predictionPassed
                );


        const result = {

            module:
                this.name,

            success:
                true,

            signal,

            decision:
                signal,

            approved,

            confidence,

            agreement,

            activeModules,

            prediction,

            digit:
                prediction,

            validation:
                validationPassed,

            checks: {

                validationPassed,

                confidencePassed,

                agreementPassed,

                modulesPassed,

                predictionPassed
            },

            reason
        };


        this.lastResult =
            result;


        return result;
    }


    /* ==========================================================
     * DECIDE ALIAS
     * ========================================================== */

    decide(
        confidenceResult,
        validationResult,
        results = {}
    ) {

        return this.analyze(
            confidenceResult,
            validationResult,
            results
        );
    }


    /* ==========================================================
     * COUNT ACTIVE MODULES
     * ========================================================== */

    countActiveModules(
        results
    ) {

        if (
            !results ||
            typeof results !==
            "object"
        ) {

            return 0;
        }


        return Object.values(
            results
        ).filter(
            result => {

                if (
                    !result ||
                    typeof result !==
                    "object"
                ) {

                    return false;
                }


                return (
                    result.success === true &&
                    Number.isFinite(
                        Number(
                            result.score
                        )
                    )
                );
            }
        ).length;
    }


    /* ==========================================================
     * EXTRACT PREDICTION
     * ========================================================== */

    extractPrediction(
        confidenceResult,
        results
    ) {

        if (
            confidenceResult
        ) {

            if (
                Number.isInteger(
                    confidenceResult.prediction
                )
            ) {

                return confidenceResult.prediction;
            }


            if (
                confidenceResult.prediction &&
                typeof confidenceResult.prediction ===
                "object" &&
                Number.isInteger(
                    confidenceResult
                        .prediction
                        .digit
                )
            ) {

                return confidenceResult
                    .prediction
                    .digit;
            }


            if (
                Number.isInteger(
                    confidenceResult.digit
                )
            ) {

                return confidenceResult.digit;
            }
        }


        if (
            results &&
            typeof results ===
            "object"
        ) {

            const modules = [

                results.markov,

                results.transition,

                results.probability,

                results.patterns,

                results.cycle,

                results.statistics
            ];


            for (
                const result of
                modules
            ) {

                if (
                    !result
                ) {

                    continue;
                }


                if (
                    Number.isInteger(
                        result.digit
                    )
                ) {

                    return result.digit;
                }


                if (
                    Number.isInteger(
                        result.predictedDigit
                    )
                ) {

                    return result.predictedDigit;
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
            }
        }


        return null;
    }


    /* ==========================================================
     * BUILD FAILURE REASON
     * ========================================================== */

    buildReason(
        validationPassed,
        confidencePassed,
        agreementPassed,
        modulesPassed,
        predictionPassed
    ) {

        const reasons = [];


        if (
            !validationPassed
        ) {

            reasons.push(
                "Validation failed"
            );
        }


        if (
            !confidencePassed
        ) {

            reasons.push(
                "Confidence below threshold"
            );
        }


        if (
            !agreementPassed
        ) {

            reasons.push(
                "Module agreement too low"
            );
        }


        if (
            !modulesPassed
        ) {

            reasons.push(
                "Not enough active modules"
            );
        }


        if (
            !predictionPassed
        ) {

            reasons.push(
                "No valid prediction"
            );
        }


        if (
            !reasons.length
        ) {

            return "Waiting for stronger conditions";
        }


        return reasons.join(
            "; "
        );
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

        this.lastResult =
            null;
    }
}


/* ==============================================================
 * GLOBAL MODULE
 * ============================================================== */

window.DecisionEngine =
    DecisionEngine;

window.decisionEngine =
    new DecisionEngine();