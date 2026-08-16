/*
 * ============================================================
 * GTRADER-ME DERIV CONNECTION
 * ============================================================
 *
 * PURPOSE:
 * - Connect to Deriv through WebSocket
 * - Subscribe to live ticks
 * - Convert tick data into the format expected by engine.js
 * - Send every valid tick to AnalysisEngine
 *
 * IMPORTANT:
 * - This file does NOT place trades.
 * - It only receives market data.
 * ============================================================
 */

(function (global) {
    "use strict";

    class DerivConnection {

        constructor(options = {}) {

            this.appId =
                options.appId ||
                "";

            this.token =
                options.token ||
                "";

            this.engine =
                options.engine ||
                global.engine ||
                null;

            this.markets =
                options.markets ||
                (
                    global.GTraderMarkets &&
                    typeof global.GTraderMarkets.getSymbols ===
                    "function"
                )
                    ? global.GTraderMarkets.getSymbols()
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

            this.ws = null;

            this.connected = false;

            this.authorized = false;

            this.subscriptions = {};

            this.reconnectTimer = null;

            this.reconnectAttempts = 0;

            this.maxReconnectAttempts =
                Number(
                    options.maxReconnectAttempts
                ) || 10;

            this.reconnectDelay =
                Number(
                    options.reconnectDelay
                ) || 3000;

            this.listeners = [];

            this.lastTick = null;

            this.lastError = null;

            this.status =
                "Disconnected";
        }


        /*
         * ======================================================
         * CONNECT
         * ======================================================
         */

        connect() {

            if (this.connected) {
                return;
            }

            if (!this.appId) {

                this.setStatus(
                    "Missing App ID"
                );

                console.warn(
                    "DerivConnection: appId is required."
                );

                return;
            }

            const url =
                `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(
                    this.appId
                )}`;

            try {

                this.setStatus(
                    "Connecting"
                );

                this.ws =
                    new WebSocket(url);

                this.ws.onopen =
                    () => this.handleOpen();

                this.ws.onmessage =
                    event =>
                        this.handleMessage(
                            event
                        );

                this.ws.onerror =
                    error =>
                        this.handleError(
                            error
                        );

                this.ws.onclose =
                    event =>
                        this.handleClose(
                            event
                        );

            } catch (error) {

                this.lastError =
                    error.message;

                this.setStatus(
                    "Connection error"
                );

                this.scheduleReconnect();
            }
        }


        /*
         * ======================================================
         * OPEN
         * ======================================================
         */

        handleOpen() {

            this.connected = true;

            this.reconnectAttempts = 0;

            this.setStatus(
                "Connected"
            );

            this.emit({
                type: "connected"
            });

            /*
             * Authorization is optional for receiving
             * public tick data.
             *
             * If a token was supplied, authorize first.
             */

            if (this.token) {

                this.send({
                    authorize:
                        this.token
                });

            } else {

                this.subscribeAllMarkets();
            }
        }


        /*
         * ======================================================
         * MESSAGE
         * ======================================================
         */

        handleMessage(event) {

            let data;

            try {

                data =
                    JSON.parse(
                        event.data
                    );

            } catch (error) {

                console.warn(
                    "Invalid Deriv message:",
                    event.data
                );

                return;
            }

            if (data.error) {

                this.lastError =
                    data.error.message ||
                    "Deriv API error";

                console.warn(
                    "Deriv API error:",
                    data.error
                );

                this.emit({
                    type: "error",
                    error: data.error
                });

                return;
            }


            /*
             * Authorization response
             */

            if (
                data.msg_type ===
                "authorize"
            ) {

                this.authorized = true;

                this.setStatus(
                    "Authorized"
                );

                this.emit({
                    type: "authorized",
                    data
                });

                this.subscribeAllMarkets();

                return;
            }


            /*
             * Tick response
             */

            if (
                data.msg_type ===
                "tick"
            ) {

                this.handleTick(
                    data
                );

                return;
            }


            /*
             * Subscription response
             */

            if (
                data.msg_type ===
                "tick" &&
                data.subscription
            ) {

                return;
            }

            this.emit({
                type: "message",
                data
            });
        }


        /*
         * ======================================================
         * TICK
         * ======================================================
         */

        handleTick(data) {

            if (
                !data ||
                !data.tick
            ) {
                return;
            }

            const tick =
                data.tick;

            const symbol =
                tick.symbol;

            const quote =
                Number(
                    tick.quote
                );

            if (
                !symbol ||
                !Number.isFinite(
                    quote
                )
            ) {
                return;
            }

            const digit =
                this.extractDigit(
                    quote,
                    tick
                );

            const normalized = {

                symbol,

                market:
                    symbol,

                quote,

                digit,

                epoch:
                    Number(
                        tick.epoch || 0
                    ),

                pip_size:
                    tick.pip_size ??
                    null,

                receivedAt:
                    Date.now(),

                raw:
                    data
            };

            this.lastTick =
                normalized;


            /*
             * Send the tick to the
             * master analysis engine.
             */

            if (
                this.engine &&
                typeof this.engine.receiveTick ===
                "function"
            ) {

                try {

                    this.engine.receiveTick(
                        normalized
                    );

                } catch (error) {

                    console.warn(
                        "Analysis engine tick error:",
                        error
                    );

                    this.lastError =
                        error.message;
                }
            }


            /*
             * Notify dashboard/listeners.
             */

            this.emit({
                type: "tick",
                tick: normalized
            });
        }


        /*
         * ======================================================
         * EXTRACT LAST DIGIT
         * ======================================================
         */

        extractDigit(
            quote,
            tick = {}
        ) {

            const pipSize =
                Number(
                    tick.pip_size
                );

            if (
                Number.isFinite(
                    pipSize
                ) &&
                pipSize > 0 &&
                pipSize < 1
            ) {

                const decimals =
                    Math.max(
                        0,
                        Math.round(
                            -Math.log10(
                                pipSize
                            )
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
                        digits.length
                    ) {

                        return Number(
                            digits[
                                digits.length - 1
                            ]
                        );
                    }
                }
            }

            const text =
                String(quote);

            const digits =
                text.replace(
                    /\D/g,
                    ""
                );

            if (
                !digits.length
            ) {
                return null;
            }

            return Number(
                digits[
                    digits.length - 1
                ]
            );
        }


        /*
         * ======================================================
         * SUBSCRIBE TO ALL MARKETS
         * ======================================================
         */

        subscribeAllMarkets() {

            if (
                !this.connected
            ) {
                return;
            }

            for (
                const symbol of
                this.markets
            ) {

                this.subscribe(
                    symbol
                );
            }
        }


        /*
         * ======================================================
         * SUBSCRIBE ONE MARKET
         * ======================================================
         */

        subscribe(symbol) {

            if (
                !this.connected ||
                !symbol
            ) {
                return false;
            }

            this.send({

                ticks:
                    symbol,

                subscribe:
                    1

            });

            this.subscriptions[
                symbol
            ] = true;

            return true;
        }


        /*
         * ======================================================
         * UNSUBSCRIBE
         * ======================================================
         */

        unsubscribe(
            symbol
        ) {

            if (
                !this.connected ||
                !symbol
            ) {
                return false;
            }

            /*
             * Deriv subscriptions can be
             * removed using forget_all.
             *
             * We use forget_all here to keep
             * this connection simple and safe.
             */

            this.send({
                forget_all:
                    "ticks"
            });

            this.subscriptions = {};

            return true;
        }


        /*
         * ======================================================
         * SEND
         * ======================================================
         */

        send(data) {

            if (
                !this.ws ||
                this.ws.readyState !==
                WebSocket.OPEN
            ) {

                return false;
            }

            try {

                this.ws.send(
                    JSON.stringify(
                        data
                    )
                );

                return true;

            } catch (error) {

                this.lastError =
                    error.message;

                console.warn(
                    "Deriv send error:",
                    error
                );

                return false;
            }
        }


        /*
         * ======================================================
         * ERROR
         * ======================================================
         */

        handleError(error) {

            this.lastError =
                "WebSocket connection error";

            this.setStatus(
                "Connection error"
            );

            this.emit({
                type: "error",
                error
            });
        }


        /*
         * ======================================================
         * CLOSE
         * ======================================================
         */

        handleClose(event) {

            this.connected = false;

            this.authorized = false;

            this.setStatus(
                "Disconnected"
            );

            this.emit({
                type: "disconnected",
                event
            });

            this.scheduleReconnect();
        }


        /*
         * ======================================================
         * RECONNECT
         * ======================================================
         */

        scheduleReconnect() {

            if (
                this.reconnectTimer
            ) {
                return;
            }

            if (
                this.reconnectAttempts >=
                this.maxReconnectAttempts
            ) {

                this.setStatus(
                    "Reconnect limit reached"
                );

                return;
            }

            this.reconnectAttempts++;

            const delay =
                this.reconnectDelay *
                this.reconnectAttempts;

            this.reconnectTimer =
                setTimeout(
                    () => {

                        this.reconnectTimer =
                            null;

                        this.connect();

                    },
                    delay
                );
        }


        /*
         * ======================================================
         * STATUS
         * ======================================================
         */

        setStatus(
            status
        ) {

            this.status =
                status;

            this.emit({
                type: "status",
                status
            });
        }


        /*
         * ======================================================
         * LISTENERS
         * ======================================================
         */

        onUpdate(
            callback
        ) {

            if (
                typeof callback !==
                "function"
            ) {
                return () => {};
            }

            this.listeners.push(
                callback
            );

            return () => {

                this.listeners =
                    this.listeners.filter(
                        listener =>
                            listener !==
                            callback
                    );
            };
        }


        /*
         * ======================================================
         * EMIT
         * ======================================================
         */

        emit(data) {

            for (
                const listener of
                this.listeners
            ) {

                try {

                    listener(
                        data
                    );

                } catch (error) {

                    console.warn(
                        "Deriv listener error:",
                        error
                    );
                }
            }
        }


        /*
         * ======================================================
         * GET STATE
         * ======================================================
         */

        getState() {

            return {

                connected:
                    this.connected,

                authorized:
                    this.authorized,

                status:
                    this.status,

                markets:
                    [
                        ...this.markets
                    ],

                subscriptions:
                    {
                        ...this.subscriptions
                    },

                lastTick:
                    this.lastTick,

                lastError:
                    this.lastError,

                reconnectAttempts:
                    this.reconnectAttempts
            };
        }


        /*
         * ======================================================
         * DISCONNECT
         * ======================================================
         */

        disconnect() {

            if (
                this.reconnectTimer
            ) {

                clearTimeout(
                    this.reconnectTimer
                );

                this.reconnectTimer =
                    null;
            }

            this.reconnectAttempts = 0;

            if (this.ws) {

                try {

                    this.ws.close();

                } catch (error) {

                    console.warn(
                        "Deriv close error:",
                        error
                    );
                }
            }

            this.ws = null;

            this.connected = false;

            this.authorized = false;

            this.subscriptions = {};

            this.setStatus(
                "Disconnected"
            );
        }
    }


    /*
     * ============================================================
     * GLOBAL EXPORT
     * ============================================================
     */

    global.DerivConnection =
        DerivConnection;

    global.derivConnection =
        new DerivConnection({

            engine:
                global.engine || null,

            markets:
                global.GTraderMarkets &&
                typeof global.GTraderMarkets.getSymbols ===
                "function"
                    ? global.GTraderMarkets.getSymbols()
                    : undefined
        })
    

    /*
     * COMMONJS SUPPORT
     */

    if (
        typeof module !== "undefined" &&
        module.exports
    ) {

        module.exports =
            DerivConnection;
    }

})(typeof window !== "undefined"
    ? window
    : globalThis);
