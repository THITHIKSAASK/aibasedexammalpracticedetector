function createViolationModal(logs, attemptId, username) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const content = document.createElement('div');
    content.className = 'modal-content';
    
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `<h3>Logs: ${username} (Attempt #${attemptId})</h3>`;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    
    const body = document.createElement('div');
    body.className = 'modal-body';
    
    if (logs.length === 0) {
        body.innerHTML = "<p>No violations recorded.</p>";
    } else {
        let tableHTML = `
            <table style="margin-top:0;">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Type</th>
                        <th>Source</th>
                        <th>Severity</th>
                    </tr>
                </thead>
                <tbody>
        `;
        logs.forEach(log => {
            const time = new Date(log.timestamp).toLocaleTimeString();
            tableHTML += `
                <tr>
                    <td>${time}</td>
                    <td>${log.type}</td>
                    <td>${log.source ? log.source.toUpperCase() : 'UNKNOWN'}</td>
                    <td style="color:var(--danger); font-weight:bold;">+${log.severity}</td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        body.innerHTML = tableHTML;
    }
    
    content.appendChild(header);
    content.appendChild(body);
    overlay.appendChild(content);
    
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };
    
    document.body.appendChild(overlay);
}

// Student Detailed View Model (V4 upgrades)
async function openStudentModal(studentId, attemptId) {
    try {
        const [summaryRes, logsRes, commentsRes] = await Promise.all([
            fetch(`/api/student/${studentId}/summary`),
            fetch(`/api/admin/violations/${attemptId}`),
            fetch(`/api/student/${studentId}/comments`)
        ]);
        
        const data = await summaryRes.json();
        const summary = data.stats;
        const attemptsList = data.attempts;
        
        const logs = await logsRes.json();
        const comments = await commentsRes.json();
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        const content = document.createElement('div');
        content.className = 'modal-content modal-content-large'; // Added wide class
        
        const header = document.createElement('div');
        header.className = 'modal-header';
        header.innerHTML = `<h3>Student Analytics: ${summary.name}</h3>`;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => overlay.remove();
        header.appendChild(closeBtn);
        
        const body = document.createElement('div');
        body.className = 'modal-body';
        
        let html = `
            <div style="display:flex; justify-content:space-between; margin-bottom:20px; background:rgba(0,0,0,0.03); padding:15px; border-radius:8px; border: 1px solid var(--border-color);">
                <div>
                   <p style="margin-bottom:5px;"><strong>Class:</strong> ${summary.class} - ${summary.section || 'N/A'}</p>
                   <p><strong>Email:</strong> <span style="font-family: monospace;">${summary.email}</span></p>
                </div>
                <div style="text-align:right;">
                   <p style="margin-bottom:5px;"><strong>Total System Warnings:</strong> <span style="color:var(--danger); font-weight:bold;">${summary.totalWarnings || 0}</span></p>
                   <p><strong>Cumulative Malpractice Score:</strong> <span style="color:var(--danger); font-weight:bold;">${summary.totalScore || 0}</span></p>
                </div>
            </div>
            
            <div style="display:flex; gap: 30px;">
                <!-- Left Column -->
                <div style="flex:1;">
                    <h4 style="margin-bottom:15px; color:var(--primary);">Incident Event Logs (Attempt #${attemptId})</h4>
        `;
        
        if (logs.length === 0) {
            html += "<p style='margin-bottom:25px;'>No violations recorded for this attempt.</p>";
        } else {
            html += `
                <table style="margin-top:0; margin-bottom:25px; font-size:14px;">
                    <thead><tr><th>Time</th><th>Sensor Type</th><th>Severity</th></tr></thead>
                    <tbody>
            `;
            logs.forEach(log => {
                const time = new Date(log.timestamp).toLocaleTimeString();
                html += `
                    <tr>
                        <td style="white-space:nowrap;">${time}</td>
                        <td style="font-weight:bold; color:var(--text-color);">${log.type}</td>
                        <td style="color:var(--danger); font-weight:bold;">+${log.severity} pts</td>
                    </tr>
                `;
            });
            html += `</tbody></table>`;
        }
        
        html += `
                    <h4 style="margin-bottom:15px; color:var(--primary);">Academic History</h4>
                    <table style="margin-top:0; font-size:14px; margin-bottom:25px;">
                        <thead><tr><th>Exam Code</th><th>Malpractice Score</th><th>Academic Result</th></tr></thead>
                        <tbody>
        `;
        if (attemptsList && attemptsList.length > 0) {
            attemptsList.forEach(att => {
                html += `
                    <tr>
                        <td>${att.title}</td>
                        <td style="color:var(--danger); font-weight:bold;">${att.malpractice_score}</td>
                        <td style="color:var(--success); font-weight:bold;">${att.academic_score || 0} / ${att.max_academic_score || 0}</td>
                    </tr>
                `;
            });
        } else {
            html += `<tr><td colspan="3">No exams taken.</td></tr>`;
        }
        html += `</tbody></table></div>`;
        
        // Right Column (Teacher Notes)
        if (typeof currentUser !== 'undefined' && (currentUser.role === 'teacher' || currentUser.role === 'admin')) {
            html += `
                <div style="flex:1; border-left: 1px solid var(--border-color); padding-left: 30px;">
                    <h4 style="margin-bottom:15px; color:var(--primary);">Faculty Notes (Restricted)</h4>
                    <div style="background:var(--bg-main); padding:15px; border-radius:8px; border:1px solid var(--border-color); margin-bottom:20px;">
                        <textarea id="modal-comment-input" placeholder="Add confidential evaluation notes for this student..." style="width:100%; height:80px; padding:10px; border-radius:5px; border:1px solid var(--border-color); resize:vertical; font-family:inherit; margin-bottom:10px;"></textarea>
                        <button onclick="submitTeacherComment(${studentId})" style="width:100%; padding:8px;">Save Internal Note</button>
                        <p id="modal-comment-error" style="color:var(--danger); font-size:12px; margin-top:5px; font-weight:bold; text-align:center;"></p>
                    </div>
                    
                    <h4 style="margin-bottom:15px; color:var(--text-color); font-size:14px;">Log History</h4>
                    <div id="modal-comments-list" style="max-height:300px; overflow-y:auto; padding-right:10px;">
            `;
            
            if (comments.length === 0) {
                html += `<p style="font-size:13px; opacity:0.7;">No faculty comments saved.</p>`;
            } else {
                comments.forEach(c => {
                    const time = new Date(c.timestamp).toLocaleString();
                    html += `
                        <div style="margin-bottom:15px; padding:12px; background:rgba(0,0,0,0.02); border-left:3px solid var(--secondary); border-radius:0 5px 5px 0;">
                            <p style="font-size:12px; margin-bottom:5px; color:var(--primary); font-weight:bold;">${c.teacher_name} <span style="font-weight:normal; color:var(--text-color); opacity:0.7; margin-left:5px;">${time}</span></p>
                            <p style="font-size:14px;">${c.comment}</p>
                        </div>
                    `;
                });
            }
            html += `</div></div>`;
        }
        
        html += `</div>`; // Close flex wrapper
        
        body.innerHTML = html;
        content.appendChild(header);
        content.appendChild(body);
        overlay.appendChild(content);
        
        // Fade in animation wrapper
        setTimeout(() => overlay.style.opacity = '1', 10);
        
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 250);
            }
        };
        document.body.appendChild(overlay);

    } catch (err) {
        console.error("Failed to fetch detailed student data:", err);
    }
}
