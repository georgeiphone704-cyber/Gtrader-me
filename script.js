const status = document.getElementById("status");
const prediction = document.getElementById("prediction");

status.innerHTML = "Analyzing...";

setTimeout(() => {
    prediction.innerHTML = "Waiting for live market connection...";
}, 2000);
