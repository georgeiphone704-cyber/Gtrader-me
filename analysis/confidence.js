class ConfidenceEngine {

    analyze(patternResult, probabilityResult, statisticsResult) {

        const score = Number((

            (patternResult.score +
            probabilityResult.score +
            statisticsResult.score)

            / 3

        ).toFixed(2));

        return {

            module: "confidence",

            score,

            level:

                score >= 90 ? "HIGH" :
                score >= 75 ? "MEDIUM" :
                "LOW",

            success: true

        };

    }

}

window.confidenceEngine = ConfidenceEngine;
