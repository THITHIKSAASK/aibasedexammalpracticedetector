const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'institutional_exam_v4.db');
const db = new sqlite3.Database(dbPath);

const tables = ['violations', 'messages', 'attempts', 'exams', 'users'];

db.serialize(() => {
    console.log("--- STARTING INSTITUTIONAL DATA PURGE (v4) ---");
    tables.forEach(table => {
        db.run(`DELETE FROM ${table}`, (err) => {
            if (err) console.error(`Error clearing ${table}:`, err.message);
            else console.log(`Cleared table: ${table}`);
        });
    });
});
db.close();
