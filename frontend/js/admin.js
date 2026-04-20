let currentUser;

window.onload = () => {
    currentUser = checkAuth(['admin']);
    if (currentUser) {
        showTab('monitor-tab', 'monitor-nav');
    }
}

function showTab(tabId, navId) {
    // Hide all tabs
    ['monitor-tab', 'reports-tab', 'comm-tab'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    
    // Deactivate all nav links
    ['monitor-nav', 'reports-nav', 'comm-nav'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });

    // Show active tab
    const activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.style.display = 'block';

    // Activate active nav link
    const activeNav = document.getElementById(navId);
    if (activeNav) activeNav.classList.add('active');

    // Load data based on tab
    if (tabId === 'monitor-tab') fetchAnalytics();
    if (tabId === 'reports-tab') fetchUsers();
    if (tabId === 'comm-tab') fetchLogs();
}

async function fetchAnalytics() {
    try {
        const response = await fetch('/api/admin/analytics');
        const data = await response.json();
        
        const grid = document.getElementById('analytics-grid');
        grid.innerHTML = '';
        
        if (data.length === 0) {
            grid.innerHTML = '<p>No exam attempts found in the system.</p>';
            return;
        }

        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Student Name</th>
                        <th>Class</th>
                        <th>Exam Paper</th>
                        <th>Status</th>
                        <th>Malpractice</th>
                        <th>Warnings</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.forEach(row => {
            let statusClass = 'status-Pending';
            if (row.status === 'Completed') statusClass = 'status-Completed';
            else if (row.status === 'Terminated') statusClass = 'status-Terminated';
            else if (row.warnings > 2) statusClass = 'status-Suspicious';

            tableHTML += `
                <tr onclick="openStudentModal(${row.student_id}, ${row.id})">
                    <td>#${row.id}</td>
                    <td style="font-weight:bold;">${row.name}</td>
                    <td>${row.class}</td>
                    <td>${row.title}</td>
                    <td class="${statusClass}">${row.status}</td>
                    <td style="color:var(--danger); font-weight:bold;">${row.score}</td>
                    <td class="${statusClass}">${row.warnings}/5</td>
                </tr>
            `;
        });
        
        tableHTML += `</tbody></table>`;
        grid.innerHTML = tableHTML;
    } catch (err) {
        console.error("Error fetching analytics", err);
    }
}

async function fetchUsers() {
    try {
        const response = await fetch('/api/admin/users');
        const users = await response.json();
        
        const container = document.getElementById('users-table-container');
        if (!Array.isArray(users) || users.length === 0) {
            container.innerHTML = '<p style="padding:20px;">No users found or server is being updated.</p>';
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Role</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Subject/Class</th>
                        <th>Roll No.</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
        `;

        users.forEach(u => {
            const roleLabel = u.role === 'teacher' ? '<span style="color:var(--primary); font-weight:700;">FACULTY</span>' : '<span style="color:var(--success); font-weight:700;">STUDENT</span>';
            const detail = u.role === 'teacher' ? (u.subject || 'General') : (u.class || 'Unassigned');
            
            html += `
                <tr>
                    <td>${roleLabel}</td>
                    <td style="font-weight:700;">${u.name}</td>
                    <td>${u.email}</td>
                    <td>${detail}</td>
                    <td style="font-family:monospace;">${u.roll_number || 'N/A'}</td>
                    <td>
                        <button onclick="deleteUserPrompt(${u.id}, '${u.name}')" style="background:var(--danger); padding:4px 12px; font-size:11px; margin:0;">Delete</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (err) {
        console.error("Error fetching users", err);
    }
}

async function fetchLogs() {
    try {
        const response = await fetch('/api/admin/system-logs');
        const logs = await response.json();
        
        const container = document.getElementById('logs-table-container');
        if (!Array.isArray(logs) || logs.length === 0) {
            container.innerHTML = '<p style="padding:20px;">No system communication logs found or server is being updated.</p>';
            return;
        }

        let html = `<div id="chat-export-content" style="display:flex; flex-direction:column; gap:10px; padding:20px; background:var(--bg-main); max-height:600px; overflow-y:auto;">`;

        logs.forEach(l => {
            if (l.event_type === 'System Initialize' || l.event_type.includes('debuggersd') || l.description.includes('@category:debuggersd')) return;
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
        container.style.padding = "0"; // Reset any extra padding
    } catch (err) {
        console.error("Error fetching logs", err);
    }
}

function downloadChatPDF() {
    const element = document.getElementById('chat-export-content') || document.getElementById('logs-table-container');
    const opt = {
      margin:       0.5,
      filename:     'Institutional_Logs_Export.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}

async function deleteUserPrompt(userId, name) {
    window.BIT.prompt(`Administrative Purge: ${name}`, "Enter reason for institutional compliance", async (remark) => {
        if (!remark) return;

        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    remark: remark, 
                    actorId: currentUser.id 
                })
            });
            
            const result = await response.json();
            if (result.success) {
                window.BIT.toast(result.message, "success");
                fetchUsers();
            } else {
                window.BIT.alert("Purge Failure", result.error || "System error.");
            }
        } catch (err) {
            console.error("Delete Error:", err);
        }
    });
}
async function sendBroadcast() {
    const target = document.getElementById('broadcast-target').value;
    const content = document.getElementById('broadcast-input').value.trim();
    
    if (!content) return;

    try {
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender_id: currentUser.id,
                content: content,
                message_type: 'text',
                broadcast_role: target
            })
        });

        if (response.ok) {
            window.BIT.toast(`Institutional Broadcast Sent: ${target.toUpperCase()}`, "success");
            document.getElementById('broadcast-input').value = '';
            fetchLogs(); // Refresh logs to show the broadcast action
        } else {
            window.BIT.alert("Broadcast Error", "Unauthorized or system failure.");
        }
    } catch (err) {
        console.error("Broadcast failed", err);
    }
}

async function openStudentModal(studentId, attemptId) {
    const modal = document.getElementById('student-modal');
    modal.style.display = 'flex';
    
    try {
        // Fetch attempt details and violations
        const response = await fetch(`/api/admin/violations/${attemptId}`);
        const violations = await response.json();
        
        // Fetch analytics row for this attempt to get basic info
        const analyticsRes = await fetch('/api/admin/analytics');
        const allData = await analyticsRes.json();
        const row = allData.find(r => r.id === attemptId);

        if (row) {
            document.getElementById('audit-student-name').innerText = row.name;
            document.getElementById('audit-exam-title').innerText = row.title;
            document.getElementById('audit-score').innerText = row.score;
            document.getElementById('audit-warnings').innerText = `${row.warnings}/5`;
            
            const snapshotContainer = document.getElementById('audit-snapshot-container');
            if (row.identity_snapshot) {
                snapshotContainer.innerHTML = `<img src="${row.identity_snapshot}" style="width:100%; height:100%; object-fit:cover;">`;
            } else {
                snapshotContainer.innerHTML = `<p style="opacity:0.5;">No snapshot recorded for this session.</p>`;
            }
        }

        const violationsBody = document.getElementById('audit-violations-body');
        if (violations.length === 0) {
            violationsBody.innerHTML = '<p style="padding:20px; text-align:center; opacity:0.6;">No protocol violations detected during this session.</p>';
        } else {
            let html = `
                <table>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Violation Type</th>
                            <th>Severity</th>
                            <th>Source</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            violations.forEach(v => {
                const date = new Date(v.timestamp).toLocaleTimeString();
                html += `
                    <tr>
                        <td style="opacity:0.6;">${date}</td>
                        <td style="font-weight:700; color:var(--danger);">${v.type}</td>
                        <td>${v.severity}</td>
                        <td style="font-size:12px; opacity:0.8;">${v.source}</td>
                    </tr>
                `;
            });
            html += '</tbody></table>';
            violationsBody.innerHTML = html;
        }
    } catch (err) {
        console.error("Audit fetch error", err);
    }
}

function closeStudentModal() {
    document.getElementById('student-modal').style.display = 'none';
}
