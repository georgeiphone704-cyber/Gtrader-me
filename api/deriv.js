/*
 * ============================================================
 * GTRADER-ME DERIV MARKET DATA FEED
 * ============================================================
 *
 * Connects to Deriv's public market-data WebSocket.
 *
 * Supported volatility markets:
 *
 * R_10
 * R_25
 * R_50
 * R_75
 * R_100
 *
 * 1HZ10V
 * 1HZ25V
 * 1HZ50V
 * 1HZ75V
 * 1HZ100V
 *
 * Responsibilities:
 * - connect to Deriv public market data
 * - subscribe to configured volatility markets
 * - receive live ticks
 * - maintain per-market feed state
 * - forward ticks to market.js
 * - forward ticks to engine.js
 * - reconnect after connection loss
 *
 * This file DOES NOT place trades.
 * ============================================================
 */

class DerivFeed {

    constructor(options = {}) {

        /* =====================================================
         * CONFIGURATION
         * ===================================================== */

        this.appId =
            options.appId || "";

        /*
         * All requested volatility markets.
         */
        this.markets =
            Array.isArray(options.markets) &&
            options.markets.length
                ? [...options.markets]
                : [
                    "R_10",
                    "R_25",
                    "R_50",
                    "R_75",
                    "R_100",
                    "1HZ10V",
                    "1HZ25V",
                    "1HZ50V",
                    "1HZ75V",
                    "1HZ100V"
                ];


        /* =====================================================
         * CONNECTION
         * ===================================================== */

        this.ws = null;

        this.connected = false;

        this.connecting = false;

        this.shouldReconnect = true;

        this.reconnectTimer = null;

        this.reconnectDelay = 2000;

        this.maxReconnectDelay = 30000;


        /* =====================================================
         * REQUESTS / SUBSCRIPTIONS
         * ===================================================== */

        this.requestId = 0;

        this.subscriptions = {};

        this.subscriptionIds = {};


        /* =====================================================
         * PER-MARKET FEED STATE
         * ===================================================== */

        this.marketState = {};

        for (
            const market of this.markets
        ) {
            this.marketState[market] =
                this.createMarketState(market);
        }


        /* =====================================================
         * LISTENERS
         * ===================================================== */

        this.tickListeners = [];

        this.statusListeners = [];

        this.errorListeners = [];

    }


    /* ==========================================================
     * CREATE MARKET STATE
     * ========================================================== */

    createMarketState(symbol) {

        return {

            symbol,

            connected: false,

            subscribed: false,

            tickCount: 0,

            lastQuote: null,

            lastDigit: null,

            lastEpoch: null,

            pipSize: null,

            lastUpdate: null

        };

    }


    /* ==========================================================
     * CONNECT
     * ========================================================== */

    connect() {

        if (
            this.connected ||
            this.connecting
        ) {
            return {
                success: true,
                status: "ALREADY_CONNECTED"
            };
        }


        this.connecting = true;

        this.emitStatus(
            "CONNECTING"
        );


        /*
         * Current Deriv public market-data endpoint.
         */
        const url =
            "wss://api.derivws.com/trading/v1/options/ws/public";


        try {

            this.ws =
                new WebSocket(url);

        } catch (error) {

            this.connecting = false;

            this.emitError(error);

            this.scheduleReconnect();

            return {
                success: false,
                reason: error.message
            };
        }


        /* ======================================================
         * OPEN
         * ====================================================== */

        this.ws.onopen = () => {

            this.connected = true;

            this.connecting = false;

            this.reconnectDelay = 2000;

            this.emitStatus(
                "CONNECTED"
            );


            this.subscribeAllMarkets();

        };


        /* ======================================================
         * MESSAGE
         * ====================================================== */

        this.ws.onmessage =
            event => {

                this.handleMessage(
                    event.data
                );

            };


        /* ======================================================
         * ERROR
         * ====================================================== */

        this.ws.onerror =
            error => {

                this.emitError(
                    error
                );

            };


        /* ======================================================
         * CLOSE
         * ====================================================== */

        this.ws.onclose =
            () => {

                this.connected = false;

                this.connecting = false;

                this.markDisconnected();

                this.emitStatus(
                    "DISCONNECTED"
                );


                if (
                    this.shouldReconnect
                ) {
                    this.scheduleReconnect();
                }

            };


        return {
            success: true,
            status: "CONNECTING"
        };

    }


    /* ==========================================================
     * SUBSCRIBE ALL MARKETS
     * ========================================================== */

    subscribeAllMarkets() {

        if (
            !this.connected ||
            !this.ws
        ) {
            return;
        }


        /*
         * Deriv supports subscribing to multiple symbols
         * through the ticks request.
         */
        this.send({
            ticks: this.markets,
            subscribe: 1
        });

    }


    /* ==========================================================
     * SUBSCRIBE ONE MARKET
     * ========================================================== */

    subscribeMarket(symbol) {

        if (
            !symbol ||
            !this.connected ||
            !this.ws
        ) {
            return false;
        }


        if (
            !this.markets.includes(symbol)
        ) {

            this.markets.push(symbol);

        }


        if (
            !this.marketState[symbol]
        ) {

            this.marketState[symbol] =
                this.createMarketState(symbol);

        }


        /*
         * Avoid duplicate subscriptions.
         */
        if (
            this.subscriptions[symbol]
        ) {
            return true;
        }


        return this.send({
            ticks: symbol,
            subscribe: 1
        });

    }


    /* ==========================================================
     * SEND REQUEST
     * ========================================================== */

    send(request) {

        if (
            !this.ws ||
            !this.connected
        ) {

            return {
                success: false,
                reason: "Deriv WebSocket is not connected"
            };

        }


        const reqId =
            ++this.requestId;


        const payload = {
            ...request,
            req_id: reqId
        };


        try {

            this.ws.send(
                JSON.stringify(payload)
            );


            return {
                success: true,
                reqId
            };

        } catch (error) {

            this.emitError(error);

            return {
                success: false,
                reason: error.message
            };

        }

    }


    /* ==========================================================
     * HANDLE MESSAGE
     * ========================================================== */

    handleMessage(rawMessage) {

        let data;

        try {

            data =
                typeof rawMessage === "string"
                    ? JSON.parse(rawMessage)
                    : rawMessage;

        } catch (error) {

            this.emitError({
                message:
                    "Invalid JSON from Deriv"
            });

            return;

        }


        /*
         * API error
         */
        if (
            data.error
        ) {

            this.emitError(
                data.error
            );

            return;

        }


        /*
         * Tick subscription confirmation.
         *
         * Some streaming responses include subscription.id.
         */
        if (
            data.subscription &&
            data.subscription.id
        ) {

            const subscriptionId =
                data.subscription.id;


            this.subscriptionIds[
                subscriptionId
            ] =
                data.echo_req?.ticks ||
                data.tick?.symbol ||
                null;


            /*
             * When a single symbol is returned,
             * store it directly.
             */
            const symbol =
                data.tick?.symbol ||
                (
                    typeof data.echo_req?.ticks === "string"
                        ? data.echo_req.ticks
                        : null
                );


            if (
                symbol
            ) {

                this.subscriptions[
                    symbol
                ] =
                    subscriptionId;


                this.ensureMarket(symbol);

                this.marketState[
                    symbol
                ].subscribed = true;

            }

        }


        /*
         * Live tick.
         */
        if (
            data.msg_type === "tick" &&
            data.tick
        ) {

            this.handleTick(
                data.tick,
                data
            );

        }

    }


    /* ==========================================================
     * HANDLE TICK
     * ========================================================== */

    handleTick(
        tick,
        rawResponse = {}
    ) {

        const symbol =
            tick.symbol;


        if (
            !symbol
        ) {
            return;
        }


        const quote =
            Number(
                tick.quote
            );


        if (
            !Number.isFinite(quote)
        ) {
            return;
        }


        this.ensureMarket(symbol);


        const pipSize =
            tick.pip_size ??
            null;


        const digit =
            this.extractLastDigit(
                quote,
                pipSize
            );


        const state =
            this.marketState[symbol];


        state.connected = true;

        state.subscribed = true;

        state.tickCount++;

        state.lastQuote = quote;

        state.lastDigit = digit;

        state.lastEpoch =
            Number(
                tick.epoch || 0
            );

        state.pipSize =
            pipSize;

        state.lastUpdate =
            Date.now();


        /*
         * Normalized tick object.
         */
        const normalizedTick = {

            symbol,

            market: symbol,

            quote,

            epoch:
                Number(
                    tick.epoch || 0
                ),

            pip_size:
                pipSize,

            digit,

            id:
                tick.id ||
                null,

            source:
                "deriv",

            receivedAt:
                Date.now(),

            requestId:
                rawResponse.req_id ||
                null

        };


        /*
         * Send the tick to market.js.
         */
        if (
            window.marketManager &&
            typeof
            window.marketManager.receiveTick ===
            "function"
        ) {

            try {

                window.marketManager.receiveTick(
                    normalizedTick
                );

            } catch (error) {

                console.warn(
                    "MarketManager tick error:",
                    error
                );

            }

        }


        /*
         * Send the same tick to engine.js.
         */
        if (
            window.engine &&
            typeof
            window.engine.receiveTick ===
            "function"
        ) {

            try {

                window.engine.receiveTick(
                    normalizedTick
                );

            } catch (error) {

                console.error(
                    "AnalysisEngine tick error:",
                    error
                );

                this.emitError(error);

            }

        }


        /*
         * Notify dashboard/other listeners.
         */
        for (
            const listener of
            this.tickListeners
        ) {

            try {

                listener(
                    normalizedTick
                );

            } catch (error) {

                console.warn(
                    "Tick listener error:",
                    error
                );

            }

        }

    }


    /* ==========================================================
     * EXTRACT LAST DIGIT
     * ========================================================== */

    extractLastDigit(
        quote,
        pipSize = null
    ) {

        const size =
            Number(
                pipSize
            );


        /*
         * Use pip_size when supplied.
         */
        if (
            Number.isFinite(size) &&
            size > 0 &&
            size < 1
        ) {

            const decimals =
                Math.max(
                    0,
                    Math.round(
                        -Math.log10(size)
                    )
                );


            if (
                decimals > 0
            ) {

                const formatted =
                    quote.toFixed(
                        decimals
                    );


                const digits =
                    formatted.replace(
                        /\D/g,
                        ""
                    );


                if (
                    digits.length > 0
                ) {

                    return Number(
                        digits[
                            digits.length - 1
                        ]
                    );

                }

            }

        }


        /*
         * Fallback when pip_size is unavailable.
         */
        const text =
            String(quote);


        const digits =
            text.replace(
                /\D/g,
                ""
            );


        if (
            digits.length === 0
        ) {

            return null;

        }


        return Number(
            digits[
                digits.length - 1
            ]
        );

    }


    /* ==========================================================
     * ENSURE MARKET EXISTS
     * ========================================================== */

    ensureMarket(symbol) {

        if (
            !this.markets.includes(symbol)
        ) {

            this.markets.push(symbol);

        }


        if (
            !this.marketState[symbol]
        ) {

            this.marketState[symbol] =
                this.createMarketState(symbol);

        }

    }


    /* ==========================================================
     * ADD MARKET
     * ========================================================== */

    addMarket(symbol) {

        if (
            typeof symbol !== "string"
        ) {

            return false;

        }


        symbol =
            symbol.trim();


        if (
            !symbol
        ) {

            return false;

        }


        if (
            this.markets.includes(symbol)
        ) {

            return false;

        }


        this.markets.push(symbol);

        this.marketState[symbol] =
            this.createMarketState(symbol);


        if (
            this.connected
        ) {

            this.subscribeMarket(
                symbol
            );

        }


        return true;

    }


    /* ==========================================================
     * REMOVE MARKET
     * ========================================================== */

    removeMarket(symbol) {

        const index =
            this.markets.indexOf(symbol);


        if (
            index === -1
        ) {

            return false;

        }


        const subscriptionId =
            this.subscriptions[symbol];


        if (
            subscriptionId &&
            this.ws &&
            this.connected
        ) {

            try {

                this.ws.send(
                    JSON.stringify({
                        forget:
                            subscriptionId
                    })
                );

            } catch (error) {

                console.warn(
                    "Deriv unsubscribe error:",
                    error
                );

            }

        }


        this.markets.splice(
            index,
            1
        );


        delete this.subscriptions[
            symbol
        ];


        delete this.marketState[
            symbol
        ];


        return true;

    }


    /* ==========================================================
     * GET MARKETS
     * ========================================================== */

    getMarkets() {

        return [
            ...this.markets
        ];

    }


    /* ==========================================================
     * GET MARKET STATE
     * ========================================================== */

    getMarketState(symbol) {

        return this.marketState[symbol]
            ? {
                ...this.marketState[symbol]
            }
            : null;

    }


    /* ==========================================================
     * GET ALL MARKET STATES
     * ========================================================== */

    getAllMarketStates() {

        return JSON.parse(
            JSON.stringify(
                this.marketState
            )
        );

    }


    /* ==========================================================
     * TICK LISTENER
     * ========================================================== */

    onTick(callback) {

        if (
            typeof callback !== "function"
        ) {

            return () => {};

        }


        this.tickListeners.push(
            callback
        );


        return () => {

            this.tickListeners =
                this.tickListeners.filter(
                    listener =>
                        listener !== callback
                );

        };

    }


    /* ==========================================================
     * STATUS LISTENER
     * ========================================================== */

    onStatus(callback) {

        if (
            typeof callback !== "function"
        ) {

            return () => {};

        }


        this.statusListeners.push(
            callback
        );


        return () => {

            this.statusListeners =
                this.statusListeners.filter(
                    listener =>
                        listener !== callback
     
