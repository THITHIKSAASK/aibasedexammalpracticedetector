const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../institutional_exam_v4.db');
const db = new sqlite3.Database(dbPath);

console.log("Checking Attempts...");

db.all(`
    SELECT a.id as attempt_id, a.status, u.name as student_name, e.title as exam_title, e.target_class
    FROM attempts a
    JOIN users u ON a.student_id = u.id
    JOIN exams e ON a.exam_id = e.id
`, (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    if (rows.length === 0) {
        console.log("No attempts found.");
    } else {
        rows.forEach(row => {
            console.log(`- Attempt ID: ${row.attempt_id} | Status: ${row.status} | Student: ${row.student_name} | Exam: ${row.exam_title} | Target Class: ${row.target_class}`);
        });
    }
    db.close();
});
