import express from "express";

const app = express();
app.use(express.json());
app.use(express.static("public"));

// === Dekodierfunktion (Base64 → Klartext) ===
function decode(b64) {
  return Buffer.from(b64, "base64").toString("utf8");
}

// === HARD-CODED ASSIGNMENTS (Name + PIN sichtbar, target verschlüsselt) ===
// >>> Du kannst diese Liste jederzeit erweitern oder ändern <<<
const assignments = [
  { name: "Eren Yapal",        pin: "483920", target: "U2FocmEgWWFwYWw=" },
  { name: "Sahra Yapal",       pin: "239818", target: "QXpyYSBZYXBhbA==" },
  { name: "Azra Yapal",        pin: "551009", target: "Q2FuIERlbWly" },
  { name: "Can Demir",         pin: "822194", target: "Q2FuZXIgRGVtaXI=" },
  { name: "Caner Demir",       pin: "822194", target: "VG9sZ2EgU2Vu" },
  { name: "Tolga Sen",         pin: "822194", target: "Q2lzaWwgRXJkb2dhbg==" },
  { name: "Cisil Erdogan",     pin: "822194", target: "WWFnbXVyIEVyZG9nYW4=" },
  { name: "Yagmur Erdogan",    pin: "822194", target: "RXNyYSBUZWtlbGk=" },
  { name: "Esra Tekeli",       pin: "822194", target: "QXRpbGxhIEVyZG9nYW4=" },
  { name: "Atilla Erdogan",    pin: "822194", target: "T2thbiBFcmRvZ2Fu" },
  { name: "Okan Erdogan",      pin: "822194", target: "WWVzaW0gWWFwYWw=" },
  { name: "Yesim Yapal",       pin: "822194", target: "WWFnbXVyIEF5eWlsZGl6" },
  { name: "Yagmur Ayyildiz",   pin: "822194", target: "RWRpeg==" },
  { name: "Ediz",              pin: "822194", target: "VG9wcmFrIEF5eWlsZGl6" },
  { name: "Toprak Ayyildiz",   pin: "822194", target: "U//DvGE=" },
  { name: "Rüya",              pin: "822194", target: "QXN1ZGUgRXJkb2dhbg==" },
  { name: "Asude Erdogan",     pin: "822194", target: "RXJlbiBZYXBhbA==" }
];

// === PIN CHECK Route ===
app.post("/check", (req, res) => {
  const pin = req.body.pin?.trim();

  if (!pin) {
    return res.status(400).send("PIN fehlt.");
  }

  const entry = assignments.find(a => a.pin === pin);

  if (!entry) {
    return res.status(401).send("Falsche PIN.");
  }

  res.json({
    ok: true,
    name: entry.name,
    target: decode(entry.target)  // entschlüsselt
  });
});

// === ADMIN OVERVIEW (keine Sicherheit nötig, wie du wolltest) ===
app.get("/admin/overview", (_req, res) => {
  let html = `
    <h1>Wichtel Übersicht</h1>
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
        <td>${decode(e.target)}</td>
      </tr>
    `;
  }

  html += "</table>";
  res.send(html);
});

// === START ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server läuft auf Port", PORT);
});
