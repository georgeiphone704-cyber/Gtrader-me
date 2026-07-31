class TransitionEngine {

    constructor(memory) {
        this.memory = memory;

        this.matrix = Array.from({ length: 10 }, () =>
            Array(10).fill(0)
        );
    }

    analyze() {

        const digits = this.memory.digits;

        if (digits.length < 2) {
            return {
                module: "transition",
                score: 0,
                success: false
            };
        }

        const previous = digits[digits.length - 2];
        const current = digits[digits.length - 1];

        this.matrix[previous][current]++;

        const row = this.matrix[current];

        const total = row.reduce((a, b) => a + b, 0);

        if (total === 0) {
            return {
                module: "transition",
                score: 0,
                nextDigit: null,
                success: false
            };
        }

        let nextDigit = 0;
        let highest = row[0];

        for (let i = 1; i < 10; i++) {
            if (row[i] > highest) {
                highest = row[i];
                nextDigit = i;
            }
        }

        const score = Math.round((highest / total) * 100);

        return {
            module: "transition",
            score,
            currentDigit: current,
            nextDigit,
            success: true
        };
    }

}

window.TransitionEngine = TransitionEngine;
