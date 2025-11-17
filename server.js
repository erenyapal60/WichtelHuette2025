import express from "express";
import fs from "fs";
import Database from "better-sqlite3";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.static("public"));

// === ADMIN PASSWORD ===
const ADMIN_KEY = process.env.ADMIN_KEY || "1903";

// === SQLITE INIT ===
const dbPath = path.join(".", "wichtel.db");
const db = new Database(dbPath);

// === CREATE TABLES ===
db.exec(`
  CREATE TABLE IF NOT EXISTS participants (
    name TEXT UNIQUE NOT NULL,
    pin TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS assignments (
    name TEXT UNIQUE NOT NULL,
    pin TEXT NOT NULL,
    target TEXT NOT NULL
  );
`);

// === LOAD PARTICIPANTS FROM JSON (ONLY IF TABLE EMPTY) ===
function loadParticipantsIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM participants").get().c;

  if (count === 0 && fs.existsSync("data_participants.json")) {
    const raw = fs.readFileSync("data_participants.json", "utf8").trim();
    const list = JSON.parse(raw);

    const insert = db.prepare("INSERT INTO participants (name, pin) VALUES (?, ?)");

    for (const p of list) {
      insert.run(p.name, p.pin);
    }
  }
}

// === Derangement (Perfekt) ===
function derange(arr) {
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

// === Draw only if assignments are empty ===
function runDrawIfNeeded() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM assignments").get().c;
  if (count > 0) return; // Already drawn → skip

  const participants = db.prepare("SELECT * FROM participants").all();
  if (participants.length < 2) return;

  const names = participants.map(p => p.name);
  const deranged = derange(names);

  const insert = db.prepare(`
    INSERT INTO assignments (name, pin, target)
    VALUES (?, ?, ?)
  `);

  for (let i = 0; i < participants.length; i++) {
    insert.run(participants[i].name, participants[i].pin, deranged[i]);
  }
}

// === INITIALIZE ===
loadParticipantsIfEmpty();
runDrawIfNeeded();

// === PIN CHECK ===
app.post("/check", (req, res) => {
  const pin = (req.body.pin || "").trim();
  if (!pin) return res.status(400).send("PIN fehlt.");

  const row = db.prepare("SELECT * FROM assignments WHERE pin = ?").get(pin);

  if (!row) return res.status(401).send("Falsche PIN.");

  res.json({
    ok: true,
    name: row.name,
    target: row.target
  });
});

// === ADMIN OVERVIEW ===
app.get("/admin/overview", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).send("Zugriff verweigert.");
  }

  const rows = db.prepare("SELECT * FROM assignments").all();

  let html = `
  <h1>Wichtel Übersicht</h1>
  <table border="1" cellspacing="0" cellpadding="6">
    <tr><th>Name</th><th>PIN</th><th>Beschenkt</th></tr>
  `;

  for (const r of rows) {
    html += `
    <tr>
      <td>${r.name}</td>
      <td>${r.pin}</td>
      <td>${r.target}</td>
    </tr>`;
  }

  html += "</table>";
  res.send(html);
});

// === ADMIN RESET ===
app.get("/admin/reset", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).send("Zugriff verweigert.");
  }

  db.prepare("DELETE FROM assignments").run();
  runDrawIfNeeded();

  res.send("Neu ausgelost ✔");
});

// === Server Start ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server läuft auf Port", PORT));
