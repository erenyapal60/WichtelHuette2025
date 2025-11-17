import express from "express";
import fs from "fs";
import crypto from "crypto";

const app = express();

app.use(express.json());
app.use(express.static("public"));

// --- 1. Teilnehmer-Liste vorher festlegen (Name + PIN)

let participants = [];
if (fs.existsSync("data_participants.json")) {
  participants = JSON.parse(fs.readFileSync("data_participants.json"));
}

// --- 2. Auslosung einmalig durchführen

app.get("/admin/draw", (req, res) => {
  if (participants.length < 2) {
    return res.send("Zu wenige Teilnehmer.");
  }

  const names = participants.map(p => p.name);

  // faire Permutation
  let perm = [...names];
  let ok = false;

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

  res.send("Auslosung abgeschlossen.");
});

// --- 3. PIN-Eingabe: Partner anzeigen

app.post("/check", (req, res) => {
  if (!fs.existsSync("assignments.json")) {
    return res.status(400).send("Auslosung wurde noch nicht durchgeführt.");
  }

  const data = JSON.parse(fs.readFileSync("assignments.json"));
  const pin = req.body.pin?.trim();

  if (!pin) return res.status(400).send("PIN fehlt.");

  const entry = data.find(e => e.pin === pin);

  if (!entry) return res.status(401).send("Falsche PIN!");

  res.json({
    ok: true,
    name: entry.name,
    target: entry.target
  });
});

// --- 4. Reset

app.get("/admin/reset", (req, res) => {
  try {
    if (fs.existsSync("assignments.json")) fs.unlinkSync("assignments.json");

    return res.send("System zurückgesetzt.");
  } catch (err) {
    return res.send("Fehler.");
  }
});

// --- 5. Start

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server läuft auf Port", PORT));
