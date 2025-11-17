import express from "express";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.static("public"));

// === CONFIG ===
const ADMIN_KEY = process.env.ADMIN_KEY || "geheim123"; // Passwort für Admin
const ASSIGN_PATH = path.join(".", "assignments.json");
const PARTICIPANTS_PATH = path.join(".", "data_participants.json");

// === Teilnehmer laden ===
let participants = [];
if (fs.existsSync(PARTICIPANTS_PATH)) {
  const raw = fs.readFileSync(PARTICIPANTS_PATH, "utf8").trim();
  if (raw) participants = JSON.parse(raw);
}

// === Derangement Algorithmus (Perfekt-Stabile Random Zuordnung) ===
function generateDerangement(arr) {
  let n = arr.length;
  let result = [...arr];

  for (let i = 0; i < n - 1; i++) {
    let j = Math.floor(Math.random() * (n - i - 1)) + i + 1;
    [result[i], result[j]] = [result[j], result[i]];
  }

  if (result[n - 1] === arr[n - 1]) {
    [result[n - 1], result[n - 2]] = [result[n - 2], result[n - 1]];
  }

  return result;
}

// === Automatische Auslosung (nur wenn KEIN assignments.json existiert) ===
let assignments = [];

function drawIfNeeded() {
  if (participants.length < 2) return;

  // Wenn es existiert → NICHT neu auslosen
  if (fs.existsSync(ASSIGN_PATH)) {
    const raw = fs.readFileSync(ASSIGN_PATH, "utf8").trim();
    if (raw) {
      assignments = JSON.parse(raw);
      return;
    }
  }

  // → Neues Draw erstellen
  const names = participants.map(p => p.name);
  const deranged = generateDerangement(names);

  assignments = participants.map((p, i) => ({
    name: p.name,
    pin: p.pin,
    target: deranged[i]
  }));

  fs.writeFileSync(ASSIGN_PATH, JSON.stringify(assignments, null, 2));
}

drawIfNeeded();

// === PIN Check ===
app.post("/check", (req, res) => {
  const pin = (req.body.pin || "").trim();
  if (!pin) return res.status(400).send("PIN fehlt.");

  const entry = assignments.find(e => e.pin === pin);

  if (!entry) return res.status(401).send("Falsche PIN.");

  res.json({
    ok: true,
    name: entry.name,
    target: entry.target
  });
});

// === Admin-Login & Übersicht ===
app.get("/admin/overview", (req, res) => {
  const key = req.query.key;
  if (key !== ADMIN_KEY) {
    return res.status(403).send("Zugriff verweigert. Falscher Admin-Key.");
  }

  let html = `
  <h1>Wichtel Übersicht</h1>
  <p>Admin eingeloggt.</p>
  <table border="1" cellspacing="0" cellpadding="6">
    <tr>
      <th>Name</th>
      <th>PIN</th>
      <th>Beschenkt</th>
    </tr>
  `;

  for (const e of assignments) {
    html += `
      <tr>
        <td>${e.name}</td>
        <td>${e.pin}</td>
        <td>${e.target}</td>
      </tr>
    `;
  }

  html += "</table>";
  res.send(html);
});

// === Admin Reset ===
app.get("/admin/reset", (req, res) => {
  const key = req.query.key;
  if (key !== ADMIN_KEY) {
    return res.status(403).send("Zugriff verweigert.");
  }

  if (fs.existsSync(ASSIGN_PATH)) fs.unlinkSync(ASSIGN_PATH);

  drawIfNeeded();

  res.send("Reset & neue Auslosung erstellt.");
});

// === Start ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server läuft auf Port", PORT));
