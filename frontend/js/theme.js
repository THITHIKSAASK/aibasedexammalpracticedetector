document.addEventListener('DOMContentLoaded', () => {
    const isLight = localStorage.getItem('theme') === 'light';
    if (isLight) {
        document.body.classList.add('light-mode');
    }
});

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    
    // Optional: Only update text if it's not a generic emoji button
    const btn = document.querySelector('.theme-toggle');
    if (btn && btn.innerText !== '🌓') {
        btn.innerText = isLight ? '🌙' : '☀️';
    }
}
