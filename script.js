// GSAP & ScrollTrigger Setup
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

document.addEventListener("DOMContentLoaded", () => {

    // --- 1. Video Scroll-Jacking ---
    const video = document.getElementById('hero-video');
    const videoContainer = document.getElementById('video-sequence');

    // Make sure the video is loaded enough to know its duration
    video.addEventListener('loadedmetadata', function () {
        setupVideoScroll(video);
    });

    // Fallback if metadata is already loaded (cached)
    if (video.readyState >= 1) {
        setupVideoScroll(video);
    }

    function setupVideoScroll(vid) {
        // Tie video's currentTime to scroll progress of the container
        ScrollTrigger.create({
            trigger: videoContainer,
            start: "top top",
            end: "bottom bottom",
            scrub: true, // Smooth scrubbing
            onUpdate: self => {
                // Update video time based on scroll progress (0 to 1)
                vid.currentTime = vid.duration * self.progress;
            }
        });
    }

    // --- 2. Title Reveal ---
    gsap.fromTo(".title-reveal",
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.5, ease: "power4.out", stagger: 0.2 }
    );

    // --- 3. Navbar Background Scroll Effect ---
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('bg-dark/80');
            navbar.classList.remove('bg-dark/40');
        } else {
            navbar.classList.add('bg-dark/40');
            navbar.classList.remove('bg-dark/80');
        }
    });
});

// --- 4. Sun Flash Transition to Budget Section ---
window.triggerSunTransition = function () {
    const flash = document.getElementById('sun-flash');

    const tl = gsap.timeline();

    // Bright flash expanding
    tl.to(flash, {
        opacity: 1,
        duration: 0.4,
        ease: "power2.in"
    })
        // Immediately scroll to budget section while blinded
        .add(() => {
            gsap.to(window, {
                duration: 0,
                scrollTo: { y: "#budget", offsetY: 50 }
            });
        })
        // Gently fade out the flash
        .to(flash, {
            opacity: 0,
            duration: 1.5,
            ease: "power2.out",
            delay: 0.1
        });
};
