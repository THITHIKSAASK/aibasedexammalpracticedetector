// API to handle Teacher Comments inside the modal

async function submitTeacherComment(studentId) {
    const input = document.getElementById('modal-comment-input');
    const validateErr = document.getElementById('modal-comment-error');
    if (!input || !input.value.trim()) return;

    try {
        const res = await fetch('/api/teacher/comment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                teacher_id: currentUser.id,
                student_id: studentId,
                comment: input.value.trim()
            })
        });
        
        if (res.ok) {
            const list = document.getElementById('modal-comments-list');
            if (list.innerHTML.includes('No faculty comments saved.')) {
                list.innerHTML = '';
            }
            
            const newComment = `
                <div style="margin-bottom:15px; padding:12px; background:rgba(0,0,0,0.02); border-left:3px solid var(--success); border-radius:0 5px 5px 0;">
                    <p style="font-size:12px; margin-bottom:5px; color:var(--primary); font-weight:bold;">${currentUser.name} <span style="font-weight:normal; color:var(--text-color); opacity:0.7; margin-left:5px;">Just now</span></p>
                    <p style="font-size:14px;">${input.value.trim()}</p>
                </div>
            `;
            
            list.innerHTML = newComment + list.innerHTML;
            input.value = '';
            validateErr.innerText = '';
        } else {
            const data = await res.json();
            validateErr.innerText = "Failed: " + data.error;
        }
    } catch (e) {
        validateErr.innerText = "System error tracking notes.";
    }
}
