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

  let data = [];
  if (fs.existsSync("data.json")) {
    data = JSON.parse(fs.readFileSync("data.json"));
  }

  data.push({ name, email });

  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
  res.send("Erfolgreich eingetragen!");
});


// AUSLOSUNG
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

  // Wichtel-Permutation erzeugen
  while (!valid) {
    perm.sort(() => Math.random() - 0.5);
    valid = perm.every((p, i) => p !== names[i]);
  }

  // E-Mails senden
  for (let i = 0; i < participants.length; i++) {
    await resend.emails.send({
      from: "hello@resend.dev",
      to: participants[i].email,
      subject: "Dein Wichtelpartner 🎁",
      html: `<p>Hallo ${participants[i].name},<br><br>
             Du beschenkst: <strong>${perm[i]}</strong></p>`
    });
  }

  res.send("Auslosung abgeschlossen! E-Mails wurden verschickt.");
});


// PORT für Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
