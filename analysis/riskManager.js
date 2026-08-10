class RiskManager {
    constructor() {
        this.enabled = true;

        this.config = {
            maxStake: 1.00,
            maxLossPerSession: 5.00,
            maxConsecutiveLosses: 5,
            maxDrawdown: 10.00,
            minBalance: 10.00,
            minConfidence: 90
        };

        this.session = {
            startingBalance: 100,
            currentBalance: 100,
            sessionProfit: 0,
            consecutiveLosses: 0,
            peakBalance: 100,
            drawdown: 0
        };

        this.lastDecision = {
            action: "WAIT",
            reason: "Risk manager initialized"
        };
    }

    evaluate(signal, trade = {}) {
        if (!this.enabled) {
            return this.block("Risk manager disabled");
        }

        if (!signal || signal.action !== "ENTRY_READY") {
            return this.block("Entry not confirmed");
        }

        const confidence = Number(signal.confidence) || 0;

        if (confidence < this.config.minConfidence) {
            return this.block("Confidence below risk threshold");
        }

        const stake = Number(trade.stake);

        if (!Number.isFinite(stake) || stake <= 0) {
            return this.block("Invalid stake");
        }

        if (stake > this.config.maxStake) {
            return this.block("Stake exceeds maximum allowed");
        }

        if (stake > this.session.currentBalance) {
            return this.block("Insufficient balance");
        }

        if (
            this.session.currentBalance <=
            this.config.minBalance
        ) {
            return this.block("Minimum balance protection triggered");
        }

        if (
            this.session.consecutiveLosses >=
            this.config.maxConsecutiveLosses
        ) {
            return this.block("Consecutive-loss protection triggered");
        }

        if (
            Math.abs(this.session.sessionProfit) >=
            this.config.maxLossPerSession &&
            this.session.sessionProfit < 0
        ) {
            return this.block("Session loss limit reached");
        }

        if (
            this.session.drawdown >=
            this.config.maxDrawdown
        ) {
            return this.block("Maximum drawdown reached");
        }

        return this.approve({
            confidence,
            stake
        });
    }

    approve(data = {}) {
        this.lastDecision = {
            action: "APPROVE",
            allowed: true,
            confidence: data.confidence || 0,
            stake: data.stake || 0,
            reason: "Risk conditions passed"
        };

        return this.lastDecision;
    }

    block(reason) {
        this.lastDecision = {
            action: "BLOCK",
            allowed: false,
            reason
        };

        return this.lastDecision;
    }

    recordTrade(result, profit = 0) {
        const outcome = String(result).toUpperCase();
        const amount = Number(profit);

        if (
            outcome !== "WIN" &&
            outcome !== "LOSS"
        ) {
            return {
                success: false,
                reason: "Invalid trade result"
            };
        }

        if (!Number.isFinite(amount)) {
            return {
                success: false,
                reason: "Invalid profit value"
            };
        }

        this.session.sessionProfit += amount;
        this.session.currentBalance += amount;

        if (outcome === "LOSS") {
            this.session.consecutiveLosses++;
        } else {
            this.session.consecutiveLosses = 0;
        }

        if (
            this.session.currentBalance >
            this.session.peakBalance
        ) {
            this.session.peakBalance =
                this.session.currentBalance;
        }

        this.session.drawdown =
            this.session.peakBalance -
            this.session.currentBalance;

        return {
            success: true,
            sessionProfit:
                Number(
                    this.session.sessionProfit.toFixed(8)
                ),
            balance:
                Number(
                    this.session.currentBalance.toFixed(8)
                ),
            consecutiveLosses:
                this.session.consecutiveLosses,
            drawdown:
                Number(
                    this.session.drawdown.toFixed(8)
                )
        };
    }

    setConfig(settings = {}) {
        for (const key of Object.keys(settings)) {
            if (
                Object.prototype.hasOwnProperty.call(
                    this.config,
                    key
                )
            ) {
                const value = Number(settings[key]);

                if (
                    Number.isFinite(value) &&
                    value >= 0
                ) {
                    this.config[key] = value;
                }
            }
        }

        return this.getStatus();
    }

    setStartingBalance(balance) {
        const value = Number(balance);

        if (
            !Number.isFinite(value) ||
            value <= 0
        ) {
            return {
                success: false,
                reason: "Invalid starting balance"
            };
        }

        this.session.startingBalance = value;
        this.session.currentBalance = value;
        this.session.peakBalance = value;
        this.session.sessionProfit = 0;
        this.session.consecutiveLosses = 0;
        this.session.drawdown = 0;

        return this.getStatus();
    }

    enable() {
        this.enabled = true;
        return this.getStatus();
    }

    disable
