class MarkovEngine {

    constructor() {

        this.maxOrder = 3;
        this.minSamples = 30;
        this.decay = 0.995;

        this.transitions = {
            1: {},
            2: {},
            3: {}
        };

        this.samples = 0;
        this.lastAnalysis = null;
    }


    reset() {

        this.transitions = {
            1: {},
            2: {},
            3: {}
        };

        this.samples = 0;
        this.lastAnalysis = null;
    }


    normalizeDigits(digits) {

        if (!Array.isArray(digits)) return [];

        return digits
            .map(Number)
            .filter(digit =>
                Number.isInteger(digit) &&
                digit >= 0 &&
                digit <= 9
            );

    }


    getKey(sequence) {

        return sequence.join(",");

    }


    ensureState(order, key) {

        if (!this.transitions[order][key]) {

            this.transitions[order][key] =
                Array(10).fill(0);

        }

        return this.transitions[order][key];

    }


    learn(digits) {

        const data = this.normalizeDigits(digits);

        if (data.length < 2) return;


        for (let i = 0; i < data.length; i++) {

            for (
                let order = 1;
                order <= this.maxOrder;
                order++
            ) {

                if (i < order) continue;


                const history =
                    data.slice(i - order, i);

                const nextDigit = data[i];

                const key =
                    this.getKey(history);

                const state =
                    this.ensureState(order, key);


                /*
                 * Apply a small decay to older
                 * observations before adding the
                 * newest observation.
                 */

                for (let d = 0; d < 10; d++) {

                    state[d] *= this.decay;

                }


                state[nextDigit] += 1;

            }

        }


        this.samples += data.length - 1;

    }


    getPrediction(order, history) {

        if (history.length < order) {

            return null;

        }


        const key =
            this.getKey(
                history.slice(-order)
            );


        const state =
            this.transitions[order][key];


        if (!state) return null;


        let total = 0;

        let bestDigit = null;

        let bestWeight = 0;


        for (let digit = 0; digit < 10; digit++) {

            total += state[digit];


            if (state[digit] > bestWeight) {

                bestWeight = state[digit];

                bestDigit = digit;

            }

        }


        if (total <= 0 || bestDigit === null) {

            return null;

        }


        return {

            digit: bestDigit,

            strength:
                (bestWeight / total) * 100,

            total

        };

    }


    analyze(digits = []) {

        const data =
            this.normalizeDigits(digits);


        if (data.length < 2) {

            return {

                module: "markov",

                success: false,

                score: 0,

                prediction: null,

                order: 0,

                samples: this.samples,

                reason: "Insufficient digit data"

            };

        }


        /*
         * Learn only the newest observations.
         * This prevents repeatedly counting the
         * entire memory every analysis cycle.
         */

        const learningWindow =
            data.slice(
                Math.max(
                    0,
                    data.length - 100
                )
            );


        this.learn(learningWindow);


        /*
         * Prefer the highest available order.
         * Fall back to lower orders when there
         * isn't enough transition data.
         */

        let result = null;


        for (
            let order = this.maxOrder;
            order >= 1;
            order--
        ) {

            const prediction =
                this.getPrediction(
                    order,
                    data
                );


            if (
                prediction &&
                prediction.total >= 2
            ) {

                result = {

                    ...prediction,

                    order

                };

                break;

            }

        }


        if (!result) {

            return {

                module: "markov",

                success: false,

                score: 0,

                prediction: null,

                order: 0,

                samples: this.samples,

                reason: "Insufficient transition history"

            };

        }


        /*
         * Don't call a weak statistical preference
         * a strong signal.
         *
         * The score is a model-strength score,
         * not a guaranteed probability of the next
         * digit occurring.
         */

        const score =
            Math.max(
                0,
                Math.min(
                    100,
                    Math.round(result.strength)
                )
            );


        const analysis = {

            module: "markov",

            success: true,

            prediction: result.digit,

            score,

            order: result.order,

            samples: this.samples,

            transitionStrength:
                Number(
                    result.strength.toFixed(2)
                )

        };


        this.lastAnalysis = analysis;

        return analysis;

    }

}


window.markovEngine =
    new MarkovEngine();
