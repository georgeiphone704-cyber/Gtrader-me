const status = document.getElementById("status");
const market = document.getElementById("market");
const confidence = document.getElementById("confidence");
const prediction = document.getElementById("prediction");
const time = document.getElementById("time");

function updateDashboard() {
    status.textContent = "Analyzing...";
    market.textContent = "Digits";
    confidence.textContent = Math.floor(Math.random() * 21 + 80) + "%";
    prediction.textContent = "Scanning market...";
    time.textContent = new Date().toLocaleTimeString();
}

updateDashboard();
setInterval(updateDashboard, 3000);
