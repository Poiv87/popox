const db = require('../db');

class Message {
    static create({ from, to, msg, room }) {
        return new Promise((res, rej) => db.run(
            'INSERT INTO messages (room, "from", "to", msg) VALUES (?, ?, ?, ?)',
            [room, from, to, msg], function (err) {
                if (err) rej(err);
                else res(this.lastID);
            }
        ));
    }

    static getById(id) {
        return new Promise((res, rej) => db.get(
            'SELECT msg, timestamp FROM messages WHERE id = ?',
            [id], (err, row) => err ? rej(err) : res(row)
        ));
    }

    static getBetween(user1, user2) {
        const room = [user1, user2].sort().join('#');
        return new Promise((res, rej) => db.all(
            'SELECT "from" AS user, msg, timestamp FROM messages WHERE room = ? ORDER BY timestamp ASC',
            [room], (err, rows) => err ? rej(err) : res(rows)
        ));
    }

    static getPartners(username) {
        const sql = `
      SELECT DISTINCT CASE WHEN "from" = ? THEN "to" ELSE "from" END AS partner
      FROM messages WHERE "from" = ? OR "to" = ?
    `;
        return new Promise((res, rej) => db.all(sql, [username, username, username], (err, rows) => {
            if (err) rej(err);
            else res(rows.map(r => r.partner));
        }));
    }
}

module.exports = Message;