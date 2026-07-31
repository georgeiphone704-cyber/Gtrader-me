class PatternEngine {

    constructor(memory) {
        this.memory = memory;
    }

    analyze() {

        const digits = this.memory.digits;
        const frequencies = this.memory.frequencies;

        if (digits.length < 20) {
            return {
                module: "patterns",
                score: 0,
                hotDigit: null,
                coldDigit: null,
                streak: 0,
                repeating: false,
                alternating: false,
                last20: digits,
                success: false
            };
        }

        const hot = frequencies.indexOf(Math.max(...frequencies));
        const cold = frequencies.indexOf(Math.min(...frequencies));

        const last20 = digits.slice(-20);

        let streak = 1;

        for (let i = last20.length - 1; i > 0; i--) {
            if (last20[i] === last20[i - 1]) {
                streak++;
            } else {
                break;
            }
        }

        let repeating = false;

        if (last20.length >= 4) {
            repeating =
                last20[last20.length - 1] === last20[last20.length - 2] &&
                last20[last20.length - 2] === last20[last20.length - 3];
        }

        let alternating = true;

        for (let i = 2; i < last20.length; i++) {
            if (last20[i] !== last20[i - 2]) {
                alternating = false;
                break;
            }
        }

        let score = 40;

        if (streak >= 2) score += 15;
        if (streak >= 3) score += 15;
        if (repeating) score += 15;
        if (alternating) score += 15;

        score = Math.min(score, 100);

        return {
            module: "patterns",
            score,
            hotDigit: hot,
            coldDigit: cold,
            streak,
            repeating,
            alternating,
            last20,
            success: true
        };
    }
}

window.patternEngine = PatternEngine;
