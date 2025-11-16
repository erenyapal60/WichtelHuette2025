import express from "express";
import fs from "fs";
import { Resend } from "resend";

const app = express();
const resend = new Resend("re_h3g1wBoW_7ixAJZBWcnXxCbwcKZ33xcHd");

app.use(express.json());
app.use(express.static("public"));

// Teilnehmer speichern
app.post("/add", (req, res) => {
  const { name, email } = req.body;

  // Lade bestehende Daten
  let data = [];
  if (fs.existsSync("data.json")) {
    data = JSON.parse(fs.readFileSync("data.json"));
  }

  // Push neuer Teilnehmer
  data.push({ name, email });

  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
  res.send("Erfolgreich eingetragen!");
});

// Auslosung starten und E-Mails senden
app.get("/draw", async (req, res) => {
  if (!fs.existsSync("data.json")) {
    return res.send("Keine Teilnehmer vorhanden.");
  }

  const participants = JSON.parse(fs.readFileSync("data.json"));
  const names = participants.map(p => p.name);

  // Erzeuge gültige Wichtel-Zuordnung
  let perm = [...names];
  let valid = false;

  while (!valid) {
    perm.sort(() => Math.random() - 0.5);
    valid = perm.every((p, i) => p !== names[i]);
  }

  // Maile jeden Teilnehmer an
  for (let i = 0; i < participants.length; i++) {
    await resend.emails.send({
      from: "wichteln@huette2025.com",
      to: participants[i].email,
      subject: "Dein Wichtelpartner 🎁",
      html: `<p>Hallo ${participants[i].name},<br>
      du beschenkst dieses Jahr:<br><br>
      <strong>${perm[i]}</strong></p>`
    });
  }

  res.send("Auslosung abgeschlossen! E-Mails wurden verschickt.");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});