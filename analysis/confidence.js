class ConfidenceEngine {

    analyze(pattern, probability, statistics) {

        const modules = [
            pattern,
            probability,
            statistics
        ];

        let total = 0;
        let active = 0;

        for (const module of modules) {

            if (module && module.success) {

                total += module.score;
                active++;

            }

        }

        if (active === 0) {

            return {
                module: "confidence",
                score: 0,
                activeModules: 0,
                success: false
            };

        }

        const score = Math.round(total / active);

        return {

            module: "confidence",

            score,

            activeModules: active,

            success: true

        };

    }

}

window.confidenceEngine = new ConfidenceEngine();
