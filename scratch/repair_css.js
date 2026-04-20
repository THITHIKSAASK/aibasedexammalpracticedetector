const fs = require('fs');
const path = 'frontend/css/styles.css';

try {
    const buf = fs.readFileSync(path);
    // Find where the corruption starts (the null bytes or the first I n s t i t u t i o n a l string)
    let index = buf.indexOf(0); 
    
    // If no null byte, look for the first instance of 'I n s t' pattern common in UTF-16
    if (index === -1) {
        const text = buf.toString('latin1');
        index = text.indexOf('I\u0000n\u0000s\u0000t');
    }

    if (index === -1) {
        // Look for the correct tag to replace if somehow it's not null-corrupted but duplicate
        const normalText = buf.toString('utf8');
        index = normalText.indexOf('/* Institutional Modal System */');
    }

    let cleanText = "";
    if (index > -1) {
        cleanText = buf.slice(0, index).toString('utf8').trim();
    } else {
        cleanText = buf.toString('utf8').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '').trim();
    }

    const modalCSS = `

/* Institutional Modal System */
.modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: fadeIn 0.3s ease-out;
}

.modal-content {
    background: var(--card-bg);
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    color: var(--text-color);
    max-width: 400px;
    padding: 30px;
}

.animate-pop {
    animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

@keyframes popIn {
    0% { transform: scale(0.8); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
}

@keyframes fadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
}
`;

    fs.writeFileSync(path, cleanText + modalCSS, 'utf8');
    console.log('STYLESHEET_REPAIRED');
} catch (e) {
    console.error('FAILED_REPAIR:', e.message);
}
