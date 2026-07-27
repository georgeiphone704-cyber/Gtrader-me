class PatternEngine {

    constructor(memory) {
        this.memory = memory;
    }

    analyze() {

        const digits = this.memory.digits;
        const frequencies = this.memory.frequencies;

        const hot = frequencies.indexOf(Math.max(...frequencies));
        const cold = frequencies.indexOf(Math.min(...frequencies));

        return {

            module: "patterns",

            score: 0,

            hotDigit: hot,

            coldDigit: cold,

            last20: digits.slice(-20),

            success: true

        };

    }

}

window.patternEngine = PatternEngine;
