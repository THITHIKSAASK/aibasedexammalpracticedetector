const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'institutional_exam_v4.db');
const db = new sqlite3.Database(dbPath);

const data = {
    teachers: [
        { name: "Dr. Rajesh Sharma", email: "sharma@bannari.com", subject: "Science", class: "BTech CS-A" },
        { name: "Dr. Anita Gupta", email: "gupta@bannari.com", subject: "Math", class: "BTech CS-B" },
        { name: "Dr. Vikram Singh", email: "singh@bannari.com", subject: "Engineering", class: "BTech CS-C" },
        { name: "Dr. Meera Reddy", email: "reddy@bannari.com", subject: "History", class: "BTech CS-D" },
        { name: "Dr. Sanjay Verma", email: "verma@bannari.com", subject: "Geography", class: "BTech CS-E" }
    ],
    students: [
        // 3 for Science
        { name: "Arun Kumar", email: "arun@bannari.com", class: "BTech CS-A" },
        { name: "Bala Ji", email: "bala@bannari.com", class: "BTech CS-A" },
        { name: "Chitra Devi", email: "chitra_s@bannari.com", class: "BTech CS-A" },
        // 3 for Math
        { name: "Deepak Raj", email: "deepak@bannari.com", class: "BTech CS-B" },
        { name: "Ezhil Raja", email: "ezhil@bannari.com", class: "BTech CS-B" },
        { name: "Farooq Ahmed", email: "farooq@bannari.com", class: "BTech CS-B" },
        // 3 for Engineering
        { name: "Ganesh Ram", email: "ganesh@bannari.com", class: "BTech CS-C" },
        { name: "Hari Prasad", email: "hari@bannari.com", class: "BTech CS-C" },
        { name: "Indira K", email: "indira@bannari.com", class: "BTech CS-C" },
        // 3 for History
        { name: "Jaya Prakash", email: "jaya@bannari.com", class: "BTech CS-D" },
        { name: "Kiran Mai", email: "kiran@bannari.com", class: "BTech CS-D" },
        { name: "Latha M", email: "latha@bannari.com", class: "BTech CS-D" },
        // 3 for Geography
        { name: "Manoj S", email: "manoj@bannari.com", class: "BTech CS-E" },
        { name: "Naveen B", email: "naveen@bannari.com", class: "BTech CS-E" },
        { name: "Oviya R", email: "oviya@bannari.com", class: "BTech CS-E" }
    ]
};

const tables = ['violations', 'attempts', 'questions', 'exams', 'messages', 'comments', 'users'];

db.serialize(() => {
    console.log("Starting full database purge...");
    
    db.run("BEGIN TRANSACTION");
    
    tables.forEach(table => {
        db.run(`DELETE FROM ${table}`, (err) => {
            if (err) console.error(`Error purging ${table}:`, err.message);
        });
    });

    // Re-insert Admin
    db.run(`INSERT INTO users (email, role, username, name, designation) VALUES ('admin', 'admin', 'admin', 'Global Admin', 'System Administrator')`);

    console.log("Database purged. Starting professional seeding...");

    // Insert Teachers
    const stmtTeacher = db.prepare("INSERT INTO users (email, username, role, name, subject, class, designation) VALUES (?, ?, 'teacher', ?, ?, ?, 'Department Head')");
    data.teachers.forEach(t => {
        stmtTeacher.run(t.email, t.email.split('@')[0], t.name, t.subject, t.class);
    });
    stmtTeacher.finalize();

    // Insert Students
    const stmtStudent = db.prepare("INSERT INTO users (email, username, role, name, class, roll_number) VALUES (?, ?, 'student', ?, ?, ?)");
    data.students.forEach((s, idx) => {
        const roll = `CS${(idx + 1).toString().padStart(3, '0')}`;
        stmtStudent.run(s.email, s.email.split('@')[0], s.name, s.class, roll);
    });
    stmtStudent.finalize();

    db.run("COMMIT", (err) => {
        if (err) {
            console.error("Transaction failed:", err);
            return;
        }
        console.log("Users seeded successfully.");

        // Create Exams and Assign to Students
        db.all("SELECT id, name, subject, class FROM users WHERE role = 'teacher'", (err, teachers) => {
            if (err) return console.error(err);

            teachers.forEach(t => {
                const examTitle = `${t.subject} Comprehensive Review 2026`;
                db.run("INSERT INTO exams (title, subject, difficulty, type, teacher_id, duration, target_class) VALUES (?, ?, 'High', 'Institutional', ?, 3600, ?)",
                    [examTitle, t.subject, t.id, t.class], function(err) {
                        if (err) return console.error(err);
                        const examId = this.lastID;
                        
                        // Assigning 3 mock questions for each exam (they'll be fetched from bank by server, 
                        // but we need to pre-populate 'questions' table for the exam to be valid in 'student.js' logic)
                        // Actually, server.js QUESTION_BANK is for 'generation', but student.js fetches from /api/student/exam/:examId/questions
                        // which queries 'questions' table. So we MUST seed questions table.
                        
                        // Mock questions for seeding (real rigor comes from server.js generation, but let's seed some here too)
                        const questions = [
                            { text: `Fundamental Principle of ${t.subject}`, options: ["Option A", "Option B", "Option C", "Option D"], correct: "Option A" },
                            { text: `Advanced Methodology in ${t.subject}`, options: ["Method 1", "Method 2", "Method 3", "Method 4"], correct: "Method 1" }
                        ];

                        questions.forEach(q => {
                            db.run("INSERT INTO questions (exam_id, section_title, text, options, correct_answer) VALUES (?, 'Core Analysis', ?, ?, ?)",
                                [examId, q.text, JSON.stringify(q.options), q.correct]);
                        });

                        // Link Students to this exam via attempts
                        db.run(`INSERT INTO attempts (student_id, exam_id, max_academic_score, status) 
                                SELECT id, ?, ?, 'Pending' FROM users WHERE role = 'student' AND class = ?`, 
                                [examId, questions.length, t.class]);
                    }
                );
            });
            console.log("Exams and specific assignments established.");
            db.close();
        });
    });
});
