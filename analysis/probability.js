class ProbabilityEngine {

    constructor(memory) {
        this.memory = memory;
    }

    analyze() {

        const frequencies = this.memory.frequencies;
        const digits = this.memory.digits;

        if (digits.length < 50) {
            return {
                module: "probability",
                score: 0,
                mostLikely: null,
                leastLikely: null,
                success: false
            };
        }

        const total = frequencies.reduce((a, b) => a + b, 0);

        const probabilities = frequencies.map(count =>
            total > 0 ? (count / total) * 100 : 0
        );

        const maxProbability = Math.max(...probabilities);
        const minProbability = Math.min(...probabilities);

        const mostLikely = probabilities.indexOf(maxProbability);
        const leastLikely = probabilities.indexOf(minProbability);

        let score = Math.round(maxProbability * 5);

        if (score > 100) score = 100;

        return {
            module: "probability",
            score,
            mostLikely,
            leastLikely,
            probabilities,
            success: true
        };
    }
}

window.probabilityEngine = ProbabilityEngine;
