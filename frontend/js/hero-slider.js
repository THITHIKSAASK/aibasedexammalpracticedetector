/**
 * Institutional Hero Background Slider
 * Handles smooth cross-fading of campus imagery for the login portal.
 */
document.addEventListener('DOMContentLoaded', () => {
    const layers = document.querySelectorAll('.hero-bg-layer');
    if (layers.length === 0) return;

    let currentIndex = 0;
    const intervalTime = 7000; // 7 seconds per slide

    function nextSlide() {
        // Remove active class from current
        layers[currentIndex].classList.remove('active');

        // Move to next
        currentIndex = (currentIndex + 1) % layers.length;

        // Add active class to next
        layers[currentIndex].classList.add('active');
    }

    // Initialize rotation
    setInterval(nextSlide, intervalTime);
});
