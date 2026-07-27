class DecisionEngine {

    analyze(confidenceResult) {

        let signal = "WAIT";

        if (confidenceResult.score >= 90) {

            signal = "SIGNAL";

        } else if (confidenceResult.score >= 75) {

            signal = "MONITOR";

        }

        return {

            module: "decision",

            signal,

            confidence: confidenceResult.score,

            success: true

        };

    }

}

window.decisionEngine = DecisionEngine;
