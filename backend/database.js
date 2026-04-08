const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../institutional_exam_v4.db');

// Persist data across restarts
// if (fs.existsSync(dbPath)) {
//     fs.unlinkSync(dbPath);
// }

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the Institutional SQLite database v4.');
        
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE,
                username TEXT,
                role TEXT,
                name TEXT,
                gender TEXT,
                class TEXT,
                section TEXT,
                subject TEXT,
                designation TEXT,
                roll_number TEXT
            )`);
            
            db.run(`CREATE TABLE IF NOT EXISTS exams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                subject TEXT,
                difficulty TEXT,
                type TEXT,
                teacher_id INTEGER,
                duration INTEGER,
                target_class TEXT,
                FOREIGN KEY(teacher_id) REFERENCES users(id)
            )`);
            
            db.run(`CREATE TABLE IF NOT EXISTS questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                exam_id INTEGER,
                section_title TEXT,
                text TEXT,
                options TEXT,
                correct_answer TEXT,
                FOREIGN KEY(exam_id) REFERENCES exams(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER,
                exam_id INTEGER,
                score INTEGER DEFAULT 0,
                academic_score INTEGER DEFAULT 0,
                max_academic_score INTEGER DEFAULT 0,
                warnings INTEGER DEFAULT 0,
                identity_snapshot TEXT,
                status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'In Progress', 'Completed', 'Terminated')),
                FOREIGN KEY(student_id) REFERENCES users(id),
                FOREIGN KEY(exam_id) REFERENCES exams(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS violations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                attempt_id INTEGER,
                type TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                severity INTEGER,
                source TEXT,
                FOREIGN KEY(attempt_id) REFERENCES attempts(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER,
                receiver_id INTEGER,
                content TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(sender_id) REFERENCES users(id),
                FOREIGN KEY(receiver_id) REFERENCES users(id)
            )`);

            db.serialize(() => {
                // Keep only a clean Admin account for initial setup
                db.run(`INSERT OR IGNORE INTO users (email, role, username, name, designation) VALUES ('admin', 'admin', 'admin', 'Global Admin', 'System Administrator')`);
                
                console.log("Database initialized successfully with clean institutional state.");
            });
        });
    }
});

module.exports = db;
