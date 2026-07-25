const APP_ID = 1089;
const SYMBOL = "R_100";

let socket = null;

function connectDeriv() {

    socket = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`);

    socket.onopen = () => {

        console.log("Connected to Deriv");

        socket.send(JSON.stringify({
            ticks: SYMBOL
        }));

    };

    socket.onmessage = (event) => {

        const data = JSON.parse(event.data);

        if (data.tick) {

            const tick = {
                quote: data.tick.quote,
                epoch: data.tick.epoch,
                digit: Number(String(data.tick.quote).slice(-1))
            };

            console.log(tick);

            if (window.engine) {
                window.engine.addTick(tick);
            }

        }

    };

    socket.onclose = () => {

        console.log("Disconnected... reconnecting");

        setTimeout(connectDeriv, 3000);

    };

    socket.onerror = (error) => {

        console.log(error);

    };

}

connectDeriv();
