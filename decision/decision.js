class DecisionEngine {

    analyze(confidence) {

        let signal = "WAIT";
        let recommendation = "Analyzing";

        if (confidence.score >= 90) {

            signal = "STRONG BUY";
            recommendation = "High probability entry";

        } else if (confidence.score >= 80) {

            signal = "BUY";
            recommendation = "Entry conditions good";

        } else if (confidence.score >= 70) {

            signal = "WATCH";
            recommendation = "Monitor market";

        }

        return {

            module: "decision",

            signal,

            recommendation,

            confidence: confidence.score,

            success: true

        };

    }

}

window.DecisionEngine = DecisionEngine;
