// models/user.js
const db = require('../db');

class User {
    static create({ username, password, bio }) {
        return new Promise((res, rej) => {
            db.run(
                'INSERT INTO users (username, password, bio) VALUES (?, ?, ?)',
                [username, password, bio],
                function (err) { err ? rej(err) : res({ id: this.lastID, username }); }
            );
        });
    }

    
    static findByUsername(username) {
        return new Promise((res, rej) => {
            db.get(
                'SELECT id, username, password, bio FROM users WHERE username = ?',
                [username],
                (err, row) => err ? rej(err) : res(row)
            );
        });
    }

    static listAll() {
        return new Promise((res, rej) => {
            db.all(
                'SELECT username FROM users',
                [],
                (err, rows) => err ? rej(err) : res(rows.map(r => r.username))
            );
        });
    }

    static search(q, excludeUsername) {
        const pattern = `%${q}%`;
        return new Promise((res, rej) => {
            db.all(
                'SELECT username FROM users WHERE username LIKE ? AND username != ?',
                [pattern, excludeUsername],
                (err, rows) => err ? rej(err) : res(rows.map(r => r.username))
            );
        });
    }
}

module.exports = User;
