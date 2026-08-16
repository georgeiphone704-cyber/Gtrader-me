/*
 * ============================================================
 * GTRADER-ME VALIDATION MODULE
 * ============================================================
 *
 * PURPOSE:
 * - Independently validate the confidence result.
 * - Check whether enough analytical modules agree.
 * - Check confidence thresholds.
 * - Check prediction consistency.
 *
 * IMPORTANT:
 * - This module does NOT place trades.
 * - It only approves or rejects the analytical state.
 * ============================================================
 */

class ValidatorEngine {

    constructor(options = {}) {

        this.name =
            "validator";

        this.minimumModules =
            Number(options.minimumModules) > 0
                ? Number(options.minimumModules)
                : 2;

        this.minimumConfidence =
            Number(options.minimumConfidence) > 0
                ? Number(options.minimumConfidence)
                : 90;

        this.minimumAgreement =
            Number(options.minimumAgreement) > 0
                ? Number(options.minimumAgreement)
                : 60;

        this.lastResult =
            null;
    }


    /* ==========================================================
     * MAIN VALIDATION
     * ========================================================== */

    validate(
        confidenceResult,
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


        const activeModules =
            this.countActiveModules(
                results
            );


        const agreement =
            this.safeNumber(
                confidenceResult &&
                confidenceResult.agreement
            );


        const predictionAgreement =
            this.safeNumber(
                confidenceResult &&
                confidenceResult.predictionAgreement
            );


        const prediction =
            this.extractPrediction(
                confidenceResult
            );


        const enoughModules =
            activeModules >=
            this.minimumModules;


        const confidencePassed =
            confidence >=
            this.minimumConfidence;


        const agreementPassed =
            agreement >=
            this.minimumAgreement;


        const predictionPassed =
            prediction !== null;


        const valid =
            enoughModules &&
            confidencePassed &&
            agreementPassed &&
            predictionPassed;


        const reasons = [];


        if (
            !enoughModules
        ) {

            reasons.push(
                "Not enough active modules"
            );
        }


        if (
            !confidencePassed
        ) {

            reasons.push(
                "Confidence below required threshold"
            );
        }


        if (
            !agreementPassed
        ) {

            reasons.push(
                "Module agreement below required threshold"
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

            reasons.push(
                "Validation passed"
            );
        }


        const result = {

            module:
                this.name,

            valid,

            success:
                valid,

            score:
                confidence,

            confidence,

            activeModules,

            agreement,

            predictionAgreement,

            prediction,

            checks: {

                enoughModules,

                confidencePassed,

                agreementPassed,

                predictionPassed
            },

            reason:
                valid
                    ? "Validation passed"
                    : reasons.join(
                        "; "
                    )
        };


        this.lastResult =
            result;


        return result;
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
        confidenceResult
    ) {

        if (
            !confidenceResult
        ) {

            return null;
        }


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
            "object"
        ) {

            if (
                Number.isInteger(
                    confidenceResult.prediction.digit
                )
            ) {

                return confidenceResult
                    .prediction
                    .digit;
            }
        }


        if (
            Number.isInteger(
                confidenceResult.digit
            )
        ) {

            return confidenceResult.digit;
        }


        return null;
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
            Number.isFinite(
                number
            )
        ) {

            return Math.max(
                0,
                Math.min(
                    100,
                    number
                )
            );
        }


        return fallback;
    }


    /* ==========================================================
     * ANALYZE ALIAS
     * ========================================================== */

    analyze(
        confidenceResult,
        results
    ) {

        return this.validate(
            confidenceResult,
            results
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

window.ValidatorEngine =
    ValidatorEngine;

window.validatorEngine =
    new ValidatorEngine();