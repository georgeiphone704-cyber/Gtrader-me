class LiveTradingEngine {
    constructor() {
        this.mode = "DEMO";
        this.enabled = false;

        this.ws = null;
        this.connected = false;
        this.authorized = false;

        this.requestId = 0;
        this.pendingRequests = new Map();

        this.activeContract = null;
        this.lastResult = null;

        this.config = {
            appId: null,
            accountId: null,
            otpUrl: null,

            maxStake: 1.00,
            allowLive: false,
            reconnect: true,
            reconnectDelay: 3000
        };
    }

    configure(settings = {}) {
        if (settings.appId !== undefined) {
            this.config.appId = settings.appId;
        }

        if (settings.accountId !== undefined) {
            this.config.accountId = settings.accountId;
        }

        if (settings.otpUrl !== undefined) {
            this.config.otpUrl = settings.otpUrl;
        }

        if (settings.maxStake !== undefined) {
            const stake = Number(settings.maxStake);

            if (
                Number.isFinite(stake) &&
                stake > 0
            ) {
                this.config.maxStake = stake;
            }
        }

        return this.getStatus();
    }

    setMode(mode) {
        const selected =
            String(mode).toUpperCase();

        if (
            selected !== "DEMO" &&
            selected !== "LIVE"
        ) {
            return {
                success: false,
                reason: "Mode must be DEMO or LIVE"
            };
        }

        if (
            selected === "LIVE" &&
            this.config.allowLive !== true
        ) {
            return {
                success: false,
                reason: "Live trading is locked"
            };
        }

        this.mode = selected;

        return {
            success: true,
            mode: this.mode
        };
    }

    enable() {
        if (this.mode === "LIVE") {
            if (this.config.allowLive !== true) {
                return {
                    success: false,
                    reason: "Live trading is locked"
                };
            }
        }

        this.enabled = true;

        return this.getStatus();
    }

    disable(reason = "Trading disabled") {
        this.enabled = false;

        this.lastResult = {
            action: "TRADING_DISABLED",
            success: true,
            reason
        };

        return this.lastResult;
    }

    async connect(otpUrl = null) {
        if (typeof WebSocket === "undefined") {
            return {
                success: false,
                reason: "WebSocket is not available in this environment"
            };
        }

        const url =
            otpUrl ||
            this.config.otpUrl;

        if (!url) {
            return {
                success: false,
                reason:
                    "No authenticated Deriv WebSocket URL supplied"
            };
        }

        if (this.ws) {
            this.disconnect();
        }

        return new Promise((resolve) => {

            let settled = false;

            try {
                this.ws = new WebSocket(url);

                this.ws.onopen = () => {
                    this.connected = true;

                    this.lastResult = {
                        action: "CONNECTED",
                        success: true,
                        mode: this.mode
                    };

                    if (!settled) {
                        settled = true;

                        resolve({
                            success: true,
                            connected: true,
                            mode: this.mode
                        });
                    }
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                this.ws.onerror = () => {
                    this.connected = false;

                    const result = {
                        success: false,
                        reason:
                            "Deriv WebSocket connection error"
                    };

                    this.lastResult = result;

                    if (!settled) {
                        settled = true;
                        resolve(result);
                    }
                };

                this.ws.onclose = () => {
                    this.connected = false;
                    this.authorized = false;

                    this.lastResult = {
                        action: "DISCONNECTED",
                        success: true
                    };
                };

            } catch (error) {
                settled = true;

                resolve({
                    success: false,
                    reason: error.message
                });
            }
        });
    }

    disconnect() {
        if (this.ws) {
            try {
                this.ws.close();
            } catch (error) {
                console.warn(
                    "WebSocket close error:",
                    error
                );
            }
        }

        this.ws = null;
        this.connected = false;
        this.authorized = false;

        this.pendingRequests.clear();

        this.lastResult = {
            action: "DISCONNECTED",
            success: true
        };

        return this.lastResult;
    }

    send(request) {
        if (!this.ws || !this.connected) {
            return {
                success: false,
                reason: "Not connected to Deriv"
            };
        }

        const reqId = ++this.requestId;

        const message = {
            ...request,
            req_id: reqId
        };

        try {
            this.ws.send(
                JSON.stringify(message)
            );

            return {
                success: true,
                reqId
            };

        } catch (error) {
            return {
                success: false,
                reason: error.message
            };
        }
    }

    handleMessage(rawMessage) {
        let message;

        try {
            message =
                typeof rawMessage === "string"
                    ? JSON.parse(rawMessage)
                    : rawMessage;
        } catch (error) {
            this.lastResult = {
                success: false,
                reason: "Invalid JSON from Deriv"
            };

            return;
        }

        if (message.error) {
            this.lastResult = {
                action: "API_ERROR",
                success: false,
                error: message.error
            };

            return;
        }

        if (
            message.msg_type ===
            "authorize"
        ) {
            this.authorized = true;

            this.lastResult = {
                action: "AUTHORIZED",
                success: true,
                authorize: message.authorize
            };

            return;
        }

        if (
            message.msg_type ===
            "proposal"
        ) {
            this.lastResult = {
                action: "PROPOSAL_RECEIVED",
                success: true,
                proposal: message.proposal
            };

            return;
        }

        if (
            message.msg_type ===
            "buy"
        ) {
            this.handleBuyResponse(
                message
            );

            return;
        }

        if (
            message.msg_type ===
            "proposal_open_contract"
        ) {
            this.handleContractUpdate(
                message
            );

            return;
        }

        this.lastResult = {
            action: message.msg_type ||
                "MESSAGE_RECEIVED",
            success: true,
            data: message
        };
    }

    requestProposal(parameters = {}) {
        if (!this.connected) {
            return {
                success: false,
                reason: "Not connected"
            };
        }

        const request = {
            proposal: 1,
            ...parameters
        };

        return this.send(request);
    }

    buy(proposalId, maxPrice) {
        if (!this.enabled) {
            return {
                success: false,
                reason: "Trading disabled"
            };
        }

        if (!this.connected) {
            return {
                success: false,
                reason: "Not connected"
            };
        }

        if (!this.authorized) {
            return {
                success: false,
                reason: "Account not authorized"
            };
        }

        if (this.activeContract) {
            return {
                success: false,
                reason: "A contract is already active"
            };
        }

        const price = Number(maxPrice);

        if (
            !Number.isFinite(price) ||
            price <= 0
        ) {
            return {
                success: false,
                reason: "Invalid purchase price"
            };
        }

        if (price > this.config.maxStake) {
            return {
                success: false,
                reason: "Price exceeds maximum stake"
            };
        }

        const result = this.send({
            buy: String(proposalId),
            price
        });

        return result;
    }

    handleBuyResponse(message) {
        const buy = message.buy;

        if (!buy) {
            this.lastResult = {
                success: false,
                reason: "Invalid buy response"
            };

            return;
        }

        this.activeContract = {
            contractId:
                buy.contract_id,

            transactionId:
                buy.transaction_id,

            buyPrice:
                Number(buy.buy_price) || 0,

            payout:
                Number(buy.payout) || 0,

            openedAt: Date.now()
        };

        this.lastResult = {
            action: "CONTRACT_PURCHASED",
            success: true,
            contract:
                this.activeContract
        };

        this.monitorContract(
            this.activeContract.contractId
        );
    }

    monitorContract(contractId) {
        if (!contractId) {
            return {
                success: false,
                reason: "Missing contract ID"
            };
        }

        return this.send({
            proposal_open_contract: 1,
            contract_id: Number(contractId),
            subscribe: 1
        });
    }

    handleContractUpdate(message) {
        const contract =
            message.proposal_open_contract;

        if (!contract) {
            return;
        }

        const isClosed =
            contract.is_sold === 1 ||
            contract.status === "sold" ||
            contract.status === "won" ||
            contract.status === "lost";

        if (!isClosed) {
            this.lastResult = {
                action: "CONTRACT_UPDATE",
                success: true,
                contract
            };

            return;
        }

        const profit =
            Number(contract.profit) || 0;

        const outcome =
            profit >= 0
                ? "WIN"
                : "LOSS";

        this.lastResult = {
            action: "CONTRACT_CLOSED",
            success: true,

            outcome,

            profit,

            contractId:
                contract.contract_id,

            exitSpot:
                contract.exit_spot,

            exitSpotTime:
                contract.exit_spot_time
        };

        this.activeContract = null;
    }

    emergencyStop() {
        this.enabled = false;

        this.lastResult = {
            action: "EMERGENCY_STOP",
            success: true
        };

        return this.lastResult;
    }

    getStatus() {
        return {
            enabled: this.enabled,
            mode: this.mode,
            connected: this.connected,
            authorized: this.authorized,
            activeContract:
                this.activeContract,
            maxStake:
                this.config.maxStake,
            liveAllowed:
                this.config.allowLive,
            lastResult:
                this.lastResult
        };
    }
}

window.LiveTradingEngine =
    LiveTradingEngine;

window.liveTrading =
    new LiveTradingEngine();
