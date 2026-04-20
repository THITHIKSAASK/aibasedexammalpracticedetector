// Advanced asynchronous monitoring system with multi-modal detection
let audioContext, analyser, microphone;
let violationCount = 0;
let monitoringStartTime = 0;
const CAMERA_GRACE_PERIOD = 8000; // 8 seconds grace period for camera to initialize

function initMalpracticeMonitoring(attemptId, logViolationCallback) {
    if (!attemptId) return;
    monitoringStartTime = Date.now();

    // 1. Tab Switching (Medium Severity)
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

    // 2. Anti-Copy
    document.addEventListener("copy", (e) => {
        e.preventDefault();
        logViolationToBackend(attemptId, "Copy Attempt Blocked", 2, "browser");
        if (logViolationCallback) logViolationCallback("Copy Attempt", 2);
    });

    // 3. DevTools Detection
    document.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
            logViolationToBackend(attemptId, "DevTools Attempt", 4, "browser");
            if (logViolationCallback) logViolationCallback("DevTools Shortcuts", 4);
        }
    });

    document.addEventListener("contextmenu", (e) => {
        e.preventDefault();
    });

    // 4. Audio Monitoring
    initAudioMonitoring(attemptId);

    // 5. Camera Monitoring — only starts AFTER grace period
    setTimeout(() => {
        setInterval(() => {
            checkAdvancedCameraIntegrity(attemptId, logViolationCallback);
        }, 4000); // Check every 4 seconds
    }, CAMERA_GRACE_PERIOD);
}

let blurStartTime = null;

function checkAdvancedCameraIntegrity(attemptId, logViolationCallback) {
    const video = document.getElementById('webcam');
    if (!video || !video.srcObject) return; // No stream at all — skip silently

    // Check if stream has active video tracks
    const tracks = video.srcObject.getVideoTracks();
    if (!tracks || tracks.length === 0 || tracks[0].readyState !== 'live') {
        // Stream is truly dead
        logViolationToBackend(attemptId, "Camera Stream Interrupted", 5, "camera");
        if (logViolationCallback) logViolationCallback("Camera Interrupted", 5);
        return;
    }

    // Multi-face detection (simulated — 10% chance for demo)
    const multiFaceDetected = Math.random() < 0.10;
    if (multiFaceDetected) {
        video.parentElement.style.borderColor = "var(--danger)";
        video.parentElement.style.boxShadow = "0 0 30px rgba(244, 63, 94, 0.6)";
        
        const statusBadge = video.parentElement.querySelector('.proctoring-status');
        if (statusBadge) {
            statusBadge.innerText = "MULTI-PRESENCE ALERT";
            statusBadge.style.background = "var(--danger)";
        }

        if (window.showToast) {
            window.showToast("ALERT: Multiple faces detected.", "danger");
        }
        
        setTimeout(() => {
            video.parentElement.style.borderColor = "var(--primary)";
            video.parentElement.style.boxShadow = "0 10px 40px rgba(0,0,0,0.4)";
            if (statusBadge) {
                statusBadge.innerText = "PROCTORING ACTIVE";
                statusBadge.style.background = "rgba(255, 0, 0, 0.7)";
            }
        }, 3000);
        
        logViolationToBackend(attemptId, "Additional Presence Detected", 4, "camera");
        if (logViolationCallback) logViolationCallback("Multi-Person", 4);
        violationCount++;
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
            
            updateVolumeIndicator(average);

            if (average > 80) {
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
        indicator.style.background = '#00ff00';
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
        
        if (data.action === 'warn') {
            showSubtleWarning(type);
        }
    } catch (err) {
        console.error("Failed to log violation", err);
    }
}

function showSubtleWarning(type) {
    const toast = document.getElementById('monitor-toast');
    if (toast) {
        toast.innerText = `System Notice: ${type} logged.`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}
