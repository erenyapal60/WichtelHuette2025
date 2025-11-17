import express from "express";
import fs from "fs";
import sqlite3 from "sqlite3";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.static("public"));

// === SQLITE INITIALISIEREN ===
const dbPath = path.join(".", "wichtel.db");
const db = new sqlite3.Database(dbPath);

// === SQL HELPER (Promise-basiert) ===
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// === TABLES ===
await run(`
  CREATE TABLE IF NOT EXISTS participants (
    name TEXT UNIQUE NOT NULL,
    pin TEXT NOT NULL
  )
`);

await run(`
  CREATE TABLE IF NOT EXISTS assignments (
    name TEXT UNIQUE NOT NULL,
    pin TEXT NOT NULL,
    target TEXT NOT NULL
  )
`);

// === Teilnehmer nur 1x importieren ===
async function importParticipants() {
  const row = await get("SELECT COUNT(*) AS c FROM participants");
  if (row.c === 0 && fs.existsSync("data_participants.json")) {
    const list = JSON.parse(fs.readFileSync("data_participants.json", "utf8"));

    for (const p of list) {
      await run("INSERT INTO participants (name, pin) VALUES (?, ?)", [
        p.name,
        p.pin
      ]);
    }
  }
}

// === Derangement ===
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

// === Draw nur wenn leer ===
async function drawIfNeeded() {
  const row = await get("SELECT COUNT(*) AS c FROM assignments");
  if (row.c > 0) return;

  const participants = await all("SELECT * FROM participants");
  if (participants.length < 2) return;

  const names = participants.map(p => p.name);
  const targets = derange(names);

  for (let i = 0; i < participants.length; i++) {
    await run(
      "INSERT INTO assignments (name, pin, target) VALUES (?, ?, ?)",
      [participants[i].name, participants[i].pin, targets[i]]
    );
  }
}

// === INIT ===
await importParticipants();
await drawIfNeeded();

// === PIN CHECK ===
app.post("/check", async (req, res) => {
  const pin = (req.body.pin || "").trim();
  if (!pin) return res.status(400).send("PIN fehlt.");

  const row = await get("SELECT * FROM assignments WHERE pin = ?", [pin]);

  if (!row) return res.status(401).send("Falsche PIN.");

  res.json({
    ok: true,
    name: row.name,
    target: row.target
  });
});

// === ADMIN OVERVIEW ===
app.get("/admin/overview", async (req, res) => {
  const rows = await all("SELECT * FROM assignments");

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

// === RESET ===
app.get("/admin/reset", async (_req, res) => {
  await run("DELETE FROM assignments");
  await drawIfNeeded();
  res.send("Neu ausgelost ✔");
});

// === START ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server läuft auf Port", PORT));
