class TransitionEngine {

    constructor() {
        this.name = "transition";

        this.minSamples = 30;
        this.maxSamples = 300;

        this.minTransitionCount = 3;
        this.smoothing = 0.25;

        this.lastResult = {
            module: this.name,
            success: false,
            detected: false,
            fromDigit: null,
            predictedDigit: null,
            probability: 0,
            score: 0,
            confidence: 0,
            samples: 0,
            evidence: 0,
            recommendation: "COLLECTING DATA"
        };
    }

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
     * Build digit-to-digit transition counts.
     *
     * Example:
     *
     * 4 -> 7
     *
     * means digit 4 was followed by digit 7.
     */
    buildTransitions(data) {

        const transitions = {};

        for (let digit = 0; digit <= 9; digit++) {
            transitions[digit] = {
                counts: Array(10).fill(0),
                total: 0
            };
        }

        for (let i = 1; i < data.length; i++) {

            const previous =
                data[i - 1];

            const current =
                data[i];

            transitions[previous]
                .counts[current]++;

            transitions[previous]
                .total++;
        }

        return transitions;
    }

    /*
     * Build a recency-weighted transition model.
     *
     * Newer transitions have slightly more influence
     * than older transitions.
     */
    buildWeightedTransitions(data) {

        const transitions = {};

        for (let digit = 0; digit <= 9; digit++) {

            transitions[digit] = {
                weights: Array(10).fill(0),
                totalWeight: 0,
                observations: 0
            };
        }

        const length = data.length;

        for (let i = 1; i < length; i++) {

            const previous =
                data[i - 1];

            const current =
                data[i];

            const age =
                length - 1 - i;

            /*
             * Recency decay.
             *
             * Older observations still matter,
             * but their influence gradually decreases.
             */
            const weight =
                Math.pow(
                    0.995,
                    age
                );

            transitions[previous]
                .weights[current] += weight;

            transitions[previous]
                .totalWeight += weight;

            transitions[previous]
                .observations++;
        }

        return transitions;
    }

    calculateProbabilities(state) {

        if (
            !state ||
            state.totalWeight <= 0
        ) {
            return Array(10).fill(0);
        }

        const denominator =
            state.totalWeight +
            (this.smoothing * 10);

        return state.weights.map(
            weight =>
                (
                    weight +
                    this.smoothing
                ) / denominator
        );
    }

    getBestDigit(probabilities) {

        let digit = 0;
        let probability = 0;

        for (
            let d = 0;
            d <= 9;
            d++
        ) {

            if (
                probabilities[d] >
                probability
            ) {

                probability =
                    probabilities[d];

                digit = d;
            }
        }

        return {
            digit,
            probability
        };
    }

    calculateStrength(
        probability,
        evidence
    ) {

        /*
         * Ten digits gives a 10% baseline.
         *
         * Strength measures how much the observed
         * transition exceeds that baseline.
         *
         * It is NOT a guaranteed winning probability.
         */
        const baseline = 0.10;

        if (
            probability <= baseline
        ) {
            return 0;
        }

        const rawStrength =
            (
                probability -
                baseline
            ) /
            (1 - baseline);

        /*
         * Prevent tiny samples from creating
         * an exaggerated signal.
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
            Math.min(
                1,
                strength
            )
        );
    }

    calculateConfidence(
        strength,
        evidence
    ) {

        if (
            strength <= 0
        ) {
            return 0;
        }

        const evidenceFactor =
            Math.min(
                1,
                evidence / 30
            );

        const confidence =
            strength *
            100 *
            (
                0.70 +
                (
                    0.30 *
                    evidenceFactor
                )
            );

        return Number(
            Math.min(
                100,
                confidence
            ).toFixed(2)
        );
    }

    analyze(digits = []) {

        const data =
            this.normalizeDigits(digits)
                .slice(-this.maxSamples);

        if (
            data.length <
            this.minSamples
        ) {

            this.lastResult = {
                module: this.name,
                success: false,
                detected: false,
                fromDigit: null,
                predictedDigit: null,
                probability: 0,
                score: 0,
                confidence: 0,
                samples: data.length,
                evidence: 0,
                recommendation:
                    "COLLECTING DATA",
                reason:
                    "Insufficient transition data"
            };

            return this.lastResult;
        }

        const weightedTransitions =
            this.buildWeightedTransitions(
                data
            );

        /*
         * The transition being evaluated is:
         *
         * latest digit -> next digit
         */
        const fromDigit =
            data[data.length - 1];

        const state =
            weightedTransitions[
                fromDigit
            ];

        if (
            !state ||
            state.observations <
            this.minTransitionCount
        ) {

            this.lastResult = {
                module: this.name,
                success: true,
                detected: false,
                fromDigit,
                predictedDigit: null,
                probability: 0,
                score: 0,
                confidence: 0,
                samples: data.length,
                evidence:
                    state
                        ? state.observations
                        : 0,
                recommendation: "WAIT",
                reason:
                    "Not enough historical transitions from current digit"
            };

            return this.lastResult;
        }

        const probabilities =
            this.calculateProbabilities(
                state
            );

        const best =
            this.getBestDigit(
                probabilities
            );

        const strength =
            this.calculateStrength(
                best.probability,
                state.observations
            );

        const confidence =
            this.calculateConfidence(
                strength,
                state.observations
            );

        let recommendation =
            "WAIT";

        if (
            confidence >= 85 &&
            strength >= 0.40
        ) {

            recommendation =
                "STRONG SIGNAL";

        } else if (
            confidence >= 70 &&
            strength >= 0.25
        ) {

            recommendation =
                "WATCH";

        } else if (
            confidence >= 50 &&
            strength >= 0.15
        ) {

            recommendation =
                "WEAK SIGNAL";
        }

        this.lastResult = {

            module: this.name,

            success: true,

            detected:
                strength >= 0.15,

            fromDigit,

            predictedDigit:
                best.digit,

            digit:
                best.digit,

            probability:
                Number(
                    (
                        best.probability *
                        100
                    ).toFixed(2)
                ),

            score:
                Number(
                    (
                        strength *
                        100
                    ).toFixed(2)
                ),

            confidence,

            samples:
                data.length,

            evidence:
                state.observations,

            recommendation,

            probabilities:
                probabilities.map(
                    value =>
                        Number(
                            (
                                value *
                                100
                            ).toFixed(2)
                        )
                ),

            transitionWeight:
                Number(
                    state.totalWeight
                        .toFixed(4)
                )
        };

        return this.lastResult;
    }

    getResult() {
        return this.lastResult;
    }

    reset() {

        this.lastResult = {
            module: this.name,
            success: false,
            detected: false,
            fromDigit: null,
            predictedDigit: null,
            probability: 0,
            score: 0,
            confidence: 0,
            samples: 0,
            evidence: 0,
            recommendation:
                "COLLECTING DATA"
        };
    }
}

window.TransitionEngine =
    TransitionEngine;

window.transitionEngine =
    new TransitionEngine();
