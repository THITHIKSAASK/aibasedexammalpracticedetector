const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'institutional_exam_v4.db');
const db = new sqlite3.Database(dbPath);

const departments = ['Science', 'History', 'English', 'Math', 'Geography', 'Engineering'];

const faculties = [
    { name: 'Dr. Aruna', email: 'aruna@bannari.com', subject: 'Science', designation: 'Professor', class: 'BTech CSE' },
    { name: 'Dr. Bharat', email: 'bharat@bannari.com', subject: 'Math', designation: 'Associate Professor', class: 'BTech IT' },
    { name: 'Dr. Chitra', email: 'chitra@bannari.com', subject: 'English', designation: 'Assistant Professor', class: 'BTech ECE' },
    { name: 'Dr. Deepak', email: 'deepak@bannari.com', subject: 'History', designation: 'Lecturer', class: 'BTech MECH' },
    { name: 'Dr. Easwari', email: 'easwari@bannari.com', subject: 'Geography', designation: 'Professor', class: 'BTech CIVIL' }
];

const studentsCount = 20;

function generateStudents() {
    const students = [];
    for (let i = 1; i <= studentsCount; i++) {
        const dept = departments[i % departments.length];
        students.push({
            name: `Student ${i}`,
            email: `student${i}@bannari.com`,
            class: `BTech ${dept}`,
            section: `S${(i % 2) + 1}`,
            roll_number: `${dept.substring(0, 2).toUpperCase()}${i.toString().padStart(2, '0')}`
        });
    }
    return students;
}

const sampleQuestions = [
    { text: "What is the primary function of the mitochondria?", options: ["Energy production", "Protein synthesis", "Waste management", "Genetic storage"], correct: "Energy production" },
    { text: "Which element has the atomic number 1?", options: ["Hydrogen", "Helium", "Oxygen", "Carbon"], correct: "Hydrogen" },
    { text: "What is the speed of light?", options: ["299,792 km/s", "300,000 m/s", "150,000 km/s", "1,000,000 km/s"], correct: "299,792 km/s" }
];

db.serialize(() => {
    console.log("Starting database seeding...");

    // Insert Faculties
    const stmtTeacher = db.prepare("INSERT OR IGNORE INTO users (email, username, role, name, subject, designation, class, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    faculties.forEach(f => {
        stmtTeacher.run(f.email, f.email.split('@')[0], 'teacher', f.name, f.subject, f.designation, f.class, 'Institutional');
    });
    stmtTeacher.finalize();
    console.log("Faculties seeded.");

    // Insert Students
    const students = generateStudents();
    const stmtStudent = db.prepare("INSERT OR IGNORE INTO users (email, username, role, name, class, section, roll_number, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    students.forEach(s => {
        stmtStudent.run(s.email, s.email.split('@')[0], 'student', s.name, s.class, s.section, s.roll_number, 'Institutional');
    });
    stmtStudent.finalize();
    console.log("Students seeded.");

    // Create Exams and Assign to students
    db.all("SELECT id, subject, class FROM users WHERE role = 'teacher'", (err, teachers) => {
        if (err) return console.error(err);

        teachers.forEach(t => {
            const examTitle = `${t.subject} Mid-Term Protocol 2026`;
            db.run("INSERT INTO exams (title, subject, difficulty, type, teacher_id, duration, target_class) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [examTitle, t.subject, 'Medium', 'Institutional', t.id, 3600, t.class], function(err) {
                    if (err) return console.error(err);
                    const examId = this.lastID;

                    // Insert Questions
                    const stmtQ = db.prepare("INSERT INTO questions (exam_id, section_title, text, options, correct_answer) VALUES (?, ?, ?, ?, ?)");
                    sampleQuestions.forEach(q => {
                        stmtQ.run(examId, 'General', q.text, JSON.stringify(q.options), q.correct);
                    });
                    stmtQ.finalize();

                    // Assign to students of that class
                    db.run(`INSERT INTO attempts (student_id, exam_id, max_academic_score, status) 
                            SELECT id, ?, ?, 'Pending' FROM users WHERE role = 'student' AND class = ?`, 
                            [examId, sampleQuestions.length, t.class]);
                }
            );
        });
        console.log("Exams and assignments created.");
    });
});
