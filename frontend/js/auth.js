let selectedRegRole = 'student';

function hideAll() {
    ['initial-decision', 'teacher-onboarding', 'student-onboarding'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
}

function showDecision() {
    hideAll();
    document.getElementById('initial-decision').style.display = 'block';
}

function setRegRole(role) {
    selectedRegRole = role;
    document.getElementById('role-student').classList.toggle('active', role === 'student');
    document.getElementById('role-teacher').classList.toggle('active', role === 'teacher');
}

function goToOnboarding() {
    hideAll();
    if (selectedRegRole === 'teacher') document.getElementById('teacher-onboarding').style.display = 'block';
    if (selectedRegRole === 'student') document.getElementById('student-onboarding').style.display = 'block';
}

async function login() {
    const email = document.getElementById('login-email').value.trim();
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
            if (data.user.role === 'admin') window.location.href = 'admin.html';
            else if (data.user.role === 'teacher') window.location.href = 'teacher.html';
            else window.location.href = 'student.html';
        } else {
            document.getElementById('error-msg').innerText = data.error || 'Login failed';
        }
    } catch (err) {
        document.getElementById('error-msg').innerText = 'System error: ' + err.message;
    }
}

async function registerTeacher() {
    const errorMsg = document.getElementById('teacher-error');
    const fields = {
        role: 'teacher',
        name: document.getElementById('t-name').value.trim(),
        gender: document.getElementById('t-gender').value,
        email: document.getElementById('t-email').value.trim(),
        designation: document.getElementById('t-designation').value,
        subject: document.getElementById('t-subject').value,
        class: document.getElementById('t-class').value.trim()
    };
    handleRegistration(fields, errorMsg, 'teacher.html');
}

async function registerStudent() {
    const errorMsg = document.getElementById('student-error');
    const fields = {
        role: 'student',
        name: document.getElementById('s-name').value.trim(),
        gender: document.getElementById('s-gender').value,
        email: document.getElementById('s-email').value.trim(),
        class: document.getElementById('s-class').value.trim(),
        section: document.getElementById('s-section').value.trim()
    };
    handleRegistration(fields, errorMsg, 'student.html');
}

async function handleRegistration(fields, errorEl, redirectTarget) {
    if (Object.values(fields).some(val => !val)) {
        errorEl.innerText = "All fields are required.";
        return;
    }
    
    if (!validateEmail(fields.email)) {
        errorEl.innerText = "Only institutional email IDs (@bannari.com) are allowed.";
        return;
    }
    
    try {
        errorEl.style.color = "var(--primary)";
        errorEl.innerText = "Registering...";
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields)
        });
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = redirectTarget;
        } else {
            errorEl.style.color = "var(--danger)";
            errorEl.innerText = data.error;
        }
    } catch (err) {
        errorEl.style.color = "var(--danger)";
        errorEl.innerText = "System error: " + err.message;
    }
}
