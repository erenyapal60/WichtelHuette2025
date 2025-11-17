import express from "express";
import fs from "fs";
import sqlite3 from "sqlite3";
import path from "path";
import { open } from "sqlite";

const app = express();
app.use(express.json());
app.use(express.static("public"));

let db;

// === INIT SQLITE ===
async function initDB() {
  db = await open({
    filename: path.join('.', 'wichtel.db'),
    driver: sqlite3.Database
  });

  await db.exec(`
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

  // Teilnehmer importieren, wenn Tabelle leer
  const row = await db.get("SELECT COUNT(*) AS c FROM participants");
  if (row.c === 0 && fs.existsSync("data_participants.json")) {
    const list = JSON.parse(fs.readFileSync("data_participants.json", "utf8"));
    const stmt = await db.prepare("INSERT INTO participants (name, pin) VALUES (?, ?)");

    for (const p of list) {
      await stmt.run(p.name, p.pin);
    }
  }

  // Draw nur einmal
  const countA = await db.get("SELECT COUNT(*) AS c FROM assignments");
  if (countA.c === 0) {
    await runDraw();
  }
}

// === DERANGEMENT ===
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

// === DRAW ===
async function runDraw() {
  const participants = await db.all("SELECT * FROM participants");
  if (participants.length < 2) return;

  const names = participants.map(p => p.name);
  const targets = derange(names);

  const stmt = await db.prepare("INSERT INTO assignments (name, pin, target) VALUES (?, ?, ?)");

  for (let i = 0; i < participants.length; i++) {
    await stmt.run(participants[i].name, participants[i].pin, targets[i]);
  }
}

// === PIN CHECK ===
app.post("/check", async (req, res) => {
  const pin = (req.body.pin || "").trim();
  if (!pin) return res.status(400).send("PIN fehlt.");

  const row = await db.get("SELECT * FROM assignments WHERE pin = ?", pin);

  if (!row) return res.status(401).send("Falsche PIN.");

  res.json({
    ok: true,
    name: row.name,
    target: row.target
  });
});

// === ADMIN OVERVIEW (OHNE PASSWORT, WIE DU WILLST) ===
app.get("/admin/overview", async (req, res) => {
  const rows = await db.all("SELECT * FROM assignments");

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
  await db.exec("DELETE FROM assignments");
  await runDraw();
  res.send("Neu ausgelost ✔");
});

// === SERVER START ===
const PORT = process.env.PORT || 3000;
initDB().then(() => {
  app.listen(PORT, () => console.log("Server läuft auf Port", PORT));
});
