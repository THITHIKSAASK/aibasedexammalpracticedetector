let currentUser;

window.onload = () => {
    currentUser = checkAuth(['admin']);
    if (currentUser) {
        fetchAnalytics();
    }
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
                        <th>Attempt ID</th>
                        <th>Student Name</th>
                        <th>Institutional Email</th>
                        <th>Class Target</th>
                        <th>Exam Paper</th>
                        <th>Status</th>
                        <th>Malpractice Score</th>
                        <th>Warnings Logged</th>
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
                    <td>${row.email}</td>
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
