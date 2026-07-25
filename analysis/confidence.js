class ConfidenceEngine {

    constructor() {
        this.maxScore = 100;
    }

    calculate(patternScore, probabilityScore, statisticsScore) {

        const total =
            (patternScore + probabilityScore + statisticsScore) / 3;

        return {

            score: Number(total.toFixed(2)),

            status:
                total >= 85 ? "HIGH" :
                total >= 70 ? "MEDIUM" :
                "LOW"

        };

    }

}
