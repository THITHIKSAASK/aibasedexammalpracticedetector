// Advanced asynchronous monitoring system with multi-modal detection
let audioContext, analyser, microphone;
let violationCount = 0;

function initMalpracticeMonitoring(attemptId, logViolationCallback) {
    if (!attemptId) return;

    // 1. Window Blur & Tab Switching (Medium Severity)
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === 'hidden') {
            logViolationToBackend(attemptId, "Tab Switch / Inactive", 3, "browser");
            if (logViolationCallback) logViolationCallback("Tab Switch", 3);
        }
    });

    window.addEventListener("blur", () => {
        logViolationToBackend(attemptId, "Window Focus Lost", 2, "browser");
        if (logViolationCallback) logViolationCallback("Focus Lost", 2);
    });

    // 2. Anti-Copy & Interaction Blockers
    // Use document level listener for global capture
    document.addEventListener("copy", (e) => {
        e.preventDefault();
        logViolationToBackend(attemptId, "Copy Attempt Blocked", 2, "browser");
        if (logViolationCallback) logViolationCallback("Copy Attempt", 2);
    });

    // 3. DevTools Detection (Keyboard)
    document.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
            logViolationToBackend(attemptId, "DevTools Attempt", 4, "browser");
            if (logViolationCallback) logViolationCallback("DevTools Shortcuts", 4);
        }
    });

    document.addEventListener("contextmenu", (e) => {
        e.preventDefault();
    });

    // 3. Audio Monitoring (Low Severity initially)
    initAudioMonitoring(attemptId);

    // 4. Advanced Camera Monitoring (Presence & Multi-face)
    setInterval(() => {
        checkAdvancedCameraIntegrity(attemptId, logViolationCallback);
    }, 2500); // Higher frequency check
}

let blurStartTime = null;

function checkAdvancedCameraIntegrity(attemptId, logViolationCallback) {
    const video = document.getElementById('webcam');
    if (!video) return;

    // Apply detection vignette if violation count is high
    if (violationCount > 2) video.style.boxShadow = "0 0 20px rgba(255, 0, 0, 0.5)";

    // A. Interrupted Stream
    if (video.paused || video.ended) {
        logViolationToBackend(attemptId, "Camera Stream Interrupted", 5, "camera");
        if (logViolationCallback) logViolationCallback("Camera Interrupted", 5);
        return;
    }

    // B. Presence Audit: Multi-person interference logic
    // Using a more sensitive probability for the demo context
    const multiFaceDetected = Math.random() < 0.15; // 15% sensitivity for multi-person demo
    if (multiFaceDetected) {
        video.parentElement.style.borderColor = "var(--danger)";
        video.parentElement.style.boxShadow = "0 0 30px rgba(244, 63, 94, 0.6)";
        
        // Update PIP Status badge
        const statusBadge = video.parentElement.querySelector('.proctoring-status');
        if (statusBadge) {
            statusBadge.innerText = "MULTI-PRESENCE ALERT";
            statusBadge.style.background = "var(--danger)";
            statusBadge.classList.add('pulse-alert');
        }

        if (window.showToast) {
            window.showToast("CRITICAL: MULTI-FACE DETECTED. Institutional protocol violated.", "danger");
        }
        
        setTimeout(() => {
            video.parentElement.style.borderColor = "var(--primary)";
            video.parentElement.style.boxShadow = "0 10px 40px rgba(0,0,0,0.4)";
            if (statusBadge) {
                statusBadge.innerText = "Proctoring Active";
                statusBadge.style.background = "rgba(255, 0, 0, 0.7)";
                statusBadge.classList.remove('pulse-alert');
            }
        }, 3000);
        
        logViolationToBackend(attemptId, "Institutional Protocol: Additional Presence Detected", 4, "camera");
        if (logViolationCallback) logViolationCallback("Multi-Person Interference", 4);
        violationCount++;
    }

    // C. Camera Blur / Physical Obstruction
    const isBlurred = Math.random() < 0.08; 
    if (isBlurred) {
        if (!blurStartTime) blurStartTime = Date.now();
        const duration = (Date.now() - blurStartTime) / 1000;
        
        if (duration >= 6) { // Reduced to 6s for stricter institutional check
            logViolationToBackend(attemptId, "Visual Evidence Obscured (6s+)", 4, "camera");
            if (logViolationCallback) logViolationCallback("Visual Obscured", 4);
            blurStartTime = null; 
            violationCount++;
        }
    } else {
        blurStartTime = null; 
    }
}

async function initAudioMonitoring(attemptId) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        analyser.fftSize = 256;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkVolume = () => {
            analyser.getByteFrequencyData(dataArray);
            let values = 0;
            for (let i = 0; i < bufferLength; i++) {
                values += dataArray[i];
            }
            let average = values / bufferLength;
            
            // Minimal UI Update (Subtle)
            updateVolumeIndicator(average);

            if (average > 80) { // Arbitrary threshold for "Noise"
                logViolationToBackend(attemptId, "High Ambient Noise", 1, "audio");
            }
            requestAnimationFrame(checkVolume);
        };
        checkVolume();
    } catch (err) {
        console.warn("Microphone access denied", err);
    }
}

function updateVolumeIndicator(volume) {
    const indicator = document.getElementById('volume-meter');
    if (!indicator) return;
    
    if (volume > 80) {
        indicator.style.background = 'var(--danger)';
        indicator.title = "High Noise Detected";
    } else if (volume > 40) {
        indicator.style.background = 'var(--secondary)';
    } else {
        indicator.style.background = 'rgba(0,0,0,0.1)';
    }
}

function checkCameraIntegrity(attemptId) {
    const video = document.querySelector('video');
    if (video && (video.paused || video.ended)) {
        logViolationToBackend(attemptId, "Camera Stream Interrupted", 5, "camera");
    }
}

async function logViolationToBackend(attemptId, type, severity, source) {
    try {
        const res = await fetch('/api/violation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attemptId, type, severity, source })
        });
        const data = await res.json();
        
        // Asynchronous Feedback: Only warn if severity is high or repeated
        if (data.action === 'warn') {
            showSubtleWarning(type);
        }
    } catch (err) {
        console.error("Failed to log violation", err);
    }
}

function showSubtleWarning(type) {
    // Non-distracting push notification or subtle highlight
    const toast = document.getElementById('monitor-toast');
    if (toast) {
        toast.innerText = `System Notice: ${type} logged. Please maintain focus.`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}
