class ConfidenceEngine {

    constructor() {
        this.minActiveModules = 2;
        this.minConfidence = 90;
    }

    analyze(
        pattern,
        probability,
        statistics,
        transition,
        markov,
        cycle
    ) {

        const modules = [
            pattern,
            probability,
            statistics,
            transition,
            markov,
            cycle
        ];

        const validModules = modules.filter(module =>
            module &&
            module.success === true &&
            Number.isFinite(Number(module.score))
        );

        if (validModules.length < this.minActiveModules) {
            return {
                module: "confidence",
                score: 0,
                confidence: 0,
                activeModules: validModules.length,
                agreement: 0,
                success: false
            };
        }

        let total = 0;

        for (const module of validModules) {

            const score = Math.max(
                0,
                Math.min(100, Number(module.score))
            );

            total += score;
        }

        const score = Math.round(
            total / validModules.length
        );

        const agreement = Math.round(
            (
                validModules.filter(
                    module =>
                        Number(module.score) >= this.minConfidence
                ).length /
                validModules.length
            ) * 100
        );

        const confidence = Math.round(
            (score * 0.7) +
            (agreement * 0.3)
        );

        return {
            module: "confidence",
            score: score,
            confidence: confidence,
            activeModules: validModules.length,
            agreement: agreement,
            success: confidence >= this.minConfidence
        };
    }

    getThreshold() {
        return this.minConfidence;
    }

    setThreshold(value) {

        const threshold = Number(value);

        if (!Number.isFinite(threshold)) {
            return false;
        }

        this.minConfidence = Math.max(
            0,
            Math.min(100, threshold)
        );

        return true;
    }
}

window.confidenceEngine = new ConfidenceEngine();
