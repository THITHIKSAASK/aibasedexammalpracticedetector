async function login() {
    const email = document.getElementById('username').value.trim();
    if (!email) return;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('user', JSON.stringify(data.user));
            if (data.user.role === 'admin') {
                window.location.href = 'admin.html';
            } else if (data.user.role === 'teacher') {
                window.location.href = 'teacher.html';
            } else {
                window.location.href = 'student.html';
            }
        } else {
            document.getElementById('error-msg').innerText = data.error || 'Login failed';
        }
    } catch (err) {
        document.getElementById('error-msg').innerText = 'System error: ' + err.message;
    }
}
