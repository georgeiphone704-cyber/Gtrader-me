class PatternEngine {

    constructor(memory) {
        this.memory = memory;
    }

    getLastDigits(count = 20) {
        return this.memory.digits.slice(-count);
    }

    getFrequency() {
        return [...this.memory.frequencies];
    }

    getHotDigits() {

        const frequency = this.getFrequency();

        return frequency
            .map((count, digit) => ({ digit, count }))
            .sort((a, b) => b.count - a.count);

    }

    getColdDigits() {

        const frequency = this.getFrequency();

        return frequency
            .map((count, digit) => ({ digit, count }))
            .sort((a, b) => a.count - b.count);

    }

    analyze() {

        return {

            last20: this.getLastDigits(),

            hot: this.getHotDigits(),

            cold: this.getColdDigits()

        };

    }

                }
