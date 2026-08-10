class TradeManager {

    constructor() {
        this.enabled = false;
        this.mode = "PAPER";

        this.activeTrade = null;
        this.tradeHistory = [];

        this.maxHistory = 1000;

        this.lastResult = {
            action: "WAIT",
            status: "IDLE",
            reason: "Trade manager initialized"
        };
    }

    enable() {
        this.enabled = true;

        return this.getStatus();
    }

    disable(reason = "Trade manager disabled") {
        this.enabled = false;

        this.lastResult = {
            action: "WAIT",
            status: "DISABLED",
            reason
        };

        return this.lastResult;
    }

    setMode(mode) {

        const validModes = [
            "PAPER",
            "LIVE"
        ];

        if (!validModes.includes(mode)) {
            return {
                success: false,
                reason: "Invalid trading mode"
            };
        }

        /*
         * LIVE execution remains disabled until
         * the live-trading module is integrated
         * and explicitly enabled.
         */
        if (mode === "LIVE") {
            return {
                success: false,
                reason: "Live trading is not enabled yet"
            };
        }

        this.mode = mode;

        return {
            success: true,
            mode: this.mode
        };
    }

    canEnter(signal) {

        if (!this.enabled) {
            return {
                allowed: false,
                reason: "Trade manager disabled"
            };
        }

        if (this.activeTrade) {
            return {
                allowed: false,
                reason: "A trade is already active"
            };
        }

        if (!signal) {
            return {
                allowed: false,
                reason: "No signal supplied"
            };
        }

        if (signal.action !== "ENTRY_READY") {
            return {
                allowed: false,
                reason: "Entry conditions not confirmed"
            };
        }

        if (
            signal.direction !== "BUY" &&
            signal.direction !== "SELL"
        ) {
            return {
                allowed: false,
                reason: "Invalid trade direction"
            };
        }

        return {
            allowed: true,
            reason: "Entry conditions confirmed"
        };
    }

    prepareTrade(signal, market = "UNKNOWN", stake = 0) {

        const check = this.canEnter(signal);

        if (!check.allowed) {

            this.lastResult = {
                action: "WAIT",
                status: "REJECTED",
                reason: check.reason
            };

            return this.lastResult;
        }

        const numericStake = Number(stake);

        if (
            !Number.isFinite(numericStake) ||
            numericStake <= 0
        ) {
            this.lastResult = {
                action: "WAIT",
                status: "REJECTED",
                reason: "Invalid stake"
            };

            return this.lastResult;
        }

        const trade = {
            id: this.createTradeId(),

            market,

            direction: signal.direction,

            stake: numericStake,

            confidence: Number(
                signal.confidence || 0
            ),

            agreement: Number(
                signal.agreement || 0
            ),

            mode: this.mode,

            status: "PENDING",

            createdAt: Date.now()
        };

        this.activeTrade = trade;

        this.lastResult = {
            action: "TRADE_PREPARED",
            status: "
