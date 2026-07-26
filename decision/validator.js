class ValidatorEngine {

    constructor() {
        this.minimumConfidence = 85;
        this.minimumTicks = 100;
    }

    validate(memory, confidence) {

        if (memory.digits.length < this.minimumTicks) {
            return {
                valid: false,
                reason: "Not enough data"
            };
        }

        if (confidence.score < this.minimumConfidence) {
            return {
                valid: false,
                reason: "Confidence too low"
            };
        }

        return {
            valid: true,
            reason: "Validation passed"
        };

    }

}

window.validatorEngine = new ValidatorEngine();
