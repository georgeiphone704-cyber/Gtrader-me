class CycleEngine {

    constructor() {
        this.name = "cycle";

        this.minSamples = 50;
        this.maxSamples = 500;

        this.minCycleLength = 2;
        this.maxCycleLength = 100;

        this.detectionThreshold = 0.60;
        this.strongThreshold = 0.90;

        this.lastResult = {
            module: this.name,
            detected: false,
            cycleLength: 0,
            strength: 0,
            score: 0,
            confidence: 0,
            pattern: "Waiting...",
            recommendation: "Collecting data",
            success: false
        };
    }

    analyze(digits) {

        if (!Array.isArray(digits)) {
            return this.createFailure("Invalid data");
        }

        const data = digits
            .slice(-this.maxSamples)
            .map(Number)
            .filter(
                digit =>
                    Number.isInteger(digit) &&
                    digit >= 0 &&
                    digit <= 9
            );

        if (data.length < this.minSamples) {
            return this.createFailure(
                "Insufficient valid data"
            );
        }

        const maxCycle = Math.min(
            Math.floor(data.length / 3),
            this.maxCycleLength
        );

        let bestCycle = 0;
        let bestStrength = 0;

        for (
            let length = this.minCycleLength;
            length <= maxCycle;
            length++
        ) {

            const strength =
                this.calculateCycleStrength(
                    data,
                    length
                );

            if (strength > bestStrength) {
                bestStrength = strength;
                bestCycle = length;
            }
        }

        const confidence =
            this.calculateConfidence(
                bestStrength,
                data.length
            );

        const detected =
            bestCycle > 0 &&
            bestStrength >= this.detectionThreshold;

        let pattern = "No strong cycle";
        let recommendation = "WAIT";

        if (detected) {

            pattern =
                `Possible ${bestCycle}-tick cycle`;

            if (confidence >= 90) {
                recommendation = "STRONG CYCLE";
            } else if (confidence >= 80) {
                recommendation = "WATCH CYCLE";
            } else {
                recommendation = "WEAK CYCLE";
            }

        }

        const score = Math.round(
            bestStrength * 100
        );

        this.lastResult = {
            module: this.name,
            detected,
            cycleLength: bestCycle,
            strength: score,
            score,
            confidence,
            pattern,
            recommendation,
            samples: data.length,
            success: true
        };

        return this.lastResult;
    }

    calculateCycleStrength(data, length) {

        if (
            !Array.isArray(data) ||
            length < this.minCycleLength ||
            data.length < length * 3
        ) {
            return 0;
        }

        let comparisons = 0;
        let matches = 0;

        for (
            let i = 0;
            i + length < data.length;
            i++
        ) {

            comparisons++;

            if (
                data[i] ===
                data[i + length]
            ) {
                matches++;
            }
        }

        if (comparisons === 0) {
            return 0;
        }

        const rawStrength =
            matches / comparisons;

        /*
         * A random single-digit stream has an
         * approximate 10% same-digit baseline.
         *
         * Normalize the observed repetition
         * against that baseline so ordinary
         * random repetition does not appear
         * artificially strong.
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

    calculateConfidence(
        strength,
        sampleSize
    ) {

        if (
            !Number.isFinite(strength) ||
            strength <= 0
        ) {
            return 0;
        }

        /*
         * More observations make the estimate
         * more stable.
         *
         * Sample size can improve confidence,
         * but cannot create a signal by itself.
         */

        const sampleFactor =
            Math.min(
                1,
                sampleSize / 300
            );

        /*
         * 75% of the confidence comes from
         * observed cycle strength.
         *
         * Up to 25% comes from sample support.
         */

        const confidence =
            strength *
            100 *
            (
                0.75 +
                (0.25 * sampleFactor)
            );

        return Math.round(
            Math.min(
                100,
                confidence
            )
        );
    }

    createFailure(reason) {

        this.lastResult = {
            module: this.name,
            detected: false,
            cycleLength: 0,
            strength: 0,
            score: 0,
            confidence: 0,
            pattern: reason,
            recommendation: "WAIT",
            samples: 0,
            success: false
        };

        return this.lastResult;
    }

    getResult() {
        return this.lastResult;
    }

    reset() {

        this.lastResult = {
            module: this.name,
            detected: false,
            cycleLength: 0,
            strength: 0,
            score: 0,
            confidence: 0,
            pattern: "Waiting...",
            recommendation: "Collecting data",
            success: false
        };
    }
}

window.CycleEngine = CycleEngine;
window.cycleEngine = new CycleEngine();
