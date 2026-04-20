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

const chatStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '../frontend/uploads/chat');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const uploadChat = multer({ storage: chatStorage });

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for Base64 image snapshots

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

    // Auto-generate Roll Number (e.g. IT01 or FAC01)
    let prefix = '';
    let countQueryField = '';
    let countQueryVal = '';
    
    if (finalRole === 'teacher') {
        prefix = 'FAC';
        countQueryField = 'role';
        countQueryVal = 'teacher';
    } else {
        prefix = (cls || 'ST').substring(0, 2).toUpperCase();
        countQueryField = 'class';
        countQueryVal = cls;
    }
    
    db.get(`SELECT COUNT(*) as count FROM users WHERE ${countQueryField} = ?`, [countQueryVal], (err, row) => {
        const generatedRoll = `${prefix}${(row ? row.count + 1 : 1).toString().padStart(2, '0')}`;
        
        let finalGroupName = name;
        if (finalRole === 'teacher' && !name.toLowerCase().startsWith('dr.')) {
            finalGroupName = `Dr. ${name}`;
        }

        const query = `INSERT INTO users (email, username, role, name, gender, class, section, subject, designation, roll_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        db.run(query, [email, username, finalRole, finalGroupName, req.body.gender || 'Institutional', cls, section, subject, designation, generatedRoll], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                     return res.status(400).json({ error: 'Email already active in system.' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ 
                message: 'Registration successful', 
                user: { id: this.lastID, role: finalRole, username, name: finalGroupName, email, gender: req.body.gender, roll_number: generatedRoll } 
            });
        });
    });
});

app.get('/api/registered-classes', (req, res) => {
    db.all("SELECT DISTINCT class FROM users WHERE role = 'student' AND class IS NOT NULL ORDER BY class ASC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows.map(r => r.class));
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
        { text: "What is the primary thermodynamic driving force for the spontaneous folding of a globular protein in an aqueous environment?", options: ["The increase in water entropy due to the hydrophobic effect", "The formation of hydrogen bonds between peptide backbones", "The reduction in electrostatic repulsion between charged side chains", "The covalent stabilization provided by disulfide bridge formation"], correct: "The increase in water entropy due to the hydrophobic effect", difficulty: "Hard" },
        { text: "In the context of planetary atmospheres, which phenomenon explains why high-altitude gas temperature increases in the thermosphere?", options: ["Absorption of high-energy solar radiation by oxygen and nitrogen", "Convective heat transfer from the planetary surface", "Compression of gas due to increasing gravitational potential", "Accumulation of greenhouse gases at the upper boundaries"], correct: "Absorption of high-energy solar radiation by oxygen and nitrogen", difficulty: "Medium" },
        { text: "Which principle describes why the speed of a fluid increases when it flows through a narrower section of a pipe?", options: ["Bernoulli's Principle", "Archimedes' Principle", "Pascal's Law", "Heisenberg Uncertainty Principle"], correct: "Bernoulli's Principle", difficulty: "Medium" }
    ],
    Geography: [
        { text: "What is the primary cause of the 'Rain Shadow' effect observed on the leeward side of mountain ranges?", options: ["Adiabatic cooling and moisture loss on the windward side", "High-pressure systems permanently stalled over the leeward side", "Decreased albedo on the windward side leading to evaporation", "Correlative movement of the Intertropical Convergence Zone"], correct: "Adiabatic cooling and moisture loss on the windward side", difficulty: "Hard" },
        { text: "Which of the following describes a 'Karst' topography?", options: ["Landscapes formed from the dissolution of soluble rocks like limestone", "Glacial deposits forming elongated hills known as drumlins", "Arid regions characterized by desert pavement and ventifacts", "Volcanic regions showing extensive basaltic sheet flows"], correct: "Landscapes formed from the dissolution of soluble rocks like limestone", difficulty: "Medium" }
    ],
    History: [
        { text: "The Treaty of Westphalia (1648) is considered a turning point in international relations primarily because it...", options: ["Established the concept of state sovereignty and non-interference", "Concluded the Napoleonic Wars and redrew the map of Europe", "Founded the League of Nations to prevent future global conflicts", "Unified the German states under a single imperial crown"], correct: "Established the concept of state sovereignty and non-interference", difficulty: "Hard" },
        { text: "What was the significance of the 1955 Bandung Conference?", options: ["It marked the emergence of the Non-Aligned Movement", "It served as the formal end of the Korean War", "It established the European Coal and Steel Community", "It was the first summit of the North Atlantic Treaty Organization"], correct: "It marked the emergence of the Non-Aligned Movement", difficulty: "Hard" }
    ],
    Math: [
        { text: "In a Fourier Transform, what does the transform directly convert?", options: ["A time-domain signal into its frequency components", "A discrete sequence into a continuous derivative", "A linear set of equations into a matrix determinant", "A spatial coordinate system into a polar representation"], correct: "A time-domain signal into its frequency components", difficulty: "Medium" },
        { text: "What is the value of the limit of (sin x / x) as x approaches zero?", options: ["1", "0", "Infinity", "e"], correct: "1", difficulty: "Easy" },
        { text: "Which theorem states that for a continuous function on a closed interval, there exists a point where the derivative equals the average rate of change?", options: ["Mean Value Theorem", "Intermediate Value Theorem", "Fundamental Theorem of Calculus", "Taylor's Theorem"], correct: "Mean Value Theorem", difficulty: "Medium" }
    ],
    English: [
        { text: "In literary theory, the term 'Juxtaposition' refers to...", options: ["Placing two contrasting elements side by side to highlight differences", "The use of excessive detail to describe a setting", "An indirect reference to an external person, place, or event", "The attribution of human characteristics to inanimate objects"], correct: "Placing two contrasting elements side by side to highlight differences", difficulty: "Medium" },
        { text: "Which of the following best defines an 'Epistolary' novel?", options: ["A novel written as a series of documents, such as letters or diary entries", "A satirical work aiming to criticize societal flaws", "A story focusing on the internal psychological growth of a protagonist", "A narrative that employs multiple non-linear timelines"], correct: "A novel written as a series of documents, such as letters or diary entries", difficulty: "Medium" }
    ],
    Engineering: [
        { text: "In Digital Signal Processing, what is the Nyquist frequency?", options: ["Half the sampling rate of a discrete signal processing system", "The resonance frequency of a piezoelectric crystal", "The maximum bandwidth of a copper-based transmission medium", "The switching frequency of a MOSFET in a power converter"], correct: "Half the sampling rate of a discrete signal processing system", difficulty: "Hard" },
        { text: "What is the primary advantage of a 'Three-Phase' power system over a single-phase system for industrial applications?", options: ["Constant power delivery and more efficient motor starting", "Simplified wiring requirements for long-distance transmission", "Lower voltage requirements for high-power devices", "Inherent protection against electromagnetic interference"], correct: "Constant power delivery and more efficient motor starting", difficulty: "Medium" }
    ],
    "Computer Science": [
        { text: "Which data structure uses the Last-In, First-Out (LIFO) principle?", options: ["Stack", "Queue", "Linked List", "Binary Tree"], correct: "Stack", difficulty: "Easy" },
        { text: "What is the time complexity of searching for an element in a sorted array using Binary Search?", options: ["O(log n)", "O(n)", "O(n log n)", "O(1)"], correct: "O(log n)", difficulty: "Medium" },
        { text: "In database management, what does the 'ACID' property 'Atomicity' ensure?", options: ["Transactions are all-or-nothing", "Data remains consistent after failure", "Multiple transactions can run concurrently", "Committed data is saved permanently"], correct: "Transactions are all-or-nothing", difficulty: "Hard" }
    ]
};

app.post('/api/teacher/generate-questions', (req, res) => {
    const { keyword, sections, difficulty, pdfContext } = req.body;
    let finalQuestions = [];
    
    // Find closest subject match or fallback to Science
    const subject = keyword || 'Science';
    const originalPool = QUESTION_BANK[subject] || QUESTION_BANK['Science'];
    
    // Track used question indices globally to avoid duplicates across sections
    let usedIndices = new Set();
    
    if (sections && sections.length > 0) {
        sections.forEach(sec => {
            const count = parseInt(sec.count) || 1;
            const sectionTitle = sec.title || 'General';

            // Build available pool (exclude already used questions)
            let availablePool = originalPool
                .map((q, idx) => ({ ...q, _idx: idx }))
                .filter(q => !usedIndices.has(q._idx));
            
            // Shuffle available pool
            for (let i = availablePool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [availablePool[i], availablePool[j]] = [availablePool[j], availablePool[i]];
            }

            for (let i = 0; i < count; i++) {
                if (i < availablePool.length) {
                    const base = availablePool[i];
                    usedIndices.add(base._idx);
                    finalQuestions.push({
                        section_title: sectionTitle,
                        text: base.text,
                        options: base.options,
                        correct_answer: base.correct
                    });
                } else {
                    // Generate contextual fallback based on section title and subject
                    const academicTemplates = [
                        { 
                            text: `Analyze the role of [TOPIC] in modern ${subject}. Which of the following best describes its primary institutional impact?`,
                            options: ["Strategic optimization of resources", "Standardization of protocol logic", "Enhanced predictive modeling", "Baseline structural integrity"],
                            correct_answer: "Strategic optimization of resources"
                        },
                        { 
                            text: `When evaluating "${sectionTitle}" within ${subject}, what is the critical threshold for system failure or logical inconsistency?`,
                            options: ["Point of diminishing returns", "The asymptotic limit of the function", "The Nyquist-Shannon sampling boundary", "The thermodynamic equilibrium point"],
                            correct_answer: "Point of diminishing returns"
                        },
                        { 
                            text: `Which methodology is universally recognized as the gold standard for validating "${sectionTitle}" in the field of ${subject}?`,
                            options: ["Double-blind peer-reviewed analysis", "Iterative heuristic modeling", "Recursive algorithmic validation", "Empirical observation and logging"],
                            correct_answer: "Double-blind peer-reviewed analysis"
                        },
                        {
                            text: `How does the integration of "${sectionTitle}" influence the scalability of ${subject}-based systems?`,
                            options: ["Exponentially increases complexity", "Reduces operational overhead", "Creates linear dependency chains", "Neutralizes external interference"],
                            correct_answer: "Reduces operational overhead"
                        }
                    ];
                    
                    const template = academicTemplates[i % academicTemplates.length];
                    let finalizedText = template.text.replace("[TOPIC]", sectionTitle);
                    
                    if (pdfContext && pdfContext.trim().length > 0) {
                        const snippet = pdfContext.trim().substring(0, 45).replace(/(\r\n|\n|\r)/gm, " ");
                        finalizedText += ` [AI Context Analysed: "${snippet}..."]`;
                    }
                    
                    finalQuestions.push({
                        section_title: sectionTitle,
                        text: finalizedText,
                        options: template.options,
                        correct_answer: template.correct_answer
                    });
                }
            }
        });
    } else {
        // No sections defined — pick 5 random questions from the pool
        let shuffled = [...originalPool];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const pick = shuffled.slice(0, Math.min(5, shuffled.length));
        finalQuestions = pick.map(q => ({
            section_title: 'General',
            text: q.text,
            options: q.options,
            correct_answer: q.correct
        }));
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

app.get('/api/teacher/:id/class-roster', (req, res) => {
    const teacherId = req.params.id;
    const query = `
        SELECT id as student_id, name, class, roll_number, email
        FROM users
        WHERE role = 'student'
        ORDER BY class ASC, name ASC
    `;
    db.all(query, [], (err, rows) => {
         if (err) return res.status(500).json({ error: err.message });
         res.json(rows);
    });
});

app.get('/api/teachers', (req, res) => {
    db.all("SELECT id, name FROM users WHERE role = 'teacher' ORDER BY name ASC", [], (err, rows) => {
         if (err) return res.status(500).json({ error: err.message });
         res.json(rows);
    });
});

// MESSAGING ENDPOINTS
app.get('/api/messages/:id', (req, res) => {
    const { id } = req.params;
    const role = req.query.role;
    
    // Mark as read when fetching
    db.run(`UPDATE messages SET is_read = 1 WHERE receiver_id = ?`, [id]);

    const query = `
        SELECT m.*, 
        u1.name as sender_name, u2.name as receiver_name
        FROM messages m
        JOIN users u1 ON m.sender_id = u1.id
        LEFT JOIN users u2 ON m.receiver_id = u2.id
        WHERE (m.sender_id = ? OR m.receiver_id = ?)
        OR (m.broadcast_role = ? OR m.broadcast_role = 'all')
        ORDER BY m.timestamp ASC
    `;
    db.all(query, [id, id, role], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/messages/unread/:id', (req, res) => {
    const { id } = req.params;
    db.get(`SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

app.post('/api/messages', (req, res) => {
    const { sender_id, receiver_id, content, message_type, file_url, broadcast_role } = req.body;
    db.run("INSERT INTO messages (sender_id, receiver_id, content, message_type, file_url, broadcast_role) VALUES (?, ?, ?, ?, ?, ?)", 
    [sender_id, receiver_id || null, content, message_type || 'text', file_url, broadcast_role || null], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Message sent', id: this.lastID });
    });
});

app.post('/api/chat/upload', uploadChat.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileUrl = `/uploads/chat/${req.file.filename}`;
    res.json({ fileUrl, type: req.file.mimetype.startsWith('image/') ? 'image' : 'pdf' });
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

        // Automatically assign to the target section - uses LIKE for flexibility (e.g. 'CSE-A' matches 'BTech CS-A')
        db.run(`INSERT INTO attempts (student_id, exam_id, max_academic_score) 
                SELECT id, ?, ? FROM users WHERE role = 'student' AND class LIKE ?`, 
                [examId, maxScore, '%' + targetClass + '%'], function(assignErr) {
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
        SELECT a.id, a.status, a.score, a.warnings, a.identity_snapshot, u.email, u.name, u.class, e.subject, e.title, u.id as student_id
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

// ADMIN: LIST USERS
app.get('/api/admin/users', (req, res) => {
    db.all("SELECT * FROM users WHERE role != 'admin' ORDER BY role DESC, class ASC, name ASC", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ADMIN: SYSTEM LOGS (COMMUNICATION PORTAL)
app.get('/api/admin/system-logs', (req, res) => {
    db.all("SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 100", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// DELETE USER WITH REMARKS
app.delete('/api/users/:id', (req, res) => {
    const userId = req.params.id;
    const { remark, actorId } = req.body;
    
    db.serialize(() => {
        // Fetch user data first for logging
        db.get("SELECT name, role FROM users WHERE id = ?", [userId], (err, user) => {
            if (err || !user) return res.status(404).json({ error: 'User not found' });

            db.run("BEGIN TRANSACTION");
            db.run("DELETE FROM violations WHERE attempt_id IN (SELECT id FROM attempts WHERE student_id = ?)", [userId]);
            db.run("DELETE FROM attempts WHERE student_id = ?", [userId]);
            db.run("DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?", [userId, userId]);
            db.run("DELETE FROM users WHERE id = ?", [userId], function(err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }
                
                // Add System Log
                const logDesc = `User [${user.name}] (${user.role}) was purged. Remark: ${remark || 'Administrative action'}`;
                db.run("INSERT INTO system_logs (event_type, target_id, target_name, actor_id, description) VALUES (?, ?, ?, ?, ?)",
                    ['User Purge', userId, user.name, actorId, logDesc]);

                db.run("COMMIT");
                res.json({ success: true, message: "User and associated data purged with remarks." });
            });
        });
    });
});

// CATCH-ALL JSON 404 (must be LAST)
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found or method not allowed' });
});

app.listen(PORT, () => {
    console.log(`Institutional Server running on http://localhost:${PORT}`);
});
