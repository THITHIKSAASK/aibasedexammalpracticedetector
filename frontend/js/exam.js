let currentUser;
let activeExamContext;
let currentScore = 0;
let totalWarnings = 0; 
let examTimer = 0; 
let timerInterval;
let questionsData = [];

window.onload = async () => {
    currentUser = checkAuth(['student']);
    const ctxString = localStorage.getItem('activeExam');
    if (!currentUser || !ctxString) {
        window.location.href = 'student.html';
        return;
    }
    activeExamContext = JSON.parse(ctxString);
    
    // Apply subject-specific theme
    if (activeExamContext.subject) {
        applySubjectTheme(activeExamContext.subject);
    }
    
    document.getElementById('user-display-name').innerText = currentUser.username || currentUser.name || currentUser.email.split('@')[0];
    document.getElementById('welcome-text').innerText = `Exam Active`;
    // Wait for the user to click the enter fullscreen button.
};

window.enterExamFullscreen = async function() {
    try {
        if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) { // Safari
            await document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) { // IE11
            await document.documentElement.msRequestFullscreen();
        }
    } catch(err) {
        console.warn("Could not initiate full screen:", err);
    }

    const gate = document.getElementById('fullscreen-gate');
    if(gate) gate.style.display = 'none';
    
    await setupWebcam();
    
    // Skip verification — go straight to loading questions
    await fetchQuestions();
    initMalpracticeMonitoring(activeExamContext.attemptId, logViolationUIUpdate);
};

function applySubjectTheme(subject) {
    if (!subject) return;
    document.body.classList.add('has-subject-theme');
    document.body.classList.add(`theme-${subject}`);
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
        
        // Use actual exam duration from context, fallback to 120 seconds
        examTimer = activeExamContext.duration || 120; 
        startTimer();

        const container = document.getElementById('dynamic-questions-container');
        container.innerHTML = '';
        
        if (questionsData.length === 0) {
            container.innerHTML = '<p style="color:var(--warning); font-weight:bold;">No questions found for this exam.</p>';
            return;
        }
        
        questionsData.forEach((q, index) => {
            const qDiv = document.createElement('div');
            qDiv.style.marginBottom = '25px';
            qDiv.style.padding = '20px';
            qDiv.style.background = 'rgba(0,0,0,0.05)';
            qDiv.style.borderRadius = '10px';
            qDiv.style.border = '1px solid var(--border-color)';
            
            // Show section title if available
            let sectionLabel = '';
            if (q.section_title && q.section_title !== 'General') {
                sectionLabel = `<span style="font-size:12px; color:var(--primary); text-transform:uppercase; font-weight:700; letter-spacing:1px;">${q.section_title}</span>`;
            }
            
            let html = `${sectionLabel}<h3 style="margin-bottom:12px; margin-top:5px;">Q${index + 1}: ${q.text}</h3>`;
            q.options.forEach((opt) => {
                html += `<label style="display:block; margin-bottom:10px; font-size:16px; cursor:pointer; padding:8px 12px; border-radius:6px; transition:background 0.2s;" 
                          onmouseover="this.style.background='rgba(var(--primary-rgb),0.1)'" 
                          onmouseout="this.style.background='transparent'">
                            <input type="radio" name="q${q.id}" value="${opt}" style="width:auto; margin:0 10px 0 0;"> ${opt}
                         </label>`;
            });
            qDiv.innerHTML = html;
            container.appendChild(qDiv);
        });
    } catch (e) {
        console.error("Failed to fetch questions", e);
        document.getElementById('dynamic-questions-container').innerHTML = 
            '<p style="color:var(--danger); font-weight:bold;">Failed to load questions. Please refresh the page.</p>';
    }
}

function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        examTimer--;
        updateTimerDisplay();
        if (examTimer <= 0) {
            clearInterval(timerInterval);
            submitExam(false); 
        }
    }, 1000);
}

function updateTimerDisplay() {
    const mins = String(Math.floor(examTimer / 60)).padStart(2, '0');
    const secs = String(examTimer % 60).padStart(2, '0');
    const timerDisplay = document.getElementById('timer');
    if (timerDisplay) timerDisplay.innerText = `${mins}:${secs}`;
}

function checkAutoLogout() {
    if (totalWarnings >= 5) {
        submitExam(true); 
    }
}

function updateWarningUI(violationType) {
    const freezeOverlay = document.getElementById('freeze-overlay');
    const banner = document.getElementById('global-warning-banner');
    
    if (totalWarnings === 4) {
        if (freezeOverlay) freezeOverlay.style.display = 'flex';
        if (banner) banner.style.display = 'block';
        showToast("CRITICAL WARNING: 1 more violation = disqualification.", 'danger');
        
        setTimeout(() => {
            if (freezeOverlay) freezeOverlay.style.display = 'none';
        }, 3000);
        
    } else if (totalWarnings >= 1 && totalWarnings < 4) {
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
                    <h1 style="color:var(--success)">Exam Successfully Submitted</h1>
                    <p>Institutional record has been finalized.</p>
                    <button onclick="window.location.href='student.html'" style="margin-top:20px;">Return to Portal</button>
                </div>
             `;
        }
    } catch (e) {
        console.warn("Session sync failed:", e);
        showToast("Session sync interrupted.", 'warning');
    }
}

async function setupWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const video = document.getElementById('webcam');
        video.srcObject = stream;
        
        // Wait for the video metadata to load before playing
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play().then(resolve).catch(resolve);
            };
            // Fallback timeout
            setTimeout(resolve, 3000);
        });
        
        console.log("Webcam initialized successfully.");
    } catch (err) {
        console.warn("Webcam access denied - continuing without camera.", err);
    }
}
