const fs = require('fs');

try {
    let content = fs.readFileSync('frontend/css/styles.css', 'utf8');
    let utf16Content = fs.readFileSync('frontend/css/styles.css', 'utf16le');

    // Clean it out by finding the index of the broken comment or normal comment
    let targetIndex = content.lastIndexOf('/* Institutional Modal System');
    if (targetIndex === -1) targetIndex = content.lastIndexOf('I n s t i t u t i o n a l');
    
    // Find a good place to cut
    let cleanContent = content;
    if (targetIndex > -1) {
        // Cut significantly before it, we'll restore it manually
        cleanContent = content.substring(0, targetIndex - 50);
    }
    
    // Wipe null bytes perfectly using regex to remove any trailing junk
    cleanContent = cleanContent.replace(/\\x00/g, '');

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

    fs.writeFileSync('frontend/css/styles.css', cleanContent + modalCSS, 'utf8');
    console.log('Successfully repaired styles.css');
} catch (err) {
    console.error(err);
}
