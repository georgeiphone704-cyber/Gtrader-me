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

    compareRecentVsHistorical(data) {
        if (data.length < 40) {
            return null;
        }

        const recentSize =
            Math.min(30, Math.floor(data.length / 2));

        const recent =
            data.slice(-recentSize);

        const historical =
            data.slice(
                -(recentSize * 2),
                -recentSize
            );

        const recentFrequency =
            this.getFrequency(recent);

        const historicalFrequency =
            this.getFrequency(historical);

        let strongestDigit = null;
        let strongestChange = 0;

        for (let d = 0; d < 10; d++) {
            const recentRate =
                recentFrequency[d] / recent.length;

            const historicalRate =
                historicalFrequency[d] /
                historical.length;

            const change =
                recentRate - historicalRate;

            if (Math.abs(change) > Math.abs(strongestChange)) {
                strongestChange = change;
                strongestDigit = d;
            }
        }

        if (
            strongestDigit === null ||
            Math.abs(strongestChange) < 0.05
        ) {
            return null;
        }

        return {
            digit: strongestDigit,
            change: strongestChange,
            direction:
                strongestChange > 0
                    ? "INCREASING"
                    : "DECREASING"
        };
    }

    calculateConfidence(strength, sampleSize) {
        if (strength <= 0) {
            return 0;
        }

        /*
         * More observations can make an estimate more
         * stable, but they cannot manufacture a signal.
         */
        const sampleFactor =
            Math.min(1, sampleSize / 300);

        const confidence =
            strength *
            100 *
            (0.70 + (0.30 * sampleFactor));

        return Math.min(
            100,
            Number(confidence.toFixed(2))
        );
    }

    analyze(digits = []) {
        const data =
            this.normalizeDigits(digits)
                .slice(-this.maxSamples);

        if (data.length < this.minSamples) {
            this.lastResult = {
                module: this.name,
                success: false,
                detected: false,
                pattern: "Insufficient data",
                digit: null,
                strength: 0,
                confidence: 0,
                samples: data.length,
                recommendation: "COLLECTING DATA"
            };

            return this.lastResult;
        }

        const signals = [];

        const hot =
            this.detectHotDigit(data);

        if (hot) {
            signals.push({
                type: "HOT_DIGIT",
                digit: hot.digit,
                strength:
                    Math.max(
                        0,
                        Math.min(
                            1,
                            (hot.rate - 0.10) / 0.30
                        )
                    )
            });
        }

        const cold =
            this.detectColdDigit(data);

        if (cold) {
            signals.push({
                type: "COLD_DIGIT",
                digit: cold.digit,
                strength:
                    Math.max(
                        0,
                        Math.min(
                            1,
                            (0.10 - cold.rate) / 0.10
                        )
                    )
            });
        }

        const repeats =
            this.detectRepeats(data);

        if (repeats) {
            signals.push({
                type: "REPEAT_PATTERN",
                digit: data[data.length - 1],
                strength:
                    Math.max(
                        0,
                        Math.min(
                            1,
                            (repeats.rate - 0.10) / 0.40
                        )
                    )
            });
        }

        const alternation =
            this.detectAlternation(data);

        if (alternation) {
            signals.push({
                type: "ALTERNATION",
                digit: null,
                strength:
                    Math.max(
                        0,
                        Math.min(
                            1,
                            (alternation.rate - 0.50) / 0.50
                        )
                    )
            });
        }

        const streak =
            this.detectStreak(data);

        if (streak) {
            signals.push({
                type: "STREAK",
                digit: streak.digit,
                strength:
                    Math.min(
                        1,
                        streak.length / 8
                    )
            });
        }

        const shift =
            this.compareRecentVsHistorical(data);

        if (shift) {
            signals.push({
                type:
                    shift.direction === "INCREASING"
                        ? "RECENT_INCREASE"
                        : "RECENT_DECREASE",
                digit: shift.digit,
                strength:
                    Math.min(
                        1,
                        Math.abs(shift.change) / 0.20
                    )
            });
        }

        /*
         * Select the strongest observed pattern.
         * This engine does NOT execute a trade.
         */
        signals.sort(
            (a, b) => b.strength - a.strength
        );

        const strongest =
            signals.length > 0
                ? signals[0]
                : null;

        if (!strongest || strongest.strength < 0.20) {
            this.lastResult = {
                module: this.name,
                success: true,
                detected: false,
                pattern: "No strong pattern",
                digit: null,
                strength: 0,
                confidence: 0,
                samples: data.length,
                recommendation: "WAIT"
            };

            return this.lastResult;
        }

        const confidence =
            this.calculateConfidence(
                strongest.strength,
                data.length
            );

        let recommendation = "WEAK SIGNAL";

        if (confidence >= 85) {
            recommendation = "STRONG SIGNAL";
        } else if (confidence >= 70) {
            recommendation = "WATCH";
        }

        this.lastResult = {
            module: this.name,
            success: true,
            detected: true,
            pattern: strongest.type,
            digit: strongest.digit,
            strength:
                Number(
                    (strongest.strength * 100)
                        .toFixed(2)
                ),
            confidence,
            samples: data.length,
            recommendation,

            /*
             * Extra information for the master engine.
             * These values are evidence only.
             */
            signals: signals.map(signal => ({
                type: signal.type,
                digit: signal.digit,
                strength:
                    Number(
                        (signal.strength * 100)
                            .toFixed(2)
                    )
            }))
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
            pattern: "Waiting...",
            digit: null,
            strength: 0,
            confidence: 0,
            samples: 0,
            recommendation: "COLLECTING DATA"
        };
    }
}

window.PatternEngine = PatternEngine;
