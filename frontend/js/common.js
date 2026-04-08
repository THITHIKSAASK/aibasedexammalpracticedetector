function checkAuth(allowedRoles) {
    const userData = localStorage.getItem('user');
    if (!userData) {
        window.location.href = 'index.html';
        return null; // redirecting
    }
    const user = JSON.parse(userData);
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        alert("Unauthorized access");
        logout();
        return null;
    }
    
    // Auto populate top nav name and initial if they exist
    const displayName = document.getElementById('user-display-name');
    const userInitial = document.getElementById('user-initial');
    
    if (displayName) {
        const nameToShow = user.name || user.username || user.email.split('@')[0];
        displayName.innerText = nameToShow;
        
        if (userInitial) {
            userInitial.innerText = nameToShow.charAt(0).toUpperCase();
            
            // Gender-Based Visual Classification
            if (user.gender === 'Female') {
                userInitial.style.background = '#ec4899'; // Rose
            } else if (user.gender === 'Male') {
                userInitial.style.background = '#6366f1'; // Indigo
            } else {
                userInitial.style.background = '#8b5cf6'; // Institutional Violet
            }
        }
    }

    // Apply subject theme automatically if available
    if (user.subject && !document.body.classList.contains('has-subject-theme')) {
        applySubjectTheme(user.subject);
    }

    // Initialize theme
    const currentTheme = localStorage.getItem('theme') || 'dark';
    document.body.classList.toggle('light-mode', currentTheme === 'light');

    // Inject Profile UI
    renderProfileUI(user);

    return user;
}

function renderProfileUI(user) {
    const navControls = document.getElementById('nav-controls');
    if (!navControls) return;

    const nameToShow = user.name || user.username || user.email.split('@')[0];
    const initial = nameToShow.charAt(0).toUpperCase();
    let bgCol = '#8b5cf6';
    if (user.gender === 'Female') bgCol = '#ec4899';
    else if (user.gender === 'Male') bgCol = '#6366f1';

    // Do not create a duplicate profile trigger in the Top Nav. 
    // We will hook into the existing user-initial div inside the HTML files.

    // Create Profile Modal if not exists
    if (!document.getElementById('profile-modal')) {
        const modal = document.createElement('div');
        modal.id = 'profile-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:420px; border-radius:32px;">
                <div class="modal-header" style="background:transparent; color:var(--text-color); border-bottom:1px solid var(--border-color);">
                    <h3 style="font-family:var(--font-head);">Institutional Identity</h3>
                    <button class="modal-close" onclick="toggleProfileModal()" style="color:var(--text-color);">&times;</button>
                </div>
                <div class="modal-body" style="text-align:center; padding:40px;">
                    <div class="profile-avatar-large" 
                         style="background: ${bgCol}; display: flex; align-items: center; justify-content: center; font-size: 50px; font-weight: bold; color: white; margin: 0 auto; line-height: 1;">
                         ${initial}
                    </div>
                    <h2 style="margin:15px 0 5px 0;">${user.name || user.username}</h2>
                    <p style="opacity:0.7; margin-bottom:20px;">${user.email}</p>
                    
                    <div class="profile-info-grid">
                        <div class="info-item"><strong>Role:</strong> <span>${user.role.toUpperCase()}</span></div>
                        <div class="info-item"><strong>ID:</strong> <span>#INST-${user.id}</span></div>
                    </div>

                    ${user.role === 'student' ? `
                    <div style="margin-top:30px; padding-top:20px; border-top:1px solid var(--border-color);">
                        <p style="margin-bottom:15px; font-weight:600;">Institutional Communication</p>
                        <div id="student-chat-container" style="height:200px; display:flex; flex-direction:column; border:1px solid var(--border-color); border-radius:8px; overflow:hidden;">
                            <div id="student-chat-body" style="flex:1; overflow-y:auto; padding:10px; background:var(--bg-main); display:flex; flex-direction:column; gap:8px; font-size:13px;">
                                <!-- Faculty Messages -->
                            </div>
                            <div style="padding:10px; border-top:1px solid var(--border-color); display:flex; gap:5px;">
                                <input type="text" id="student-chat-input" placeholder="Reply to faculty..." style="flex:1; margin:0; font-size:12px; padding:6px;">
                                <button onclick="sendStudentReply()" style="width:auto; padding:0 10px; font-size:11px;">Send</button>
                            </div>
                        </div>
                        <div id="teacher-threads" style="margin-top:10px; display:flex; gap:5px; flex-wrap:wrap;"></div>
                    </div>` : ''}

                    <div style="margin-top:30px; padding-top:20px; border-top:1px solid var(--border-color);">
                        <p style="margin-bottom:15px; font-weight:600;">System Preference</p>
                        <button class="theme-toggle-btn" onclick="toggleTheme()">
                            🌓 Switch to ${localStorage.getItem('theme') === 'light' ? 'Dark' : 'Light'} Mode
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        if (user.role === 'student') {
            // Trigger student message fetch
            setTimeout(() => { if(window.fetchStudentMessages) fetchStudentMessages(); }, 100);
        }
    }
}

function toggleProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;
    modal.classList.toggle('show');
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    
    // Update button text in modal if open
    const btn = document.querySelector('.theme-toggle-btn');
    if (btn) {
        btn.innerText = `🌓 Switch to ${isLight ? 'Dark' : 'Light'} Mode`;
    }
}

function applySubjectTheme(subject) {
    if (!subject) return;
    
    // Clear previous
    document.body.classList.remove('has-subject-theme');
    const classes = Array.from(document.body.classList);
    classes.forEach(c => { if(c.startsWith('theme-')) document.body.classList.remove(c); });

    document.body.classList.add('has-subject-theme');
    // Ensure accurate subject matching
    const validSubjects = ['Science', 'History', 'English', 'Math', 'Geography'];
    const matched = validSubjects.find(s => subject.toLowerCase().includes(s.toLowerCase()));
    if (matched) {
        document.body.classList.add(`theme-${matched}`);
    }
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

function showToast(message, type = 'warning') {
    const container = document.getElementById('toast-container');
    if (!container) return; 
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}
