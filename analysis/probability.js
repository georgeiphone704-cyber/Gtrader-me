class ProbabilityEngine {

    constructor(memory) {
        this.memory = memory;
    }

    analyze() {

        const total = this.memory.digits.length;

        if (total === 0) {
            return {
                module: "probability",
                score: 0,
                probabilities: [],
                success: false
            };
        }

        const probabilities = this.memory.frequencies.map(count =>
            Number(((count / total) * 100).toFixed(2))
        );

        const score = Math.max(...probabilities);

        return {

            module: "probability",

            score,

            probabilities,

            success: true

        };

    }

}

window.probabilityEngine = ProbabilityEngine;
