/*
 * MARKOV DIGIT ENGINE
 * -------------------
 * Purpose:
 *   Analyze digit sequences using first-, second-, and third-order
 *   Markov transitions.
 *
 * Important:
 *   This module is an ANALYSIS module only.
 *   It does NOT place trades.
 *
 * Output:
 *   - predicted digit
 *   - model strength
 *   - confidence score
 *   - selected Markov order
 *   - sample count
 *   - transition evidence
 *
 * The final Decision Engine should combine this result with
 * the other analysis modules before deciding whether to trade.
 */

class MarkovEngine {

    constructor() {

        this.name = "markov";

        // Maximum Markov order.
        // 1 = previous digit
        // 2 = previous 2 digits
        // 3 = previous 3 digits
        this.maxOrder = 3;

        // Minimum observations required before analysis.
        this.minSamples = 30;

        // Maximum amount of recent data used.
        this.maxSamples = 300;

        // Recent observations receive more weight.
        this.decay = 0.995;

        // Minimum effective transition evidence.
        this.minTransitionEvidence = 3;

        // Small smoothing value prevents zero-probability problems.
        this.smoothing = 0.25;

        this.samples = 0;

        this.lastAnalysis = null;

        this.lastDataLength = 0;
    }


    /*
     * Reset the engine.
     */
    reset() {

        this.samples = 0;

        this.lastAnalysis = null;

        this.lastDataLength = 0;
    }


    /*
     * Convert input into valid digits.
     */
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


    /*
     * Convert a sequence into a state key.
     *
     * Example:
     * [3]       -> "3"
     * [3,7]     -> "3,7"
     * [3,7,1]   -> "3,7,1"
     */
    getKey(sequence) {

        return sequence.join(",");
    }


    /*
     * Create an empty probability state.
     */
    createState() {

        return {
            weights: Array(10).fill(0),
            total: 0,
            observations: 0
        };
    }


    /*
     * Build transition tables from the current data.
     *
     * This deliberately rebuilds from the current window rather than
     * continuously adding the same historical data again.
     */
    buildTransitions(data) {

        const transitions = {
            1: {},
            2: {},
            3: {}
        };

        const length = data.length;

        if (length < 2) {
            return transitions;
        }

        /*
         * Process every possible Markov order.
         */
        for (
            let order = 1;
            order <= this.maxOrder;
            order++
        ) {

            if (length <= order) {
                continue;
            }

            for (
                let i = order;
                i < length;
                i++
            ) {

                const history = data.slice(
                    i - order,
                    i
                );

                const nextDigit = data[i];

                const key = this.getKey(history);

                if (!transitions[order][key]) {
                    transitions[order][key] =
                        this.createState();
                }

                const state =
                    transitions[order][key];

                /*
                 * Newer observations receive more weight.
                 *
                 * age = 0 means newest observation.
                 */
                const age =
                    length - 1 - i;

                const weight =
                    Math.pow(this.decay, age);

                state.weights[nextDigit] += weight;

                state.total += weight;

                state.observations++;
            }
        }

        return transitions;
    }


    /*
     * Calculate probability distribution for a state.
     */
    calculateProbabilities(state) {

        if (!state || state.total <= 0) {
            return Array(10).fill(0);
        }

        const denominator =
            state.total +
            (this.smoothing * 10);

        return state.weights.map(
            weight =>
                (weight + this.smoothing) /
                denominator
        );
    }


    /*
     * Find strongest digit from a probability distribution.
     */
    findBestDigit(probabilities) {

        let bestDigit = 0;
        let bestProbability = -Infinity;

        for (
            let digit = 0;
            digit < 10;
            digit++
        ) {

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


    /*
     * Calculate how much stronger the best digit is
     * compared with the random 10% baseline.
     *
     * This is MODEL STRENGTH, not guaranteed win probability.
     */
    calculateStrength(
        probability,
        evidence
    ) {

        const baseline = 0.10;

        if (
            !Number.isFinite(probability) ||
            probability <= baseline
        ) {
            return 0;
        }

        /*
         * Normalize excess probability above the 10% baseline.
         */
        const rawStrength =
            (probability - baseline) /
            (1 - baseline);

        /*
         * Evidence factor prevents a tiny number of observations
         * from producing an exaggerated strength.
         */
        const evidenceFactor =
            Math.min(
                1,
                evidence / 20
            );

        const strength =
            rawStrength *
            evidenceFactor;

        return Math.max(
            0,
            Math.min(1, strength)
        );
    }


    /*
     * Calculate confidence.
     *
     * This is intentionally conservative.
     *
     * Confidence is NOT the probability that the next digit
     * will actually be correct.
     */
    calculateConfidence(
        strength,
        evidence
    ) {

        if (
            !Number.isFinite(strength) ||
            strength <= 0
        ) {
            return 0;
        }

        /*
         * More evidence stabilizes the estimate.
         */
        const evidenceFactor =
            Math.min(
                1,
                evidence / 50
            );

        /*
         * Keep the base confidence conservative.
         */
        const confidence =
            strength *
            100 *
            (
                0.70 +
                (0.30 * evidenceFactor)
            );

        return Math.min(
            100,
            Number(confidence.toFixed(2))
        );
    }


    /*
     * Get a prediction from a specific Markov order.
     */
    getPrediction(
        order,
        history,
        transitions
    ) {

        if (
            !Array.isArray(history) ||
            history.length < order
        ) {
            return null;
        }

        const key =
            this.getKey(
                history.slice(-order)
            );

        const state =
            transitions[order]?.[key];

        if (!state) {
            return null;
        }

        /*
         * Avoid trusting a state with almost no evidence.
         */
        if (
            state.observations < 2 ||
            state.total <= 0
        ) {
            return null;
        }

        const probabilities =
            this.calculateProbabilities(state);

        const best =
            this.findBestDigit(
                probabilities
            );

        const strength =
            this.calculateStrength(
                best.probability,
                state.observations
            );

        return {

            digit: best.digit,

            probability:
                Number(
                    (
                        best.probability * 100
                    ).toFixed(2)
                ),

            strength:
                Number(
                    (
                        strength * 100
                    ).toFixed(2)
                ),

            evidence:
                state.observations,

            totalWeight:
                Number(
                    state.total.toFixed(4)
                ),

            probabilities:
                probabilities.map(
                    value =>
                        Number(
                            (
                                value * 100
                            ).toFixed(2)
                        )
                ),

            order,

            key
        };
    }


    /*
     * Learn/build the model.
     *
     * Unlike the previous implementation, this does not repeatedly
     * accumulate the same historical ticks every time analyze()
     * runs.
     */
    learn(digits) {

        const data =
            this.normalizeDigits(digits)
                .slice(-this.maxSamples);

        this.samples = data.length;

        return this.buildTransitions(data);
    }


    /*
     * Main analysis function.
     */
    analyze(digits = []) {

        const data =
            this.normalizeDigits(digits)
                .slice(-this.maxSamples);

        /*
         * Not enough data.
         */
        if (
            data.length <
            this.minSamples
        ) {

            const result = {

                module: this.name,

                success: false,

                score: 0,

                prediction: null,

                order: 0,

                samples: data.length,

                strength: 0,

                confidence: 0,

                evidence: 0,

                reason:
                    "Insufficient digit data",

                recommendation:
                    "COLLECTING DATA"
            };

            this.lastAnalysis =
                result;

            return result;
        }


        /*
         * Build a fresh model from the current
         * analysis window.
         */
        const transitions =
            this.learn(data);


        /*
         * Try the strongest available model first.
         *
         * Order 3 → Order 2 → Order 1.
         */
        let prediction = null;

        for (
            let order = this.maxOrder;
            order >= 1;
            order--
        ) {

            prediction =
                this.getPrediction(
                    order,
                    data,
                    transitions
                );

            if (
                prediction &&
                prediction.evidence >=
                this.minTransitionEvidence
            ) {
                break;
            }

            prediction = null;
        }


        /*
         * No usable prediction.
         */
        if (!prediction) {

            const result = {

                module: this.name,

                success: true,

                score: 0,

                prediction: null,

                order: 0,

                samples: data.length,

                strength: 0,

                confidence: 0,

                evidence: 0,

                reason:
                    "No sufficiently supported transition",

                recommendation:
                    "WAIT"
            };

            this.lastAnalysis =
                result;

            return result;
        }


        /*
         * Determine model score.
         */
        const score =
            prediction.strength;


        /*
         * Conservative recommendation.
         *
         * IMPORTANT:
         * This does not mean "place a trade".
         * It only describes the Markov module's signal.
         */
        let recommendation =
            "WEAK SIGNAL";

        if (
            prediction.confidence >= 85 &&
            prediction.strength >= 60
        ) {

            recommendation =
                "STRONG SIGNAL";

        } else if (
            prediction.confidence >= 70 &&
            prediction.strength >= 40
        ) {

            recommendation =
                "WATCH SIGNAL";

        } else if (
            prediction.strength < 20
        ) {

            recommendation =
                "WAIT";
        }


        /*
         * Final module result.
         */
        const result = {

            module: this.name,

            success: true,

            score:

                Number(
                    score.toFixed(2)
                ),

            prediction: {

                digit:
                    prediction.digit,

                probability:
                    prediction.probability,

                strength:
                    prediction.strength,

                order:
                    prediction.order
            },

            /*
             * Convenient top-level fields for
             * the Decision Engine / Dashboard.
             */
            digit:
                prediction.digit,

            order:
                prediction.order,

            strength:
                prediction.strength,

            confidence:
                prediction.confidence,

            evidence:
                prediction.evidence,

            samples:
                data.length,

            transitionWeight:
                prediction.totalWeight,

            probabilities:
                prediction.probabilities,

            recommendation,

            reason:
                `Markov order ${prediction.order} selected with ${prediction.evidence} supported observations`
        };


        this.lastAnalysis =
            result;

        this.lastDataLength =
            data.length;

        return result;
    }


    /*
     * Return the most recent analysis.
     */
    getResult() {

        return this.lastAnalysis;
    }
}


/*
 * Expose globally so the website can use:
 *
 * window.MarkovEngine
 */
window.MarkovEngine =
    MarkovEngine;
