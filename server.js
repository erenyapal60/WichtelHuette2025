import express from "express";
import fs from "fs";
import { Resend } from "resend";

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

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
  let participants = [];

  if (fs.existsSync("data.json")) {
    participants = JSON.parse(fs.readFileSync("data.json"));
  }

  if (participants.length < 2) {
    return res.send("Zu wenige Teilnehmer.");
  }

  const names = participants.map((p) => p.name);
  let perm = [...names];
  let valid = false;

  while (!valid) {
    perm.sort(() => Math.random() - 0.5);
    valid = perm.every((p, i) => p !== names[i]);
  }

  for (let i = 0; i < participants.length; i++) {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: participants[i].email,
      subject: "Dein Wichtelpartner 🎁",
      html: `<p>Du beschenkst: <strong>${perm[i]}</strong></p>`
    });
  }

  res.send("Auslosung abgeschlossen! E-Mails wurden verschickt.");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});

await resend.emails.send({
  from: "onboarding@resend.dev",
  to: participants[i].email,
  subject: "Dein Wichtelpartner 🎁",
  html: `<p>Du beschenkst: <strong>${perm[i]}</strong></p>`
});


