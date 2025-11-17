import express from "express";
import fs from "fs";
import path from "path";
import initSqlJs from "sql.js";

const app = express();
app.use(express.json());
app.use(express.static("public"));

const DB_PATH = path.join(".", "wichtel.sqlite");

let SQL;
let db;

// === Datenbank laden/erstellen ===
async function loadDB() {
  SQL = await initSqlJs({
    locateFile: file => `node_modules/sql.js/dist/${file}`
  });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Tabellen erzeugen
  db.run(`
    CREATE TABLE IF NOT EXISTS participants (
      name TEXT UNIQUE,
      pin TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS assignments (
      name TEXT UNIQUE,
      pin TEXT,
      target TEXT
    );
  `);
}

// === DB speichern ===
function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// === Teilnehmer importieren ===
function importParticipantsIfEmpty() {
  const res = db.exec("SELECT COUNT(*) AS c FROM participants");
  const count = res[0].values[0][0];

  if (count === 0 && fs.existsSync("data_participants.json")) {
    const list = JSON.parse(fs.readFileSync("data_participants.json", "utf8"));
    const stmt = db.prepare("INSERT INTO participants VALUES (?, ?)");

    list.forEach(p => {
      stmt.run([p.name, p.pin]);
    });

    stmt.free();
    saveDB();
  }
}

// === Derangement ===
function derange(arr) {
  const res = [...arr];
  for (let i = 0; i < res.length - 1; i++) {
    let j = i + Math.floor(Math.random() * (res.length - i));
    [res[i], res[j]] = [res[j], res[i]];
  }
  if (res[res.length - 1] === arr[arr.length - 1]) {
    [res[res.length - 1], res[res.length - 2]] = [res[res.length - 2], res[res.length - 1]];
  }
  return res;
}

// === Draw only once ===
function drawIfNeeded() {
  const row = db.exec("SELECT COUNT(*) AS c FROM assignments")[0].values[0][0];
  if (row > 0) return;

  const participants = db.exec("SELECT name, pin FROM participants")[0].values;

  if (participants.length < 2) return;

  const names = participants.map(p => p[0]);
  const targets = derange(names);

  const stmt = db.prepare("INSERT INTO assignments VALUES (?, ?, ?)");

  for (let i = 0; i < participants.length; i++) {
    stmt.run([participants[i][0], participants[i][1], targets[i]]);
  }

  stmt.free();
  saveDB();
}

// === PIN CHECK ===
app.post("/check", (req, res) => {
  const pin = (req.body.pin || "").trim();
  if (!pin) return res.status(400).send("PIN fehlt.");

  const row = db.exec("SELECT * FROM assignments WHERE pin = ?", [pin]);

  if (!row.length) return res.status(401).send("Falsche PIN.");

  const [name, p, target] = row[0].values[0];

  res.json({ ok: true, name, target });
});

// === ADMIN OVERVIEW ===
app.get("/admin/overview", (_req, res) => {
  const rows = db.exec("SELECT * FROM assignments")[0].values;

  let html = `
  <h1>Wichtel Übersicht</h1>
  <table border="1" cellpadding="6">
    <tr><th>Name</th><th>PIN</th><th>Beschenkt</th></tr>
  `;

  rows.forEach(r => {
    html += `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`;
  });

  html += "</table>";
  res.send(html);
});

// === RESET ===
app.get("/admin/reset", (_req, res) => {
  db.run("DELETE FROM assignments");
  saveDB();
  drawIfNeeded();
  res.send("Neu ausgelost ✔");
});

// === Start App ===
(async () => {
  await loadDB();
  importParticipantsIfEmpty();
  drawIfNeeded();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log("Server läuft auf Port", PORT));
})();

