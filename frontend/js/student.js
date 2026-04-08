let currentUser;

window.onload = async () => {
    currentUser = checkAuth(['student']);
    if (currentUser) {
        document.body.classList.remove('has-subject-theme');
        await fetchAssignedExams();
        updateSubjectBadges();
        showDepartmentExplorer();
    }
}

function showDepartmentExplorer() {
    document.getElementById('subject-selection-view').style.display = 'block';
    document.getElementById('exam-list-view').style.display = 'none';
}

function selectSubject(subject) {
    document.getElementById('subject-selection-view').style.display = 'none';
    document.getElementById('exam-list-view').style.display = 'block';
    renderAllExams(subject);
}

function backToSubjects() {
    showDepartmentExplorer();
}

function showAssignedOnly() {
    document.getElementById('subject-selection-view').style.display = 'none';
    document.getElementById('exam-list-view').style.display = 'block';
    renderAllExams(); // No filter = show all assigned
}

// Subject-selection functions removed per institutional protocol update.

let allExams = [];

async function fetchAssignedExams() {
    try {
        const response = await fetch(`/api/student/${currentUser.id}/exams`);
        allExams = await response.json();
    } catch (err) {
        console.error("Error fetching exams", err);
    }
}

function renderAllExams(subjectFilter = null) {
    const grid = document.getElementById('student-exams-grid');
    grid.innerHTML = '';
    
    const title = subjectFilter ? `${subjectFilter} Department` : `Assigned Assessments (${currentUser.class})`;
    document.getElementById('selected-subject-title').innerText = title;
    
    const filtered = subjectFilter 
        ? allExams.filter(e => e.subject === subjectFilter)
        : allExams;

    if (filtered.length === 0) {
        grid.innerHTML = `<p>No exams found in this category at this time.</p>`;
        return;
    }

    filtered.forEach(exam => {
        const card = document.createElement('div');
        card.className = 'card student-card';
        
        let actionBtn = '';
        if (exam.status === 'Pending') {
            actionBtn = `<button onclick="startExam(${exam.attempt_id}, ${exam.exam_id})" style="margin-top:10px;">Start Exam</button>`;
        } else if (exam.status === 'Terminated') {
             actionBtn = `<button disabled style="background:#ccc; margin-top:10px;">Terminated (Violation)</button>`;
        } else if (exam.status === 'Completed') {
             actionBtn = `<button disabled style="background:#ccc; margin-top:10px;">Completed \nScore: ${exam.score}</button>`;
        } else if (exam.status === 'In Progress') {
             actionBtn = `<button onclick="resumeExam(${exam.attempt_id}, ${exam.exam_id})" style="margin-top:10px; background:var(--warning)">Resume Session</button>`;
        }

        card.innerHTML = `
            <h3>${exam.title}</h3>
            <p>Institutional Protocol: <strong>${exam.subject}</strong></p>
            <p>Time Allocated: ${Math.floor(exam.duration / 60)} mins</p>
            <p>Session Status: <span style="color:var(--primary); font-weight:600;">${exam.status}</span></p>
            ${actionBtn}
        `;
        grid.appendChild(card);
    });
}

async function startExam(attemptId, examId) {
    if(!confirm("Are you ready to begin? Strict monitoring will activate immediately.")) return;
    try {
        const res = await fetch(`/api/student/exam/${attemptId}/start`, { method: 'POST' });
        if(res.ok) {
            localStorage.setItem('activeExam', JSON.stringify({ attemptId, examId }));
            window.location.href = 'exam.html';
        } else {
            alert("Could not start exam. Please contact admin.");
        }
    } catch (err) { alert("System error."); }
}

function resumeExam(attemptId, examId) {
    localStorage.setItem('activeExam', JSON.stringify({ attemptId, examId }));
    window.location.href = 'exam.html';
}
let activeTeacherId = null;

window.fetchStudentMessages = async function() {
    try {
        const response = await fetch(`/api/messages/${currentUser.id}`);
        const messages = await response.json();
        
        const threadsContainer = document.getElementById('teacher-threads');
        const chatBody = document.getElementById('student-chat-body');
        
        // Combine teachers from messages AND assigned exams
        const teacherMap = new Map(); // id -> name
        
        // From existing messages
        messages.forEach(m => {
            if (m.sender_id !== currentUser.id) teacherMap.set(m.sender_id, m.sender_name);
            if (m.receiver_id !== currentUser.id) teacherMap.set(m.receiver_id, m.receiver_name);
        });

        // From assigned exams
        if (window.allExams) {
            window.allExams.forEach(e => {
                if (e.teacher_id) teacherMap.set(e.teacher_id, e.teacher_name);
            });
        }

        threadsContainer.innerHTML = '';
        teacherMap.forEach((tName, tid) => {
            const btn = document.createElement('button');
            btn.innerText = tName;
            btn.className = 'thread-btn';
            btn.style.cssText = `padding:4px 10px; font-size:11px; background:${activeTeacherId === tid ? 'var(--primary)' : 'var(--secondary)'}; border:1px solid var(--border-color); cursor:pointer; border-radius:4px; color:${activeTeacherId === tid ? '#fff' : 'inherit'};`;
            btn.onclick = () => selectTeacherThread(tid, messages);
            threadsContainer.appendChild(btn);
        });

        if (activeTeacherId) {
            renderThread(activeTeacherId, messages);
        } else if (teacherMap.size > 0) {
            const firstId = teacherMap.keys().next().value;
            selectTeacherThread(firstId, messages);
        }
    } catch (err) {
        console.error("Student message fetch failed", err);
    }
}

function selectTeacherThread(tid, allMessages) {
    activeTeacherId = tid;
    renderThread(tid, allMessages);
}

function renderThread(tid, allMessages) {
    const chatBody = document.getElementById('student-chat-body');
    chatBody.innerHTML = '';
    
    const thread = allMessages.filter(m => 
        (m.sender_id === currentUser.id && m.receiver_id === tid) ||
        (m.sender_id === tid && m.receiver_id === currentUser.id)
    );

    thread.forEach(m => {
        const isMe = m.sender_id === currentUser.id;
        const bubble = document.createElement('div');
        bubble.style.cssText = `
            max-width: 85%;
            padding: 8px 12px;
            border-radius: 10px;
            align-self: ${isMe ? 'flex-end' : 'flex-start'};
            background: ${isMe ? 'var(--primary)' : 'var(--border-color)'};
            color: ${isMe ? '#fff' : 'var(--text-color)'};
        `;
        bubble.innerText = m.content;
        chatBody.appendChild(bubble);
    });
    chatBody.scrollTop = chatBody.scrollHeight;
}

window.sendStudentReply = async function() {
    const input = document.getElementById('student-chat-input');
    const content = input.value.trim();
    if (!content || !activeTeacherId) {
        alert("Please select a faculty thread to reply to.");
        return;
    }

    try {
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender_id: currentUser.id,
                receiver_id: activeTeacherId,
                content: content
            })
        });

        if (response.ok) {
            input.value = '';
            window.fetchStudentMessages();
        }
    } catch (err) {
        console.error("Failed to send student message", err);
    }
}
function updateSubjectBadges() {
    const subjects = ['Science', 'History', 'English', 'Math', 'Geography', 'Engineering'];
    subjects.forEach(subject => {
        const card = document.getElementById(`subject-card-${subject}`);
        if (!card) return;

        // Count pending or in-progress exams
        const count = allExams.filter(e => e.subject === subject && (e.status === 'Pending' || e.status === 'In Progress')).length;
        
        let badge = card.querySelector('.badge-notify');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'badge-notify';
                card.appendChild(badge);
            }
            badge.innerHTML = `<span style="font-size: 16px; margin-right: 4px;">🔔</span> <strong>${count}</strong>`;
            badge.style.display = 'flex';
            badge.style.alignItems = 'center';
            badge.style.justifyContent = 'center';
            badge.style.padding = '6px 12px';
            badge.style.background = 'var(--danger)';
            badge.style.color = '#fff';
            badge.style.borderRadius = '20px';
            badge.style.boxShadow = '0 4px 10px rgba(225, 29, 72, 0.4)';
            badge.style.position = 'absolute';
            badge.style.top = '-10px';
            badge.style.right = '-10px';
            badge.style.zIndex = '10';
        } else if (badge) {
            badge.style.display = 'none';
        }
    });
}

