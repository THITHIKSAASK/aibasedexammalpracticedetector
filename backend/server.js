const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Multer setup for PDF uploads
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// REQUEST LOGGER
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

app.use(express.static(path.join(__dirname, '../frontend')));

// AUTHENTICATION
app.post('/api/login', (req, res) => {
    const { email } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            res.json({ message: 'Login successful', user: row });
        } else {
            res.status(401).json({ error: 'User not found. Please register first.' });
        }
    });
});

app.post('/api/register', (req, res) => {
    const { role, username, name, email, class: cls, section, subject, designation } = req.body;
    const finalRole = role || 'student';
    
    if (!email || !email.endsWith('@bannari.com')) {
        return res.status(400).json({ error: 'Only institutional email IDs (@bannari.com) are allowed.' });
    }

    // Auto-generate Roll Number (e.g. IT01)
    const prefix = (cls || 'ST').substring(0, 2).toUpperCase();
    db.get(`SELECT COUNT(*) as count FROM users WHERE class = ?`, [cls], (err, row) => {
        const rollNumber = `${prefix}${(row ? row.count + 1 : 1).toString().padStart(2, '0')}`;
        
        let finalGroupName = name;
        if (finalRole === 'teacher' && !name.toLowerCase().startsWith('dr.')) {
            finalGroupName = `Dr. ${name}`;
        }

        const query = `INSERT INTO users (email, username, role, name, gender, class, section, subject, designation, roll_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        db.run(query, [email, username, finalRole, finalGroupName, req.body.gender || 'Institutional', cls, section, subject, designation, rollNumber], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                     return res.status(400).json({ error: 'Email already active in system.' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ 
                message: 'Registration successful', 
                user: { id: this.lastID, role: finalRole, username, name: finalGroupName, email, gender: req.body.gender, roll_number: rollNumber } 
            });
        });
    });
});

// UNIVERSAL EXTRACTION (PDF, Image, Text)
app.post('/api/teacher/extract-content', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: 'Multer Error: ' + err.message });
        } else if (err) {
            return res.status(500).json({ error: 'Upload Error: ' + err.message });
        }
        next();
    });
}, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    
    const mime = req.file.mimetype;
    const buffer = req.file.buffer;

    try {
        let extractedText = "";

        if (mime === 'application/pdf') {
            const data = await pdfParse(buffer);
            extractedText = data.text;
        } else if (mime.startsWith('image/')) {
            const { data: { text } } = await Tesseract.recognize(buffer);
            extractedText = text;
        } else if (mime === 'text/plain') {
            extractedText = buffer.toString('utf8');
        } else {
            return res.status(400).json({ error: 'Unsupported file type for knowledge extraction.' });
        }

        res.json({ text: extractedText });
    } catch (err) {
        console.error("Extraction Error:", err);
        res.status(500).json({ error: 'Failed to process file: ' + err.message });
    }
});

// ROBUST MOCK AI GENERATION ENGINE: Deep Knowledge Repository
const QUESTION_BANK = {
    Science: [
        { text: "What is the primary function of the mitochondria?", options: ["Energy production", "Protein synthesis", "Waste management", "Genetic storage"], correct: "Energy production", difficulty: "Medium" },
        { text: "Which element has the atomic number 1?", options: ["Hydrogen", "Helium", "Oxygen", "Carbon"], correct: "Hydrogen", difficulty: "Easy" },
        { text: "What is the speed of light?", options: ["299,792 km/s", "300,000 m/s", "150,000 km/s", "1,000,000 km/s"], correct: "299,792 km/s", difficulty: "Medium" },
        { text: "Which organ is responsible for pumping blood?", options: ["Heart", "Lungs", "Brain", "Kidney"], correct: "Heart", difficulty: "Easy" },
        { text: "The process by which plants make food is...", options: ["Photosynthesis", "Respiration", "Digestion", "Fermentation"], correct: "Photosynthesis", difficulty: "Easy" },
        { text: "What is the powerhouse of the cell?", options: ["Mitochondria", "Nucleus", "Ribosome", "Cytoplasm"], correct: "Mitochondria", difficulty: "Easy" },
        { text: "Which planet is known as the Red Planet?", options: ["Mars", "Venus", "Jupiter", "Saturn"], correct: "Mars", difficulty: "Easy" },
        { text: "What is the chemical symbol for Water?", options: ["H2O", "CO2", "O2", "N2"], correct: "H2O", difficulty: "Easy" },
        { text: "Which gas do plants absorb from the atmosphere?", options: ["Carbon Dioxide", "Oxygen", "Nitrogen", "Methane"], correct: "Carbon Dioxide", difficulty: "Easy" },
        { text: "What is the study of living things called?", options: ["Biology", "Chemistry", "Physics", "Geology"], correct: "Biology", difficulty: "Easy" },
        { text: "Newton's First Law is also known as...", options: ["Law of Inertia", "Law of Gravity", "Law of Motion", "Law of Energy"], correct: "Law of Inertia", difficulty: "Hard" },
        { text: "Which part of the atom has a positive charge?", options: ["Proton", "Neutron", "Electron", "Nucleus"], correct: "Proton", difficulty: "Medium" }
    ],
    Geography: [
        { text: "Which is the longest river in the world?", options: ["Nile", "Amazon", "Yangtze", "Mississippi"], correct: "Nile", difficulty: "Medium" },
        { text: "What is the capital of France?", options: ["Paris", "Lyon", "Marseille", "Berlin"], correct: "Paris", difficulty: "Easy" },
        { text: "Which continent is known as the 'Dark Continent'?", options: ["Africa", "Asia", "South America", "Australia"], correct: "Africa", difficulty: "Medium" },
        { text: "Which is the largest ocean on Earth?", options: ["Pacific", "Atlantic", "Indian", "Arctic"], correct: "Pacific", difficulty: "Easy" },
        { text: "What is the highest mountain in the world?", options: ["Everest", "K2", "Kangchenjunga", "Lhotse"], correct: "Everest", difficulty: "Easy" },
        { text: "Which country is also a continent?", options: ["Australia", "Canada", "Russia", "Brazil"], correct: "Australia", difficulty: "Easy" },
        { text: "The equator passes through which continent?", options: ["Africa", "Asia", "Europe", "North America"], correct: "Africa", difficulty: "Medium" },
        { text: "Which is the smallest country in the world?", options: ["Vatican City", "Monaco", "San Marino", "Liechtenstein"], correct: "Vatican City", difficulty: "Medium" },
        { text: "What is the capital of Japan?", options: ["Tokyo", "Kyoto", "Osaka", "Seoul"], correct: "Tokyo", difficulty: "Easy" },
        { text: "Which desert is the largest in the world?", options: ["Sahara", "Gobi", "Arabian", "Kalahari"], correct: "Sahara", difficulty: "Medium" },
        { text: "The Suez Canal connects which two seas?", options: ["Mediterranean and Red", "Black and Caspian", "North and Baltic", "Red and Arabian"], correct: "Mediterranean and Red", difficulty: "Hard" }
    ],
    History: [
        { text: "Who was the first President of the United States?", options: ["George Washington", "Thomas Jefferson", "Abraham Lincoln", "John Adams"], correct: "George Washington", difficulty: "Easy" },
        { text: "In which year did World War II end?", options: ["1945", "1918", "1939", "1963"], correct: "1945", difficulty: "Medium" },
        { text: "The French Revolution began in which year?", options: ["1789", "1776", "1812", "1848"], correct: "1789", difficulty: "Medium" },
        { text: "Who was the first human in space?", options: ["Yuri Gagarin", "Neil Armstrong", "Buzz Aldrin", "John Glenn"], correct: "Yuri Gagarin", difficulty: "Medium" },
        { text: "Which empire built the Colosseum in Rome?", options: ["Roman", "Greek", "Egyptian", "Byzantine"], correct: "Roman", difficulty: "Easy" },
        { text: "Who wrote the 'I Have a Dream' speech?", options: ["Martin Luther King Jr.", "Malcolm X", "Nelson Mandela", "Rosa Parks"], correct: "Martin Luther King Jr.", difficulty: "Easy" },
        { text: "The Titanic sank in which year?", options: ["1912", "1905", "1923", "1898"], correct: "1912", difficulty: "Easy" },
        { text: "Magna Carta was signed in which year?", options: ["1215", "1066", "1492", "1776"], correct: "1215", difficulty: "Hard" },
        { text: "Who was the Queen of England during the Spanish Armada?", options: ["Elizabeth I", "Mary I", "Victoria", "Anne"], correct: "Elizabeth I", difficulty: "Hard" }
    ],
    Math: [
        { text: "What is the square root of 144?", options: ["12", "14", "10", "16"], correct: "12", difficulty: "Easy" },
        { text: "What is 15% of 200?", options: ["30", "20", "40", "15"], correct: "30", difficulty: "Medium" },
        { text: "Solve for x: 2x + 5 = 15", options: ["5", "10", "7.5", "20"], correct: "5", difficulty: "Medium" },
        { text: "What is the value of Pi (to 2 decimal places)?", options: ["3.14", "3.16", "3.12", "3.18"], correct: "3.14", difficulty: "Easy" },
        { text: "What is 7 times 8?", options: ["56", "54", "48", "64"], correct: "56", difficulty: "Easy" },
        { text: "What is the sum of angles in a triangle?", options: ["180°", "90°", "360°", "270°"], correct: "180°", difficulty: "Easy" }
    ],
    English: [
        { text: "Who wrote 'Romeo and Juliet'?", options: ["William Shakespeare", "Charles Dickens", "Mark Twain", "Jane Austen"], correct: "William Shakespeare", difficulty: "Easy" },
        { text: "What is a synonym for 'Happy'?", options: ["Joyful", "Sad", "Angry", "Tired"], correct: "Joyful", difficulty: "Easy" },
        { text: "Which of these is a noun?", options: ["Apple", "Run", "Beautifully", "Slowly"], correct: "Apple", difficulty: "Easy" },
        { text: "Which of these is a verb?", options: ["Jump", "Blue", "Quickly", "Bird"], correct: "Jump", difficulty: "Easy" },
        { text: "Identify the antonym of 'Victory'.", options: ["Defeat", "Success", "Triumph", "Win"], correct: "Defeat", difficulty: "Medium" },
        { text: "What is the superlatively form of 'Good'?", options: ["Best", "Better", "Goodest", "Greatest"], correct: "Best", difficulty: "Easy" },
        { text: "Who wrote the novel '1984'?", options: ["George Orwell", "Aldous Huxley", "Ray Bradbury", "H.G. Wells"], correct: "George Orwell", difficulty: "Hard" }
    ],
    Engineering: [
        { text: "What is the unit of Electrical Resistance?", options: ["Ohm", "Volt", "Ampere", "Watt"], correct: "Ohm", difficulty: "Easy" },
        { text: "Which law states V = IR?", options: ["Ohm's Law", "Newton's Law", "Faraday's Law", "Kirchhoff's Law"], correct: "Ohm's Law", difficulty: "Easy" },
        { text: "What is the primary component of an IC?", options: ["Silicon", "Copper", "Gold", "Silver"], correct: "Silicon", difficulty: "Medium" }
    ]
};

app.post('/api/teacher/generate-questions', (req, res) => {
    const { keyword, sections, difficulty } = req.body;
    let finalQuestions = [];
    
    // Find closest subject match or fallback to Science
    const subject = keyword || 'Science';
    const originalPool = QUESTION_BANK[subject] || QUESTION_BANK['Science'];
    
    if (sections && sections.length > 0) {
        sections.forEach(sec => {
            const count = parseInt(sec.count) || 1;
            const diffLabel = difficulty || 'Medium';

            let sectionPool = [...originalPool];
            
            // Randomize the pool
            for (let i = sectionPool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [sectionPool[i], sectionPool[j]] = [sectionPool[j], sectionPool[i]];
            }

            for(let i=0; i<count; i++) {
                if (i >= sectionPool.length) {
                    // Improved fallback variance
                    const fallbacks = [
                        { opt: ["Standard Hypothesis", "Controlled Variable", "Independent Observation", "Empirical Proof"], ans: "Standard Hypothesis" },
                        { opt: ["Qualitative Analysis", "Quantitative Measure", "Statistical Variance", "Null Model"], ans: "Qualitative Analysis" },
                        { opt: ["Core Principle", "Secondary Effect", "External Constraint", "Linear Progression"], ans: "Core Principle" }
                    ];
                    const selected = fallbacks[i % fallbacks.length];
                    
                    finalQuestions.push({
                        section_title: sec.title || 'General',
                        text: `[${diffLabel}] Analyze the application of ${subject} based on: ${sec.title} case study ${i+1}?`,
                        options: selected.opt,
                        correct_answer: selected.ans
                    });
                    continue;
                }

                const base = sectionPool[i];
                finalQuestions.push({
                    section_title: sec.title || 'General',
                    text: `(${sec.title}) ${base.text}`,
                    options: base.options,
                    correct_answer: base.correct
                });
            }
        });
    } else {
        const base = originalPool[0];
        finalQuestions = [{ 
            section_title: 'General', 
            text: `[${difficulty || 'Medium'}] ${base.text}`, 
            options: base.options, 
            correct_answer: base.correct 
        }];
    }
    
    res.json(finalQuestions);
});

// VIOLATION TRACKING (Structured & Async)
app.post('/api/violation', (req, res) => {
    const { attemptId, type, severity, source } = req.body;
    
    // Log violation silently to database
    db.run(
        "INSERT INTO violations (attempt_id, type, severity, source) VALUES (?, ?, ?, ?)",
        [attemptId, type, severity, source],
        function(err) {
            if (err) {
                console.error("Violation Logging Error:", err.message);
                return res.status(500).json({ error: 'Internal Error' });
            }
            
            // Background update of attempt stats
            db.run("UPDATE attempts SET warnings = warnings + 1, score = score + ? WHERE id = ?", [severity, attemptId]);
            
            // Logic for escalation (Silent unless High)
            let action = 'log';
            if (severity >= 5) action = 'warn';
            
            res.json({ message: 'Violation recorded', action });
        }
    );
});

// STUDENT ENDPOINTS
app.get('/api/student/:id/exams', (req, res) => {
    const studentId = req.params.id;
    const query = `
        SELECT a.id as attempt_id, a.status, a.score, a.warnings, e.id as exam_id, e.title, e.subject, e.duration, 
               e.teacher_id, u.name as teacher_name
        FROM attempts a 
        JOIN exams e ON a.exam_id = e.id 
        JOIN users u ON e.teacher_id = u.id
        WHERE a.student_id = ?
    `;
    db.all(query, [studentId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/student/exam/:attemptId/start', (req, res) => {
    const { attemptId } = req.params;
    db.run("UPDATE attempts SET status = 'In Progress' WHERE id = ? AND status = 'Pending'", [attemptId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Exam started' });
    });
});

app.post('/api/student/verify-identity', (req, res) => {
    const { attemptId, snapshot } = req.body;
    db.run("UPDATE attempts SET identity_snapshot = ? WHERE id = ?", [snapshot, attemptId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Identity verified physically' });
    });
});

app.get('/api/student/exam/:examId/questions', (req, res) => {
    const { examId } = req.params;
    db.all("SELECT id, text, options, section_title FROM questions WHERE exam_id = ?", [examId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const formatted = rows.map(r => ({ ...r, options: JSON.parse(r.options) }));
        res.json(formatted);
    });
});

app.post('/api/student/exam/:attemptId/submit', (req, res) => {
    const { attemptId } = req.params;
    const { autoSubmit } = req.body;
    const status = autoSubmit ? 'Terminated' : 'Completed';
    db.run("UPDATE attempts SET status = ? WHERE id = ?", [status, attemptId], function(err) {
         if (err) return res.status(500).json({ error: err.message });
         res.json({ message: 'Exam submitted', status });
    });
});

app.get('/api/student/:id/summary', (req, res) => {
    const studentId = req.params.id;
    const query = `
        SELECT u.name, u.email, u.class, u.section,
        SUM(a.score) as totalScore, SUM(a.warnings) as totalWarnings, COUNT(a.id) as totalAttempts,
        SUM(a.academic_score) as totalMarks, SUM(a.max_academic_score) as maxMarks
        FROM users u
        LEFT JOIN attempts a ON u.id = a.student_id
        WHERE u.id = ?
        GROUP BY u.id
    `;
    db.get(query, [studentId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all("SELECT a.id, e.title, a.academic_score, a.max_academic_score, a.score as malpractice_score FROM attempts a JOIN exams e ON a.exam_id = e.id WHERE a.student_id = ?", [studentId], (err2, attempts) => {
             if (err2) return res.status(500).json({ error: err2.message });
             res.json({ stats: row, attempts });
        });
    });
});

app.get('/api/student/:id/comments', (req, res) => {
    const studentId = req.params.id;
    const query = `
        SELECT c.comment, c.timestamp, u.name as teacher_name
        FROM comments c
        JOIN users u ON c.teacher_id = u.id
        WHERE c.student_id = ?
        ORDER BY c.timestamp DESC
    `;
    db.all(query, [studentId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/teacher/comment', (req, res) => {
    const { teacher_id, student_id, comment } = req.body;
    db.run("INSERT INTO comments (teacher_id, student_id, comment) VALUES (?, ?, ?)", [teacher_id, student_id, comment], function(err) {
        if (err) return res.status(500).json({ error: err.message });
         res.json({ message: 'Comment saved' });
    });
});

// TEACHER ENDPOINTS: Grouped Analytics Roster (Fixed Duplicate Removal)
app.get('/api/teacher/:id/class-roster', (req, res) => {
    const teacherId = req.params.id;
    const query = `
        SELECT 
            u.id as student_id, u.name, u.class, u.roll_number,
            COUNT(CASE WHEN a.status != 'Pending' AND a.status IS NOT NULL THEN 1 END) as attended_count,
            COUNT(CASE WHEN a.status = 'Pending' THEN 1 END) as remaining_count
        FROM users u
        JOIN attempts a ON u.id = a.student_id
        JOIN exams e ON a.exam_id = e.id
        WHERE e.teacher_id = ?
        GROUP BY u.id
        ORDER BY u.class ASC, u.name ASC
    `;
    db.all(query, [teacherId], (err, rows) => {
         if (err) return res.status(500).json({ error: err.message });
         res.json(rows);
    });
});

// MESSAGING SYSTEM (Safe Portal Communication)
app.get('/api/messages/:id', (req, res) => {
    const userId = req.params.id;
    
    // Safety check for user ID to prevent server communication failure
    if (!userId || userId === 'undefined') {
        return res.json([]);
    }

    const query = `
        SELECT m.*, s.name as sender_name, r.name as receiver_name 
        FROM messages m
        JOIN users s ON m.sender_id = s.id
        JOIN users r ON m.receiver_id = r.id
        WHERE m.sender_id = ? OR m.receiver_id = ?
        ORDER BY m.timestamp ASC
    `;
    db.all(query, [userId, userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/messages', (req, res) => {
    const { sender_id, receiver_id, content } = req.body;
    db.run("INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)", 
    [sender_id, receiver_id, content], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Message sent', id: this.lastID });
    });
});

app.get('/api/teacher/:id/exams', (req, res) => {
    const teacherId = req.params.id;
    db.all("SELECT * FROM exams WHERE teacher_id = ?", [teacherId], (err, rows) => {
         if (err) return res.status(500).json({ error: err.message });
         res.json(rows);
    });
});

app.post('/api/teacher/exam', (req, res) => {
    let { title, subject, difficulty, type, teacherId, duration, targetClass, questions } = req.body;
    
    // Institutional Protocol: Convert duration from Minutes to Seconds
    const finalDuration = parseInt(duration) * 60;

    db.run(`INSERT INTO exams (title, subject, difficulty, type, teacher_id, duration, target_class) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
    [title, subject, difficulty, type, teacherId, finalDuration, targetClass], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const examId = this.lastID;
        
        const stmt = db.prepare("INSERT INTO questions (exam_id, section_title, text, options, correct_answer) VALUES (?, ?, ?, ?, ?)");
        questions.forEach(q => {
            stmt.run(examId, q.section_title || 'General', q.text, JSON.stringify(q.options), q.correct_answer);
        });
        stmt.finalize();

        const maxScore = questions.length;

        // Automatically assign to the target section
        db.run(`INSERT INTO attempts (student_id, exam_id, max_academic_score) 
                SELECT id, ?, ? FROM users WHERE role = 'student' AND class = ?`, 
                [examId, maxScore, targetClass], function(assignErr) {
             if (assignErr) console.error("Sectional assignment error:", assignErr);
        });

        res.json({ message: 'Exam created successfully for target section: ' + targetClass });
    });
});

// TEACHER AUDIT ENDPOINT
app.get('/api/teacher/student-audit/:studentId/:teacherId', (req, res) => {
    const { studentId, teacherId } = req.params;
    const query = `
        SELECT a.id as attempt_id, e.title, e.subject, a.score, a.warnings, a.status, a.identity_snapshot
        FROM attempts a
        JOIN exams e ON a.exam_id = e.id
        WHERE a.student_id = ? AND e.teacher_id = ?
    `;
    db.all(query, [studentId, teacherId], (err, attempts) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.get(`SELECT * FROM users WHERE id = ?`, [studentId], (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            
            // For a single student context, fetch violations for their attempts using IN clause
            const attemptIds = attempts.map(a => a.attempt_id);
            if (attemptIds.length === 0) {
                 return res.json({ student: user, attempts, violations: [] });
            }
            const placeHolders = attemptIds.map(() => '?').join(',');
            const vQuery = `SELECT * FROM violations WHERE attempt_id IN (${placeHolders}) ORDER BY timestamp DESC`;
            db.all(vQuery, attemptIds, (err, violations) => {
                 if (err) return res.status(500).json({ error: err.message });
                 res.json({ student: user, attempts, violations });
            });
        });
    });
});

// ADMIN ENDPOINTS
app.get('/api/admin/analytics', (req, res) => {
    const query = `
        SELECT a.id, a.status, a.score, a.warnings, u.email, u.name, u.class, e.subject, e.title, u.id as student_id
        FROM attempts a 
        JOIN users u ON a.student_id = u.id 
        JOIN exams e ON a.exam_id = e.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/admin/violations/:attemptId', (req, res) => {
    const { attemptId } = req.params;
    db.all("SELECT * FROM violations WHERE attempt_id = ? ORDER BY timestamp DESC", [attemptId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// CATCH-ALL JSON 404
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found or method not allowed' });
});

app.delete('/api/users/:id', (req, res) => {
    const userId = req.params.id;
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        db.run("DELETE FROM violations WHERE attempt_id IN (SELECT id FROM attempts WHERE student_id = ?)", [userId]);
        db.run("DELETE FROM attempts WHERE student_id = ?", [userId]);
        db.run("DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?", [userId, userId]);
        db.run("DELETE FROM users WHERE id = ?", [userId], function(err) {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
            }
            db.run("COMMIT");
            res.json({ success: true, message: "User and associated data purged." });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Institutional Server running on http://localhost:${PORT}`);
});
