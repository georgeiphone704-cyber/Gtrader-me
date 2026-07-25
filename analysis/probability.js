class ProbabilityEngine {

    constructor(memory) {
        this.memory = memory;
    }

    calculate() {

        const total = this.memory.digits.length;

        if (total === 0) {

            return {
                score: 0,
                probabilities: Array(10).fill(0)
            };

        }

        const probabilities = this.memory.frequencies.map(count => {

            return Number(((count / total) * 100).toFixed(2));

        });

        const highest = Math.max(...probabilities);

        return {

            score: highest,

            probabilities

        };

    }

  }
