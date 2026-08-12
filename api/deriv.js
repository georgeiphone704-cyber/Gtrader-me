/*
 * ============================================================
 * DERIV MULTI-MARKET TICK FEED
 * ============================================================
 *
 * Markets included:
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
 * This module:
 * - connects to Deriv public WebSocket
 * - subscribes to all configured volatility markets
 * - receives live ticks
 * - extracts the last digit
 * - maintains separate market state
 * - forwards each tick to AnalysisEngine
 *
 * This file DOES NOT place trades.
 * ============================================================
 */

class DerivFeed {

    constructor(options = {}) {

        /*
         * ========================================================
         * CONFIGURATION
         * ========================================================
         */

        this.appId =
            options.appId || "";


        /*
         * All requested volatility markets.
         */
        this.markets =
            options.markets || [

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


        /*
         * ========================================================
         * CONNECTION STATE
         * ========================================================
         */

        this.ws = null;

        this.connected = false;

        this.connecting = false;

        this.shouldReconnect = true;

        this.reconnectDelay = 2000;

        this.maxReconnectDelay = 30000;

        this.reconnectTimer = null;


        /*
         * ========================================================
         * SUBSCRIPTIONS
         * ========================================================
         */

        this.subscriptions = {};

        this.subscriptionIds = {};


        /*
         * ========================================================
         * MARKET STATE
         * ========================================================
         *
         * Each volatility has its own state.
         * This prevents ticks from different markets
         * being mixed together at the feed level.
         */

        this.marketState = {};

        for (
            const market of this.markets
        ) {

            this.marketState[market] =
                this.createMarketState(
                    market
                );

        }


        /*
         * ========================================================
         * LISTENERS
         * ========================================================
         */

        this.tickListeners = [];

        this.statusListeners = [];

        this.errorListeners = [];

    }


    /*
     * ============================================================
     * CREATE MARKET STATE
     * ============================================================
     */

    createMarketState(symbol) {

        return {

            symbol,

            connected: false,

            tickCount: 0,

            lastQuote: null,

            lastDigit: null,

            lastEpoch: null,

            lastUpdate: null

        };

    }


    /*
     * ============================================================
     * CONNECT
     * ============================================================
     */

    connect() {

        if (
            this.connected ||
            this.connecting
        ) {

            return;

        }


        this.connecting = true;


        this.emitStatus(
            "CONNECTING"
        );


        const url =
            this.appId

                ? `wss://ws.derivws.com/websockets/v3?app_id=${this.appId}`

                : "wss://ws.derivws.com/websockets/v3";


        try {

            this.ws =
                new WebSocket(url);

        } catch (error) {

            this.connecting = false;

            this.emitError(error);

            this.scheduleReconnect();

            return;

        }


        /*
         * --------------------------------------------------------
         * OPEN
         * --------------------------------------------------------
         */

        this.ws.onopen = () => {

            this.connected = true;

            this.connecting = false;

            this.reconnectDelay = 2000;


            this.emitStatus(
                "CONNECTED"
            );


            this.subscribeAllMarkets();

        };


        /*
         * --------------------------------------------------------
         * MESSAGE
         * --------------------------------------------------------
         */

        this.ws.onmessage =
            event => {

                this.handleMessage(
                    event.data
                );

            };


        /*
         * --------------------------------------------------------
         * ERROR
         * --------------------------------------------------------
         */

        this.ws.onerror =
            error => {

                this.emitError(
                    error
                );

            };


        /*
         * --------------------------------------------------------
         * CLOSE
         * --------------------------------------------------------
         */

        this.ws.onclose =
            () => {

                this.connected = false;

                this.connecting = false;

                this.markMarketsDisconnected();

                this.emitStatus(
                    "DISCONNECTED"
                );


                if (
                    this.shouldReconnect
                ) {

                    this.scheduleReconnect();

                }

            };

    }


    /*
     * ============================================================
     * SUBSCRIBE TO ALL MARKETS
     * ============================================================
     */

    subscribeAllMarkets() {

        if (
            !this.connected ||
            !this.ws
        ) {

            return;

        }


        for (
            const market of this.markets
        ) {

            this.subscribeMarket(
                market
            );

        }

    }


    /*
     * ============================================================
     * SUBSCRIBE TO ONE MARKET
     * ============================================================
     */

    subscribeMarket(symbol) {

        if (
            !symbol ||
            !this.connected ||
            !this.ws
        ) {

            return;

        }


        /*
         * Avoid duplicate subscriptions.
         */

        if (
            this.subscriptions[symbol]
        ) {

            return;

        }


        const request = {

            ticks: symbol,

            subscribe: 1

        };


        try {

            this.ws.send(
                JSON.stringify(
                    request
                )
            );

        } catch (error) {

            this.emitError(
                error
            );

        }

    }


    /*
     * ============================================================
     * HANDLE DERIV MESSAGE
     * ============================================================
     */

    handleMessage(rawMessage) {

        let data;


        try {

            data =
                typeof rawMessage === "string"

                    ? JSON.parse(
                        rawMessage
                    )

                    : rawMessage;

        } catch (error) {

            this.emitError({
                message:
                    "Invalid Deriv message"
            });

            return;

        }


        /*
         * API ERROR
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
         * SUBSCRIPTION CONFIRMATION
         */

        if (
            data.subscription
        ) {

            const symbol =
                data.echo_req?.ticks ||
                data.tick?.symbol;


            if (
                symbol
            ) {

                const subscriptionId =
                    data.subscription.id;


                this.subscriptions[
                    symbol
                ] =
                    subscriptionId;


                this.subscriptionIds[
                    subscriptionId
                ] =
                    symbol;


                if (
                    !this.marketState[
                        symbol
                    ]
                ) {

                    this.marketState[
                        symbol
                    ] =
                        this.createMarketState(
                            symbol
                        );

                }

            }

        }


        /*
         * TICK
         */

        if (
            data.tick
        ) {

            this.handleTick(
                data.tick
            );

        }

    }


    /*
     * ============================================================
     * HANDLE TICK
     * ============================================================
     */

    handleTick(tick) {

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
            !Number.isFinite(
                quote
            )
        ) {

            return;

        }


        /*
         * Deriv's pip size is used when available
         * to extract the final displayed digit correctly.
         */

        const lastDigit =
            this.extractLastDigit(
                quote,
                tick.pip_size
            );


        /*
         * Create missing market state if needed.
         */

        if (
            !this.marketState[
                symbol
            ]
        ) {

            this.marketState[
                symbol
