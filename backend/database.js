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

            db.run(`CREATE TABLE IF NOT EXISTS system_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT,
                target_id INTEGER,
                target_name TEXT,
                actor_id INTEGER,
                description TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER,
                receiver_id INTEGER,
                content TEXT,
                message_type TEXT DEFAULT 'text',
                file_url TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                broadcast_role TEXT,
                is_read BOOLEAN DEFAULT 0,
                FOREIGN KEY(sender_id) REFERENCES users(id),
                FOREIGN KEY(receiver_id) REFERENCES users(id)
            )`);

            // Migration: Add columns if they don't exist
            db.run("ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT 'text'", (err) => {});
            db.run("ALTER TABLE messages ADD COLUMN file_url TEXT", (err) => {});
            db.run("ALTER TABLE messages ADD COLUMN broadcast_role TEXT", (err) => {});
            db.run("ALTER TABLE messages ADD COLUMN is_read BOOLEAN DEFAULT 0", (err) => {});

            db.serialize(() => {
                // Keep only a clean Admin account for initial setup
                db.run(`INSERT OR IGNORE INTO users (email, role, username, name, designation) VALUES ('admin', 'admin', 'admin', 'Global Admin', 'System Administrator')`);
                
                db.run(`INSERT INTO system_logs (event_type, description) VALUES ('System Initialize', 'Institutional database v4 initialized with core security protocols.')`);
                
                console.log("Database initialized successfully with clean institutional state.");
            });
        });
    }
});

module.exports = db;
