class EntryLogic {

    constructor() {
        this.minConfidence = 85;
        this.minAgreement = 0.70;
        this.minSamples = 50;

        this.lastResult = {
            action: "WAIT",
            direction: null,
            confidence: 0,
            agreement: 0,
            reason: "Waiting for analysis"
        };
    }

    analyze(results = {}) {

        const confidence = this.getNumber(
            results.confidence?.score
        );

        const samples = this.getNumber(
            results.samples ??
            results.statistics?.samples ??
            results.statistics?.count
        );

        if (confidence < this.minConfidence) {
            return this.save({
                action: "WAIT",
                direction: null,
                confidence,
                agreement: 0,
                reason: "Confidence below entry threshold"
            });
        }

        if (samples > 0 && samples < this.minSamples) {
            return this.save({
                action: "WAIT",
                direction: null,
                confidence,
                agreement: 0,
                reason: "Insufficient market history"
            });
        }

        const signals = this.collectSignals(results);

        if (signals.length === 0) {
            return this.save({
                action: "WAIT",
                direction: null,
                confidence,
                agreement: 0,
                reason: "No usable directional signals"
            });
        }

        const bullish = signals.filter(
            signal => signal === "BUY"
        ).length;

        const bearish = signals.filter(
            signal => signal === "SELL"
        ).length;

        const total = signals.length;

        const strongestSide =
            bullish > bearish ? "BUY" :
            bearish > bullish ? "SELL" :
            null;

        if (!strongestSide) {
            return this.save({
                action: "WAIT",
                direction: null,
                confidence,
                agreement: 0,
                reason: "Analysis signals conflict"
            });
        }

        const agreement =
            Math.max(bullish, bearish) / total;

        if (agreement < this.minAgreement) {
            return this.save({
                action: "WAIT",
                direction: strongestSide,
                confidence,
                agreement: Number(
                    agreement.toFixed(3)
                ),
                reason: "Insufficient module agreement"
            });
        }

        return this.save({
            action: "ENTRY_READY",
            direction: strongestSide,
            confidence,
            agreement: Number(
                agreement.toFixed(3)
            ),
            reason: "Confidence and module agreement confirmed"
        });
    }

    collectSignals(results) {

        const signals = [];

        const modules = [
            results.pattern,
            results.probability,
            results.statistics,
            results.transition,
            results.markov,
            results.cycle
        ];

        for (const module of modules) {

            if (!module) continue;

            const signal =
                module.signal ??
                module.direction ??
                module.recommendation;

            if (
                signal === "BUY" ||
                signal === "SELL"
            ) {
                signals.push(signal);
            }
        }

        return signals;
    }

    getNumber(value) {

        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : 0;
    }

    save(result) {

        this.lastResult = {
            module: "entryLogic",
            ...result,
            success: true
        };

        return this.lastResult;
    }

    getResult() {
        return this.lastResult;
    }

    setConfidenceThreshold(value) {

        const threshold = Number(value);

        if (
            Number.isFinite(threshold) &&
            threshold >= 0 &&
            threshold <= 100
        ) {
            this.minConfidence = threshold;
        }
    }
}

window.entryLogic =
    new EntryLogic();
