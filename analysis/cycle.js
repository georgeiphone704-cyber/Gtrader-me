class CycleEngine {

    constructor() {
        this.name = "cycle";
        this.minSamples = 50;
        this.maxSamples = 500;

        this.lastResult = {
            detected: false,
            cycleLength: 0,
            strength: 0,
            confidence: 0,
            pattern: "Waiting...",
            recommendation: "Collecting data"
        };
    }

    analyze(digits) {

        if (!Array.isArray(digits) || digits.length < this.minSamples) {
            return {
                module: this.name,
                detected: false,
                cycleLength: 0,
                strength: 0,
                confidence: 0,
                pattern: "Insufficient data",
                recommendation: "Collecting market data",
                success: false
            };
        }

        const data = digits
            .slice(-this.maxSamples)
            .map(Number)
            .filter(d => Number.isInteger(d) && d >= 0 && d <= 9);

        if (data.length < this.minSamples) {
            return {
                module: this.name,
                detected: false,
                cycleLength: 0,
                strength: 0,
                confidence: 0,
                pattern: "Insufficient valid data",
                recommendation: "Collecting market data",
                success: false
            };
        }

        let bestCycle = 0;
        let bestStrength = 0;

        const maxCycle = Math.min(
            Math.floor(data.length / 3),
            100
        );

        for (let length = 2; length <= maxCycle; length++) {

            const strength = this.calculateCycleStrength(
                data,
                length
            );

            if (strength > bestStrength) {
                bestStrength = strength;
                bestCycle = length;
            }
        }

        const confidence = this.calculateConfidence(
            bestStrength,
            data.length
        );

        const detected = (
            bestCycle > 0 &&
            bestStrength >= 0.60
        );

        let pattern = "No strong cycle";
        let recommendation = "WAIT";

        if (detected) {
            pattern = `Possible ${bestCycle}-tick cycle`;

            if (confidence >= 90) {
                recommendation = "STRONG CYCLE";
            } else if (confidence >= 80) {
                recommendation = "WATCH CYCLE";
            } else {
                recommendation = "WEAK CYCLE";
            }
        }

        this.lastResult = {
            module: this.name,
            detected,
            cycleLength: bestCycle,
            strength: Number(
                (bestStrength * 100).toFixed(2)
            ),
            confidence,
            pattern,
            recommendation,
            success: true
        };

        return this.lastResult;
    }

    calculateCycleStrength(data, length) {

        if (data.length < length * 3) {
            return 0;
        }

        let comparisons = 0;
        let matches = 0;

        /*
         * Compare digits separated by the proposed
         * cycle length.
         */
        for (
            let i = 0;
            i + length < data.length;
            i++
        ) {
            comparisons++;

            if (data[i] === data[i + length]) {
                matches++;
            }
        }

        if (comparisons === 0) {
            return 0;
        }

        const rawStrength =
            matches / comparisons;

        /*
         * A random digit stream has an approximate
         * single-digit match baseline of 10%.
         *
         * We measure how much stronger the observed
         * repetition is than that baseline.
         */
        const baseline = 0.10;

        const adjusted =
            (rawStrength - baseline) /
            (1 - baseline);

        return Math.max(
            0,
            Math.min(1, adjusted)
        );
    }

    calculateConfidence(strength, sampleSize) {

        if (strength <= 0) {
            return 0;
        }

        /*
         * More observations make the estimate more
         * stable, but sample size cannot create a
         * strong signal by itself.
         */
        const sampleFactor = Math.min(
            1,
            sampleSize / 300
        );

        const confidence =
            strength *
            100 *
            (0.75 + (0.25 * sampleFactor));

        return Math.min(
            100,
            Number(confidence.toFixed(2))
        );
    }

    getResult() {
        return this.lastResult;
    }
}

window.CycleEngine = CycleEngine;
