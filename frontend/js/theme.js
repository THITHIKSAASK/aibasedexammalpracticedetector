document.addEventListener('DOMContentLoaded', () => {
    const isLight = localStorage.getItem('theme') === 'light';
    if (isLight) {
        document.body.classList.add('light-mode');
    }
});

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    const btn = document.querySelector('.theme-toggle');
    if (btn) {
        btn.innerText = isDark ? '☀ Light Mode' : '🌙 Dark Mode';
    }
}
