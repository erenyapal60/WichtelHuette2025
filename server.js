import express from "express";
import fs from "fs";

const app = express();

app.use(express.json());
app.use(express.static("public"));

// --- Teilnehmer laden ---

let participants = [];
if (fs.existsSync("data_participants.json")) {
  const raw = fs.readFileSync("data_participants.json", "utf8").trim();
  if (raw) participants = JSON.parse(raw);
}

// --- Automatischer Draw beim Serverstart ---

function autoDraw() {
  if (participants.length < 2) return [];

  const names = participants.map(p => p.name);

  let perm = [...names];
  let ok = false;

  // faire Permutation (niemand zieht sich selbst)
  while (!ok) {
    perm.sort(() => Math.random() - 0.5);
    ok = perm.every((v, i) => v !== names[i]);
  }

  const result = participants.map((p, i) => ({
    name: p.name,
    pin: p.pin,
    target: perm[i]
  }));

  fs.writeFileSync("assignments.json", JSON.stringify(result, null, 2));
  return result;
}

// Wenn schon vorhanden → nutzen, sonst → Draw
let assignments = [];
if (fs.existsSync("assignments.json")) {
  const raw = fs.readFileSync("assignments.json", "utf8").trim();
  if (raw) assignments = JSON.parse(raw);
}

if (assignments.length === 0) {
  assignments = autoDraw();
}


// --- PIN-Eingabe: Partner anzeigen ---

app.post("/check", (req, res) => {
  const pin = req.body.pin?.trim();
  if (!pin) return res.status(400).send("PIN fehlt.");

  const entry = assignments.find(e => e.pin === pin);

  if (!entry) return res.status(401).send("Falsche PIN!");

  res.json({
    ok: true,
    name: entry.name,
    target: entry.target
  });
});


// --- Admin Übersicht ---

app.get("/admin/overview", (req, res) => {
  if (assignments.length === 0) {
    return res.send("Noch keine Zuordnung vorhanden.");
  }

  let html = `
    <h1>Wichtel – Übersicht</h1>
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


// --- Reset (wenn nötig) ---

app.get("/admin/reset", (req, res) => {
  try {
    if (fs.existsSync("assignments.json")) fs.unlinkSync("assignments.json");
    assignments = autoDraw(); // direkt neu auslosen
    res.send("Reset durchgeführt und neue Auslosung erstellt.");
  } catch (err) {
    res.send("Fehler beim Reset.");
  }
});


// --- Server starten ---

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server läuft auf Port", PORT));
