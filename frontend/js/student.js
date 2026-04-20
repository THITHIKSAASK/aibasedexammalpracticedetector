let currentUser;

window.onload = async () => {
    currentUser = checkAuth(['student']);
    if (currentUser) {
        // Redesigned Sidebar Profile
        document.getElementById('sidebar-user-name').innerText = currentUser.name || 'Student';
        if (currentUser.roll_number) {
            document.getElementById('sidebar-user-dept').innerText = `${currentUser.roll_number} | ${(currentUser.class || 'INSTITUTIONAL').toUpperCase()}`;
        } else {
            document.getElementById('sidebar-user-dept').innerText = (currentUser.class || 'Institutional').toUpperCase();
        }
        document.getElementById('sidebar-user-initial').innerText = (currentUser.name || 'S').charAt(0).toUpperCase();
        
        document.getElementById('student-name-welcome').innerText = currentUser.name || 'Student';
        
        await fetchAssignedExams();
        
        // Notification poller
        checkUnreadMessages();
        setInterval(checkUnreadMessages, 15000);
    }
}

async function checkUnreadMessages() {
    if (!currentUser) return;
    try {
        const res = await fetch(`/api/messages/unread/${currentUser.id}`);
        const { count } = await res.json();
        const badge = document.getElementById('unread-badge');
        if (badge) {
            badge.style.display = count > 0 ? 'block' : 'none';
            if (count > 0) badge.innerText = count > 9 ? '9+' : count;
        }
    } catch (err) {}
}

function showDashboardHome() {
    showTab('dashboard-tab', 'home-nav');
}

function showAssignedExams() {
    showTab('exam-list-view', 'home-nav'); // Nav remains active at home
    renderAllExams();
}

function showTab(tabId, navId) {
    const tabs = ['dashboard-tab', 'exam-list-view', 'comm-tab'];
    tabs.forEach(t => {
        const el = document.getElementById(t);
        if (el) el.style.display = t === tabId ? 'block' : 'none';
    });

    const navs = ['home-nav', 'comm-nav'];
    navs.forEach(n => {
        const el = document.getElementById(n);
        if (el) el.classList.toggle('active', n === navId);
    });

    if (tabId === 'comm-tab') {
        window.fetchStudentMessages();
        document.getElementById('unread-badge').style.display = 'none';
    }
}

// Removed legacy subject explorers for simplified institutional dashboard

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

window.startExam = async function(attemptId, examId) {
    try {
        if (window.BIT && window.BIT.confirm) {
            window.BIT.confirm("Institutional Protocol", "Are you ready to begin? Strict monitoring will activate immediately.", (confirmed) => {
                if (!confirmed) return;
                window.beginSession(attemptId, examId);
            });
        } else {
            console.warn("BIT.confirm not found, falling back to window.confirm");
            const confirmed = window.confirm("Are you ready to begin? Strict monitoring will activate immediately.");
            if (confirmed) window.beginSession(attemptId, examId);
        }
    } catch (e) {
        console.error("BIT.confirm UI Error: ", e);
        alert("UI Error: " + e.message);
    }
}

window.beginSession = async function(attemptId, examId) {
    try {
        console.log(`Attempting to start exam. AttemptID: ${attemptId}, ExamID: ${examId}`);
        const res = await fetch(`/api/student/exam/${attemptId}/start`, { method: 'POST' });
        if(res.ok) {
            console.log("Exam started on server. Syncing local state...");
            const examInfo = allExams.find(e => e.attempt_id == attemptId); // abstract equality
            const duration = examInfo ? examInfo.duration : 120;
            const subject = examInfo ? examInfo.subject : '';
            localStorage.setItem('activeExam', JSON.stringify({ attemptId, examId, duration, subject }));
            window.location.href = 'exam.html';
        } else {
            const data = await res.json().catch(() => ({}));
            let msg = data.error || "Could not start exam. Please contact admin.";
            if (window.BIT) window.BIT.alert("Access Denied", msg);
            else alert("Access Denied: " + msg);
        }
    } catch (err) { 
        if (window.BIT) window.BIT.alert("System Error", "Communication failure."); 
        else alert("System Error: Communication failure.");
    }
}

window.resumeExam = function(attemptId, examId) {
    const examInfo = allExams.find(e => e.attempt_id == attemptId);
    const duration = examInfo ? examInfo.duration : 120;
    const subject = examInfo ? examInfo.subject : '';
    localStorage.setItem('activeExam', JSON.stringify({ attemptId, examId, duration, subject }));
    window.location.href = 'exam.html';
}
let activeTeacherId = null;

window.fetchStudentMessages = async function() {
    try {
        const response = await fetch(`/api/messages/${currentUser.id}?role=${currentUser.role}`);
        const messages = await response.json();
        
        const threadsContainer = document.getElementById('teacher-threads');
        const chatBody = document.getElementById('student-chat-body');
        
        // Combine teachers from messages AND assigned exams
        const teacherMap = new Map(); // id -> name
        
        // From existing messages
        messages.forEach(m => {
            if (m.sender_id && m.sender_id !== currentUser.id) teacherMap.set(m.sender_id, m.sender_name);
            if (m.receiver_id && m.receiver_id !== currentUser.id) teacherMap.set(m.receiver_id, m.receiver_name);
        });

        // From assigned exams
        if (allExams && allExams.length > 0) {
            allExams.forEach(e => {
                if (e.teacher_id && e.teacher_name) {
                    teacherMap.set(e.teacher_id, e.teacher_name);
                }
            });
        }
        
        // From all registered teachers globally
        try {
            const tr = await fetch('/api/teachers');
            if (tr.ok) {
                const globalTeachers = await tr.json();
                globalTeachers.forEach(t => {
                    if (!teacherMap.has(t.id)) teacherMap.set(t.id, t.name);
                });
            }
        } catch(e) {
            console.warn("Failed to load global teachers:", e);
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
        (m.sender_id === tid && m.receiver_id === currentUser.id) ||
        (m.sender_id === tid && m.broadcast_role)
    );

    thread.forEach(m => {
        const isMe = m.sender_id === currentUser.id;
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble animate-in';
        bubble.style.cssText = `
            max-width: 85%;
            padding: 8px 12px;
            border-radius: 10px;
            align-self: ${isMe ? 'flex-end' : 'flex-start'};
            background: ${isMe ? 'var(--primary)' : 'var(--border-color)'};
            color: ${isMe ? '#fff' : 'var(--text-color)'};
            position: relative;
        `;
        
        if (m.broadcast_role) {
            bubble.style.background = 'linear-gradient(135deg, #48246e, #6a11cb)';
            bubble.style.color = '#fff';
            bubble.style.alignSelf = 'center';
            bubble.style.border = '2px solid var(--accent)';
            bubble.innerHTML = `
                <div style="font-size:10px; font-weight:bold; margin-bottom:5px; opacity:0.8; text-transform:uppercase;">Institutional Announcement</div>
                ${m.content}
            `;
        } else if (m.message_type === 'image') {
            bubble.innerHTML = `
                <div style="position:relative;">
                    <img src="${m.file_url}" style="max-width:100%; border-radius:8px; cursor:pointer;" onclick="window.open('${m.file_url}')">
                    <a href="${m.file_url}" download class="no-print" style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.5); color:#fff; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; text-decoration:none; font-size:12px;">💾</a>
                </div>
            `;
            if (m.content) bubble.innerHTML += `<p style="margin-top:5px;">${m.content}</p>`;
        } else if (m.message_type === 'pdf') {
            bubble.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:20px; cursor:pointer;" onclick="window.open('${m.file_url}')">📄</span>
                    <div style="text-align:left; flex:1;">
                        <div style="font-weight:700; font-size:11px;">Institutional Doc</div>
                        <div style="font-size:9px; opacity:0.8;">Secure PDF</div>
                    </div>
                    <a href="${m.file_url}" download class="no-print" style="background:rgba(0,0,0,0.1); color:inherit; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; text-decoration:none; font-size:12px;">💾</a>
                </div>
            `;
            if (m.content) bubble.innerHTML += `<p style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.1); padding-top:5px;">${m.content}</p>`;
        } else {
            bubble.innerText = m.content;
        }
        chatBody.appendChild(bubble);
    });
    chatBody.scrollTop = chatBody.scrollHeight;
}

window.sendStudentReply = async function() {
    const input = document.getElementById('student-chat-input');
    const content = input.value.trim();
    if (!content || !activeTeacherId) {
        window.BIT.toast("Please select a faculty thread first", "info");
        return;
    }

    try {
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender_id: currentUser.id,
                receiver_id: activeTeacherId,
                content: content,
                message_type: 'text'
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

async function handleChatFileUpload() {
    const fileEl = document.getElementById('chat-file-input');
    if (!fileEl.files || !fileEl.files[0] || !activeTeacherId) return;
    
    const file = fileEl.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
        const uploadRes = await fetch('/api/chat/upload', {
            method: 'POST',
            body: formData
        });
        const uploadData = await uploadRes.json();
        
        if (uploadData.fileUrl) {
            await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender_id: currentUser.id,
                    receiver_id: activeTeacherId,
                    content: `Sent a ${uploadData.type}`,
                    message_type: uploadData.type,
                    file_url: uploadData.fileUrl
                })
            });
            window.fetchStudentMessages();
            fileEl.value = '';
        }
    } catch (err) {
        console.error("Student chat upload failed", err);
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