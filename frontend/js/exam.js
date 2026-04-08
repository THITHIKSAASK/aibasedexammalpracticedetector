let currentUser;
let activeExamContext;
let currentScore = 0;
let totalWarnings = 0; 
let examTimer = 0; 
let timerInterval;
let aiMockInterval;
let questionsData = [];

let lastViolationTime = 0;
const VIOLATION_DEBOUNCE_MS = 2000;

window.onload = async () => {
    currentUser = checkAuth(['student']);
    const ctxString = localStorage.getItem('activeExam');
    if (!currentUser || !ctxString) {
        window.location.href = 'student.html';
        return;
    }
    activeExamContext = JSON.parse(ctxString);
    
    // Apply subject-specific theme
    applySubjectTheme(activeExamContext.subject);
    
    document.getElementById('user-display-name').innerText = currentUser.username || currentUser.name || currentUser.email.split('@')[0];
    document.getElementById('welcome-text').innerText = `Exam Active`;
    
    await setupWebcam(); // Must start webcam for snapshot
    
    // Test is blocked by verification overlay visually.
};

function applySubjectTheme(subject) {
    if (!subject) return;
    document.body.classList.add('has-subject-theme');
    document.body.classList.add(`theme-${subject}`);
}

async function captureSnapshot() {
    const video = document.getElementById('webcam');
    const btn = document.getElementById('capture-snapshot-btn');
    const errUI = document.getElementById('verification-error');
    
    if (!video || !video.videoWidth) {
        errUI.innerText = "Camera not ready or permission denied.";
        return;
    }

    btn.innerText = "Verifying...";
    btn.disabled = true;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64Image = canvas.toDataURL('image/jpeg', 0.8);
    
    try {
        const res = await fetch('/api/student/verify-identity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attemptId: activeExamContext.attemptId, snapshot: base64Image })
        });
        
        if (res.ok) {
            document.getElementById('verification-overlay').style.display = 'none';
            // Start exam logic after verified
            await fetchQuestions();
            initMalpracticeMonitoring(activeExamContext.attemptId, logViolationUIUpdate);
        } else {
            const data = await res.json();
            errUI.innerText = data.error || "Verification failed.";
            btn.innerText = "📸 Capture Snapshot & Verify";
            btn.disabled = false;
        }
    } catch(err) {
        errUI.innerText = "System error during verification.";
        btn.innerText = "📸 Capture Snapshot & Verify";
        btn.disabled = false;
    }
}


// Sync UI when a violation is logged via malpractice.js
function logViolationUIUpdate(type, severity) {
    totalWarnings++; 
    currentScore += severity;
    document.getElementById('warning-count-display').innerText = totalWarnings;
    document.getElementById('malpractice-score').innerText = currentScore;
    
    updateWarningUI(type);
    checkAutoLogout();
}

async function fetchQuestions() {
    try {
        const res = await fetch(`/api/student/exam/${activeExamContext.examId}/questions`);
        questionsData = await res.json();
        
        examTimer = 120; 
        startTimer();

        const container = document.getElementById('dynamic-questions-container');
        container.innerHTML = '';
        
        questionsData.forEach((q, index) => {
            const qDiv = document.createElement('div');
            qDiv.style.marginBottom = '25px';
            
            let html = `<h3 style="margin-bottom:10px;">Q${index + 1}: ${q.text}</h3>`;
            q.options.forEach((opt, oIndex) => {
                html += `<label style="display:block; margin-bottom:8px; font-size:16px; cursor:pointer;">
                            <input type="radio" name="q${q.id}" value="${opt}" style="width:auto; margin:0 10px 0 0;"> ${opt}
                         </label>`;
            });
            qDiv.innerHTML = html;
            container.appendChild(qDiv);
        });
    } catch (e) {
        console.error("Failed to fetch questions", e);
    }
}

function startTimer() {
    timerInterval = setInterval(() => {
        examTimer--;
        const mins = String(Math.floor(examTimer / 60)).padStart(2, '0');
        const secs = String(examTimer % 60).padStart(2, '0');
        const timerDisplay = document.getElementById('timer');
        if (timerDisplay) timerDisplay.innerText = `${mins}:${secs}`;
        
        if (examTimer <= 0) {
            clearInterval(timerInterval);
            submitExam(false); 
        }
    }, 1000);
}

function checkAutoLogout() {
    if (totalWarnings >= 5) {
        submitExam(true); 
    }
}

function updateWarningUI(violationType) {
    document.body.classList.remove('warning-active');
    document.body.classList.remove('freeze-active');
    
    if (totalWarnings === 4) {
        document.body.classList.add('freeze-active');
        const banner = document.getElementById('global-warning-banner');
        if (banner) banner.style.display = 'block';
        showToast("CRITICAL WARNING: 1 more violation will result in disqualification.", 'danger');
        
        setTimeout(() => {
            document.body.classList.remove('freeze-active');
        }, 3000);
        
    } else if (totalWarnings >= 1) {
        document.body.classList.add('warning-active');
        showToast("Notice: Activity Recorded (" + violationType + ")", 'warning');
    }
}

async function submitExam(isAutoSubmit = false) {
    clearInterval(timerInterval);
    
    const stream = document.getElementById('webcam') ? document.getElementById('webcam').srcObject : null;
    if (stream) stream.getTracks().forEach(track => track.stop());

    try {
        await fetch(`/api/student/exam/${activeExamContext.attemptId}/submit`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ autoSubmit: isAutoSubmit })
        });
        
        localStorage.removeItem('activeExam');

        if (isAutoSubmit) {
             alert("System terminated this attempt due to protocol violations.");
             logout(); 
        } else {
             document.getElementById('exam-container').innerHTML = `
                <div class="card">
                    <h1 style="color:var(--success)">Exam Successfully Captured</h1>
                    <p>Institutional record has been finalized.</p>
                    <button onclick="window.location.href='student.html'" style="margin-top:20px;">Return to Portal</button>
                </div>
             `;
        }
    } catch (e) {
        console.warn("Session sync failed:", e);
        showToast("Session sync interrupted. Retrying...", 'warning');
    }
}

function updateWarningUI(violationType) {
    document.body.classList.remove('warning-active');
    document.body.classList.remove('freeze-active');
    
    if (totalWarnings === 4) {
        document.body.classList.add('freeze-active');
        const banner = document.getElementById('global-warning-banner');
        if (banner) banner.style.display = 'block';
        showToast("CRITICAL WARNING: 1 more violation will result in disqualification.", 'danger');
        
        setTimeout(() => {
            document.body.classList.remove('freeze-active');
        }, 3000);
        
    } else if (totalWarnings >= 1) {
        document.body.classList.add('warning-active');
        showToast("Notice: Activity Recorded (" + violationType + ")", 'warning');
    }
}
async function setupWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        document.getElementById('webcam').srcObject = stream;
    } catch (err) {
        // Fallback for no camera
        logViolationUIUpdate("Webcam Access Denied", 5);
        showToast("Webcam is mandatory for this institutional exam.", "danger");
    }
}
