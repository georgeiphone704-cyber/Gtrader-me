const DERIV_WS = "wss://ws.derivws.com/websockets/v3?app_id=1089";

let ws = null;

function connectDeriv() {
    ws = new WebSocket(DERIV_WS);

    ws.onopen = () => {
        console.log("Connected to Deriv");
    };

    ws.onmessage = (event) => {
        console.log(event.data);
    };

    ws.onclose = () => {
        console.log("Disconnected");
    };

    ws.onerror = (error) => {
        console.log(error);
    };
}

connectDeriv();
