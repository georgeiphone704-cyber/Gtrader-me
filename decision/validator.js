class ValidatorEngine {

    validate(memory, confidence) {

        if (!confidence.success) {
            return {
                valid: false,
                reason: "Confidence unavailable"
            };
        }

        if (memory.ticks.length < 100) {
            return {
                valid: false,
                reason: "Collecting market data"
            };
        }

        if (confidence.score < 75) {
            return {
                valid: false,
                reason: "Confidence too low"
            };
        }

        return {
            valid: true,
            reason: "Conditions satisfied"
        };
    }

}

window.validatorEngine = new ValidatorEngine();
