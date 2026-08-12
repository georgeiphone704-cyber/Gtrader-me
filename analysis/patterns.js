class PatternEngine {
    constructor() {
        this.name = "patterns";

        this.minSamples = 30;
        this.maxSamples = 300;

        this.lastResult = {
            module: this.name,
            success: false,
            detected: false,
            pattern: "Waiting...",
            digit: null,
            strength: 0,
            confidence: 0,
            samples: 0,
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

    getFrequency(data) {
        const frequency = Array(10).fill(0);

        for (const digit of data) {
            frequency[digit]++;
        }

        return frequency;
    }

    getRecentFrequency(data, windowSize = 50) {
        const recent = data.slice(-windowSize);
        return this.getFrequency(recent);
    }

    getDominantDigit(frequency) {
        let digit = null;
        let highest = 0;

        for (let d = 0; d < 10; d++) {
            if (frequency[d] > highest) {
                highest = frequency[d];
                digit = d;
            }
        }

        return {
            digit,
            count: highest
        };
    }

    calculateFrequencyStrength(data) {
        if (data.length === 0) {
            return 0;
        }

        const frequency = this.getFrequency(data);
        const dominant = this.getDominantDigit(frequency);

        const observedRate =
            dominant.count / data.length;

        /*
         * Random single-digit baseline = 10%.
         * Convert excess concentration above the baseline
         * into a normalized 0-1 strength.
         */
        const baseline = 0.10;

        const strength =
            (observedRate - baseline) /
            (1 - baseline);

        return Math.max(
            0,
            Math.min(1, strength)
        );
    }

    detectHotDigit(data) {
        if (data.length < this.minSamples) {
            return null;
        }

        const recent = data.slice(-50);
        const frequency = this.getFrequency(recent);

        const dominant =
            this.getDominantDigit(frequency);

        const rate =
            dominant.count / recent.length;

        /*
         * A hot digit needs to be noticeably above
         * the 10% random baseline.
         */
        if (rate < 0.16) {
            return null;
        }

        return {
            digit: dominant.digit,
            rate,
            count: dominant.count
        };
    }

    detectColdDigit(data) {
        if (data.length < this.minSamples) {
            return null;
        }

        const recent = data.slice(-50);
        const frequency = this.getFrequency(recent);

        let digit = 0;
        let lowestRate = Infinity;

        for (let d = 0; d < 10; d++) {
            const rate =
                frequency[d] / recent.length;

            if (rate < lowestRate) {
                lowestRate = rate;
                digit = d;
            }
        }

        /*
         * Only report a cold digit when its occurrence
         * is meaningfully below the 10% baseline.
         */
        if (lowestRate > 0.06) {
            return null;
        }

        return {
            digit,
            rate: lowestRate,
            count: frequency[digit]
        };
    }

    detectRepeats(data) {
        if (data.length < 2) {
            return null;
        }

        let repeats = 0;
        let comparisons = 0;

        for (let i = 1; i < data.length; i++) {
            comparisons++;

            if (data[i] === data[i - 1]) {
                repeats++;
            }
        }

        if (comparisons === 0) {
            return null;
        }

        const rate =
            repeats / comparisons;

        /*
         * A repeat rate around 10% is a normal
         * single-digit baseline.
         */
        if (rate < 0.15) {
            return null;
        }

        return {
            rate,
            repeats,
            comparisons
        };
    }

    detectAlternation(data) {
        if (data.length < 10) {
            return null;
        }

        let alternating = 0;
        let comparisons = 0;

        for (let i = 2; i < data.length; i++) {
            comparisons++;

            const previousDirection =
                data[i - 1] > data[i - 2];

            const currentDirection =
                data[i] > data[i - 1];

            if (
                data[i - 1] !== data[i - 2] &&
                data[i] !== data[i - 1] &&
                previousDirection !== currentDirection
            ) {
                alternating++;
            }
        }

        if (comparisons === 0) {
            return null;
        }

        const rate =
            alternating / comparisons;

        if (rate < 0.65) {
            return null;
        }

        return {
            rate,
            alternating,
            comparisons
        };
    }

    detectStreak(data) {
        if (data.length < 5) {
            return null;
        }

        let longestDigit = null;
        let longestLength = 1;

        let currentDigit = data[0];
        let currentLength = 1;

        for (let i = 1; i < data.length; i++) {
            if (data[i] === currentDigit) {
                currentLength++;

                if (currentLength > longestLength) {
                    longestLength = currentLength;
                    longestDigit = currentDigit;
                }
            } else {
                currentDigit = data[i];
                currentLength = 1;
            }
        }

        if (longestLength < 3) {
            return null;
        }

        return {
            digit: longestDigit,
            length: longestLength
        };
    }

    compare
