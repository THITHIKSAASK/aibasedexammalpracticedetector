let currentUser;

window.onload = () => {
    currentUser = checkAuth(['teacher']);
    if (currentUser) {
        fetchMyExams();
    }
}

function showTab(tabId, navId) {
    document.getElementById('exam-tab').style.display = 'none';
    document.getElementById('roster-tab').style.display = 'none';
    
    document.getElementById('exam-nav').classList.remove('active');
    document.getElementById('roster-nav').classList.remove('active');
    
    document.getElementById(tabId).style.display = 'block';
    if(navId) document.getElementById(navId).classList.add('active');
    
    if (tabId === 'roster-tab') {
        fetchClassRoster();
    } else {
        fetchMyExams();
    }
}

async function fetchMyExams() {
    try {
        const response = await fetch(`/api/teacher/${currentUser.id}/exams`);
        const exams = await response.json();
        const grid = document.getElementById('exams-grid');
        grid.innerHTML = '';
        
        if (exams.length === 0) {
            grid.innerHTML = '<p>No exams created yet.</p>';
            return;
        }

        exams.forEach(exam => {
            const card = document.createElement('div');
            card.className = 'card student-card';
            const durationMins = Math.floor(exam.duration / 60);
            card.innerHTML = `
                <h3>${exam.title}</h3>
                <p>Department: <strong>${exam.subject}</strong></p>
                <p>Time Limit: ${durationMins} Mins</p>
                <p style="margin-top:10px; font-size:12px; opacity:0.8;">Protocol ID: ${exam.id}</p>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        console.error("Error fetching exams", err);
    }
}

async function generateExam() {
    const title = document.getElementById('exam-title').value.trim();
    const keyword = document.getElementById('exam-keyword').value.trim();
    const duration = parseInt(document.getElementById('exam-duration').value);

    if (!title || !keyword) {
        alert("Please provide title and keyword.");
        return;
    }

    const btn = document.getElementById('gen-btn');
    const status = document.getElementById('gen-status');
    btn.disabled = true;
    status.innerText = "Generating questions with Mock AI...";
    status.style.color = "var(--primary)";

    try {
        const genRes = await fetch('/api/teacher/generate-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword })
        });
        const questions = await genRes.json();

        status.innerText = "Saving exam institutional record...";
        
        const saveRes = await fetch('/api/teacher/exam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                subject: keyword,
                teacherId: currentUser.id,
                duration,
                questions
            })
        });

        if (saveRes.ok) {
            status.innerText = "Exam created & assigned dynamically to students!";
            status.style.color = "var(--success)";
            fetchMyExams();
            document.getElementById('exam-title').value = '';
            document.getElementById('exam-keyword').value = '';
        } else {
             const data = await saveRes.json();
             status.innerText = "Failed: " + data.error;
             status.style.color = "var(--danger)";
        }
    } catch (err) {
        status.innerText = "Error: " + err.message;
        status.style.color = "var(--danger)";
    } finally {
        btn.disabled = false;
        setTimeout(() => { if(status.innerText.includes('success')) status.innerText = ''; }, 3000);
    }
}

async function fetchClassRoster() {
    try {
        const response = await fetch(`/api/teacher/${currentUser.id}/class-roster`);
        const groupedStudents = await response.json();
        
        const container = document.getElementById('roster-tables-container');
        container.innerHTML = '';
        
        if (groupedStudents.length === 0) {
            container.innerHTML = '<p>No students assigned to your protocols yet.</p>';
            return;
        }

        const byClass = {};
        groupedStudents.forEach(s => {
            if (!byClass[s.class]) byClass[s.class] = [];
            byClass[s.class].push(s);
        });
        
        for (const [cls, list] of Object.entries(byClass)) {
            const classHeader = document.createElement('h3');
            classHeader.innerText = `Department: ${cls}`;
            classHeader.style.marginTop = '20px';
            container.appendChild(classHeader);
            
            let tableHTML = `
                <table style="margin-bottom: 30px;">
                    <thead>
                        <tr>
                            <th>Student Name</th>
                            <th>Class</th>
                            <th>Roll Number</th>
                            <th>Tests Attended</th>
                            <th>To be Completed</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            list.forEach(stu => {
                const attended = stu.attended_count || 0;
                const remaining = stu.remaining_count || 0;
                tableHTML += `
                    <tr>
                        <td style="font-weight:bold;">${stu.name}</td>
                        <td>${stu.class}</td>
                        <td style="font-family:monospace; color:var(--primary); font-weight:bold;">${stu.roll_number || 'N/A'}</td>
                        <td style="text-align:center; font-weight:600; color:var(--success);">${attended}</td>
                        <td style="text-align:center; font-weight:600; color:var(--warning);">${remaining}</td>
                        <td style="display:flex; gap:5px;">
                            <button onclick="openAuditReport(${stu.student_id})" style="padding:5px 12px; font-size:12px; background:var(--primary); color:#fff; border:none; border-radius:4px;">Audit</button>
                            <button onclick="openChatModal(${stu.student_id}, '${stu.name}')" style="padding:5px 12px; font-size:12px; background:var(--secondary); color:var(--text-color); border:1px solid var(--border-color); border-radius:4px;">Message</button>
                            <button onclick="deleteStudent(${stu.student_id}, '${stu.name}')" style="padding:5px 12px; font-size:12px; background:var(--danger); color:#fff; border:none; border-radius:4px;">Delete</button>
                        </td>
                    </tr>
                `;
            });
            tableHTML += `</tbody></table>`;
            
            const tableWrap = document.createElement('div');
            tableWrap.innerHTML = tableHTML;
            container.appendChild(tableWrap);
        }
    } catch (err) {
        console.error("Failed to fetch roster", err);
    }
}

let activeChatStudentId = null;

async function openChatModal(studentId, studentName) {
    activeChatStudentId = studentId;
    document.getElementById('chat-target-name').innerText = studentName;
    
    const modal = document.getElementById('chat-modal');
    const messagesBody = document.getElementById('chat-messages-body');
    messagesBody.innerHTML = '<p style="text-align:center; opacity:0.6;">Loading secure session...</p>';
    
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
    
    await fetchMessages();
}

function closeChatModal() {
    const modal = document.getElementById('chat-modal');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        activeChatStudentId = null;
    }, 300);
}

async function fetchMessages() {
    if (!activeChatStudentId) return;
    const body = document.getElementById('chat-messages-body');
    
    try {
        const response = await fetch(`/api/messages/${currentUser.id}`);
        if (!response.ok) throw new Error("Portal communication error");
        
        const allMessages = await response.json();
        
        // Filter for specific conversation
        const conversation = allMessages.filter(m => 
            (m.sender_id === currentUser.id && m.receiver_id === activeChatStudentId) ||
            (m.sender_id === activeChatStudentId && m.receiver_id === currentUser.id)
        );

        body.innerHTML = '';
        
        if (conversation.length === 0) {
            body.innerHTML = `
                <div style="text-align:center; margin-top:40px; opacity:0.5;">
                    <p style="font-size:32px; margin-bottom:10px;">💬</p>
                    <p>Institutional record: No previous messages found.</p>
                    <p style="font-size:12px;">Start a secure session by typing below.</p>
                </div>
            `;
            return;
        }
        
        conversation.forEach(m => {
            const isMe = m.sender_id === currentUser.id;
            const bubble = document.createElement('div');
            bubble.style.cssText = `
                max-width: 80%;
                padding: 10px 15px;
                border-radius: 12px;
                font-size: 14px;
                align-self: ${isMe ? 'flex-end' : 'flex-start'};
                background: ${isMe ? 'var(--primary)' : 'var(--secondary)'};
                color: ${isMe ? '#fff' : 'var(--text-color)'};
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            `;
            bubble.innerText = m.content;
            body.appendChild(bubble);
        });
        body.scrollTop = body.scrollHeight;
    } catch (err) {
        console.error("Failed to fetch messages", err);
        body.innerHTML = `<p style="color:var(--danger); text-align:center; margin-top:20px;">Communication failure: ${err.message}</p>`;
    }
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content || !activeChatStudentId) return;

    try {
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender_id: currentUser.id,
                receiver_id: activeChatStudentId,
                content: content
            })
        });

        if (response.ok) {
            input.value = '';
            fetchMessages();
        }
    } catch (err) {
        console.error("Failed to send message", err);
    }
}

async function deleteStudent(studentId, name) {
    if (!confirm(`Are you sure you want to PERMANENTLY remove student: ${name}? All their exam records and violations will be purged.`)) return;

    try {
        const response = await fetch(`/api/users/${studentId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert("Student record purged successfully.");
            fetchClassRoster();
        } else {
            alert("Failed to delete student. Check permissions.");
        }
    } catch (err) {
        console.error("Purge Error:", err);
    }
}

function openAuditReport(studentId) {
    if (!studentId) return;
    window.open('report.html?studentId=' + studentId, '_blank');
}
