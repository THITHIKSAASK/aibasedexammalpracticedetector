const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'institutional_exam_v4.db');
const db = new sqlite3.Database(dbPath);

console.log("Fetching Students and Teachers...");

db.all("SELECT name, email, role, class, subject, roll_number FROM users WHERE role IN ('teacher', 'student') ORDER BY role, name", (err, rows) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    
    console.log("\n--- FACULTY (TEACHERS) ---");
    rows.filter(r => r.role === 'teacher').forEach(t => {
        console.log(`- ${t.name} (${t.email}) | Dept: ${t.subject} | ID: ${t.roll_number || 'N/A'}`);
    });

    console.log("\n--- STUDENTS ---");
    rows.filter(r => r.role === 'student').forEach(s => {
        console.log(`- ${s.name} (${s.email}) | Class: ${s.class} | Roll: ${s.roll_number || 'N/A'}`);
    });

    db.close();
});
