let selectedRole = null;

function selectRole(role) {
    document.getElementById('role-selection').style.display = 'none';
    selectedRole = role;
    
    if (role === 'admin') {
        document.getElementById('login-form').style.display = 'block';
    } else if (role === 'teacher') {
        document.getElementById('teacher-onboarding').style.display = 'block';
    } else if (role === 'student') {
        document.getElementById('student-onboarding').style.display = 'block';
    }
}

function showLogin() {
    document.getElementById('role-selection').style.display = 'none';
    document.getElementById('teacher-onboarding').style.display = 'none';
    document.getElementById('student-onboarding').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
}

function showRoleSelection() {
    document.getElementById('role-selection').style.display = 'block';
    document.getElementById('teacher-onboarding').style.display = 'none';
    document.getElementById('student-onboarding').style.display = 'none';
    document.getElementById('login-form').style.display = 'none';
}

async function registerTeacher() {
    const errorMsg = document.getElementById('teacher-error');
    const fields = {
        role: 'teacher',
        username: document.getElementById('t-email').value.trim().split('@')[0], // derived username
        name: document.getElementById('t-name').value.trim(),
        gender: document.getElementById('t-gender').value,
        email: document.getElementById('t-email').value.trim(),
        subject: document.getElementById('t-subject').value,
        class: document.getElementById('t-class').value.trim(),
        designation: document.getElementById('t-designation').value
    };
    handleRegistration(fields, errorMsg, 'teacher.html');
}

async function registerStudent() {
    const errorMsg = document.getElementById('student-error');
    const fields = {
        role: 'student',
        username: document.getElementById('s-email').value.trim().split('@')[0], // derived username
        name: document.getElementById('s-name').value.trim(),
        gender: document.getElementById('s-gender').value,
        email: document.getElementById('s-email').value.trim(),
        class: document.getElementById('s-class').value.trim(),
        section: document.getElementById('s-section').value.trim(),
        subject: document.getElementById('s-subject').value
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
