let currentUser;

window.onload = async () => {
    // 1. Verify Authentication
    currentUser = checkAuth(['teacher']);
    if (!currentUser) return;

    // 2. Extract student parameter
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('studentId');
    if (!studentId) {
        document.body.innerHTML = '<h2>Error: Missing Student ID in audit protocol.</h2>';
        return;
    }

    // 3. Setup static meta
    document.getElementById('report-date').innerText = `Date Issued: ${new Date().toLocaleString()}`;
    document.getElementById('faculty-name').innerText = currentUser.name;

    await fetchAuditData(studentId);
};

async function fetchAuditData(studentId) {
    try {
        const response = await fetch(`/api/teacher/student-audit/${studentId}/${currentUser.id}`);
        const data = await response.json();

        if (data.error) {
            document.body.innerHTML = `<h2>Error: ${data.error}</h2>`;
            return;
        }

        renderStudentMeta(data.student, data.attempts);
        renderExamSummary(data.attempts);
        renderTimeline(data.violations);
    } catch (err) {
        console.error("Failed to fetch audit data", err);
    }
}

function renderStudentMeta(student, attempts) {
    const metaContainer = document.getElementById('meta-text');
    metaContainer.innerHTML = `
        <p><strong>Name:</strong> ${student.name}</p>
        <p><strong>Email:</strong> ${student.email}</p>
        <p><strong>Department:</strong> ${student.class} - ${student.section}</p>
        <p><strong>Roll/ID Number:</strong> ${student.roll_number || 'N/A'}</p>
        <p><strong>Classification:</strong> ${student.gender || 'Institutional'}</p>
    `;

    const snapshotContainer = document.getElementById('identity-snapshot-container');
    
    // Find the first valid snapshot across all attempts for this audit
    const latestSnapshot = attempts.find(a => a.identity_snapshot)?.identity_snapshot;
    
    if (latestSnapshot) {
        snapshotContainer.innerHTML = `
            <div style="border: 3px solid var(--primary); padding: 5px; border-radius: 8px; display: inline-block;">
                <img src="${latestSnapshot}" alt="Identity Snapshot" style="max-width: 150px; border-radius: 4px; display: block;">
                <p style="margin: 5px 0 0; font-size: 11px; color: #666; text-align: center; font-family: monospace;">VERIFIED IDENTITY</p>
            </div>
        `;
    } else {
        snapshotContainer.innerHTML = `
            <div style="border: 2px dashed #ccc; padding: 20px; border-radius: 8px; width: 150px; text-align: center; color: #999;">
                <p style="margin: 0; font-size: 12px;">No Snapshot File</p>
            </div>
        `;
    }
}

function renderExamSummary(attempts) {
    const tbody = document.querySelector('#exam-table tbody');
    if (attempts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No completed protocols matching faculty access.</td></tr>`;
        return;
    }

    let rows = '';
    attempts.forEach(a => {
        rows += `
            <tr>
                <td>${a.title}</td>
                <td>${a.subject}</td>
                <td>${a.score}</td>
                <td style="font-weight:bold; color: ${a.status === 'Terminated' ? 'var(--danger)' : 'inherit'}">${a.status}</td>
                <td><strong style="color:var(--danger);">${a.warnings}</strong> / 5</td>
            </tr>
        `;
    });
    tbody.innerHTML = rows;
}

function renderTimeline(violations) {
    const container = document.getElementById('timeline-container');
    if (violations.length === 0) {
        container.innerHTML = `
            <div class="timeline-item safe">
                <strong style="color:var(--success);">✅ Protocol Maintained</strong>
                <p>No integrity violations were recorded during these assessments.</p>
            </div>
        `;
        return;
    }

    let items = '';
    violations.forEach(v => {
        const dt = new Date(v.timestamp).toLocaleString();
        items += `
            <div class="timeline-item">
                <strong style="color:var(--danger);">⚠️ ${v.type} Detected</strong>
                <span style="font-size: 13px; color: #666; margin-left: 10px;">${dt}</span>
                <p style="margin: 5px 0 0; font-size:14px;"><strong>Source:</strong> ${v.source}</p>
                <p style="margin: 2px 0 0; font-size:14px; opacity:0.8;">Action Logged (Severity: ${v.severity})</p>
            </div>
        `;
    });
    container.innerHTML = items;
}
