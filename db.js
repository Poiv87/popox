const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'chat.sqlite'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    bio TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    room TEXT,
    "from" TEXT,
    "to" TEXT,
    msg TEXT,
    timestamp DATETIME DEFAULT (datetime('now','utc','+3 hours','+30 minutes'))
  )`);
});

module.exports = db;