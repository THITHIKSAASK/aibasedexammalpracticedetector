let currentUser;

window.onload = () => {
    currentUser = checkAuth(['teacher']);
    if (currentUser) {
        // Updated Sidebar Profile elements
        document.getElementById('sidebar-user-name').innerText = currentUser.name || 'Faculty';
        if (currentUser.roll_number) {
            document.getElementById('sidebar-user-dept').innerText = `${currentUser.roll_number} | ${(currentUser.subject || 'INSTITUTIONAL').toUpperCase()}`;
        } else if (currentUser.subject) {
            document.getElementById('sidebar-user-dept').innerText = `${currentUser.subject.toUpperCase()} FACULTY`;
        }
        document.getElementById('sidebar-user-initial').innerText = (currentUser.name || 'F').charAt(0).toUpperCase();

        document.getElementById('teacher-name-welcome').innerText = currentUser.name || 'Faculty';
        showTab('landing-tab', 'home-nav');
        
        // Start notification poller
        checkUnreadMessages();
        setInterval(checkUnreadMessages, 15000); // 15s refresh
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

function showTab(tabId, navId) {
    // Hide all tabs
    const tabs = ['landing-tab', 'exam-tab', 'roster-tab', 'comm-tab', 'report-tab'];
    tabs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    
    // Deactivate all nav links
    const navs = ['home-nav', 'exam-nav', 'roster-nav', 'comm-nav'];
    navs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
    
    const activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.style.display = 'block';
    
    if (navId) {
        const activeNav = document.getElementById(navId);
        if (activeNav) activeNav.classList.add('active');
    }
    
    if (tabId === 'roster-tab') {
        fetchClassRoster();
    } else if (tabId === 'exam-tab') {
        fetchMyExams();
    } else if (tabId === 'comm-tab') {
        const badge = document.getElementById('unread-badge');
        if (badge) badge.style.display = 'none'; // Clear badge locally when entering
        fetchTeacherLogs();
        fetchTeacherContacts();
    }
}

let globalStudentsParams = [];

async function fetchTeacherContacts() {
    try {
        const response = await fetch(`/api/teacher/${currentUser.id}/class-roster`);
        const groupedStudents = await response.json();
        
        const uniqueStudents = {};
        groupedStudents.forEach(s => {
            uniqueStudents[s.student_id] = s;
        });
        globalStudentsParams = Object.values(uniqueStudents);

        const deptSelect = document.getElementById('contact-department-filter');
        if (deptSelect) {
            const departments = new Set();
            globalStudentsParams.forEach(s => { if (s.class) departments.add(s.class); });
            deptSelect.innerHTML = '<option value="all">All Classes</option>';
            Array.from(departments).sort().forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = `Class: ${d}`;
                deptSelect.appendChild(opt);
            });
        }
        
        window.renderFilteredContacts();

    } catch(err) {
        console.error("Failed to fetch contacts", err);
    }
}

window.renderFilteredContacts = function() {
    const container = document.getElementById('teacher-contacts-container');
    container.innerHTML = '';
    
    if (globalStudentsParams.length === 0) {
        container.innerHTML = '<p style="padding:15px; opacity:0.6; font-size:13px;">No students assigned.</p>';
        return;
    }
    
    const filterSelect = document.getElementById('contact-department-filter');
    const filter = filterSelect ? filterSelect.value : 'all';
    
    const sorted = [...globalStudentsParams].sort((a,b) => a.name.localeCompare(b.name));
    const filtered = filter === 'all' ? sorted : sorted.filter(s => s.class === filter);
    
    if (filtered.length === 0) {
        container.innerHTML = '<p style="padding:15px; opacity:0.6; font-size:13px;">No students found in this department.</p>';
        return;
    }

    filtered.forEach(stu => {
        const contactDiv = document.createElement('div');
        contactDiv.style.borderBottom = '1px solid var(--border-color)';
        contactDiv.style.padding = '12px 15px';
        contactDiv.style.cursor = 'pointer';
        contactDiv.style.display = 'flex';
        contactDiv.style.alignItems = 'center';
        contactDiv.style.gap = '10px';
        contactDiv.style.transition = 'background 0.2s';
        contactDiv.onmouseover = () => contactDiv.style.background = 'rgba(0,0,0,0.05)';
        contactDiv.onmouseout = () => contactDiv.style.background = 'transparent';
        
        contactDiv.onclick = () => openChatModal(stu.student_id, stu.name);

        contactDiv.innerHTML = `
            <div class="profile-circle" style="width:32px; height:32px; font-size:14px; margin:0; pointer-events:none;">${stu.name.charAt(0)}</div>
            <div style="pointer-events:none;">
                <div style="font-weight:600; font-size:14px;">${stu.name}</div>
                <div style="font-size:11px; opacity:0.7;">Class: ${stu.class}</div>
            </div>
        `;
        container.appendChild(contactDiv);
    });
}
async function fetchTeacherLogs() {
    try {
        const response = await fetch('/api/admin/system-logs'); // Teachers can see general logs for now
        const logs = await response.json();
        
        const container = document.getElementById('teacher-logs-container');
        if (!Array.isArray(logs) || logs.length === 0) {
            container.innerHTML = '<p style="padding:20px;">No institutional messages found or server update in progress.</p>';
            return;
        }

        let html = `<div style="display:flex; flex-direction:column; gap:10px; padding:20px; background:var(--bg-main); overflow-y:auto;">`;

        logs.forEach(l => {
            if (l.event_type === 'System Initialize' || l.description.includes('@category:debuggersd')) return;
            const date = new Date(l.timestamp).toLocaleString();
            html += `
                <div style="
                    align-self: flex-start;
                    background: var(--border-color);
                    color: var(--text-color);
                    padding: 10px 15px;
                    border-radius: 15px 15px 15px 0;
                    max-width: 80%;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                ">
                    <div style="font-weight:700; font-size:12px; margin-bottom:5px; color:var(--primary);">${l.event_type}</div>
                    <div style="line-height:1.4; font-size:14px;">${l.description}</div>
                    <div style="font-size:10px; opacity:0.6; margin-top:5px; text-align:right;">${date}</div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    } catch (err) {
        console.error("Error fetching logs", err);
    }
}

function downloadChatPDF() {
    const element = document.getElementById('chat-messages-body');
    if (!element) return;
    const opt = {
      margin:       0.5,
      filename:     'Teacher_Chat_Log.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
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
        window.BIT.alert("Please provide title and keyword.");
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
        const response = await fetch(`/api/messages/${currentUser.id}?role=${currentUser.role}`);
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
            const bubble = document.createElement('div');
            bubble.className = 'message-bubble animate-in';
            const isMe = m.sender_id === currentUser.id;
            bubble.style.cssText = `
                max-width: 80%;
                padding: 10px 15px;
                border-radius: 12px;
                font-size: 14px;
                align-self: ${isMe ? 'flex-end' : 'flex-start'};
                background: ${isMe ? 'var(--primary)' : 'var(--secondary)'};
                color: ${isMe ? '#fff' : 'var(--text-color)'};
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
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
                        <a href="${m.file_url}" download class="no-print" style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.5); color:#fff; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; text-decoration:none;">💾</a>
                    </div>
                `;
                if (m.content) bubble.innerHTML += `<p style="margin-top:5px;">${m.content}</p>`;
            } else if (m.message_type === 'pdf') {
                bubble.innerHTML = `
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:24px; cursor:pointer;" onclick="window.open('${m.file_url}')">📄</span>
                        <div style="text-align:left; flex:1;">
                            <div style="font-weight:700; font-size:12px;">Institutional Document</div>
                            <div style="font-size:10px; opacity:0.8;">Secure PDF Attachment</div>
                        </div>
                        <a href="${m.file_url}" download class="no-print" style="background:rgba(0,0,0,0.1); color:inherit; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; text-decoration:none;">💾</a>
                    </div>
                `;
                if (m.content) bubble.innerHTML += `<p style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.1); padding-top:5px;">${m.content}</p>`;
            } else {
                bubble.innerText = m.content;
            }
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
                content: content,
                message_type: 'text'
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

async function handleChatFileUpload() {
    const fileEl = document.getElementById('chat-file-input');
    if (!fileEl.files || !fileEl.files[0]) return;
    
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
            // Send message with file metadata
            await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender_id: currentUser.id,
                    receiver_id: activeChatStudentId,
                    content: `Sent a ${uploadData.type}`,
                    message_type: uploadData.type,
                    file_url: uploadData.fileUrl
                })
            });
            fetchMessages();
            fileEl.value = ''; // Reset
        }
    } catch (err) {
        console.error("Chat upload failed", err);
        alert("Institutional upload failed. Check connection.");
    }
}

async function deleteStudent(studentId, name) {
    window.BIT.confirm("Institutional Purge", `Are you sure you want to PERMANENTLY remove student: ${name}? All their exam records and violations will be purged.`, async (confirmed) => {
        if (!confirmed) return;
        
        try {
            const response = await fetch(`/api/users/${studentId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                window.BIT.toast("Student record purged successfully", "success");
                fetchClassRoster();
            } else {
                window.BIT.alert("Purge Failure", "Failed to delete student. Check permissions.");
            }
        } catch (err) {
            console.error("Purge Error:", err);
        }
    });
}

function openAuditReport(studentId) {
    if (!studentId) return;
    window.open('report.html?studentId=' + studentId, '_blank');
}
