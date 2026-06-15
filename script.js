// GSAP & ScrollTrigger Setup
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

document.addEventListener("DOMContentLoaded", () => {

    // --- 1. Canvas Video Scroll Sequence ---
    const heroCanvas = document.getElementById('hero-canvas');
    const videoContainer = document.getElementById('video-sequence');

    setupHeroFrameScroll(heroCanvas, videoContainer);

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

function setupHeroFrameScroll(canvas, container) {
    if (!canvas || !container) return;

    const FRAME_COUNT = 121;
    const MAX_CONCURRENT_LOADS = 6;
    const FRAME_BASE_PATH = 'assets/hero-frames';
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const context = canvas.getContext('2d', { alpha: false });
    const frames = Array.from({ length: FRAME_COUNT }, () => ({
        image: null,
        job: null,
        promise: null,
        status: 'idle'
    }));
    const queue = [];

    let activeLoads = 0;
    let desiredFrame = 0;
    let drawnFrame = -1;
    let rafId = 0;
    let forceRedraw = false;

    const frameUrl = (index) => `${FRAME_BASE_PATH}/frame-${String(index).padStart(3, '0')}.webp`;
    const clampFrame = (index) => Math.min(FRAME_COUNT - 1, Math.max(0, index));
    const progressToFrame = (progress) => clampFrame(Math.round(progress * (FRAME_COUNT - 1)));

    function pumpQueue() {
        while (activeLoads < MAX_CONCURRENT_LOADS && queue.length) {
            const job = queue.shift();
            activeLoads += 1;
            job.start();
        }
    }

    function prioritizeQueuedFrame(index) {
        const position = queue.findIndex((job) => job.index === index);
        if (position <= 0) return;

        const [job] = queue.splice(position, 1);
        queue.unshift(job);
    }

    function loadFrame(index, priority = false) {
        const safeIndex = clampFrame(index);
        const frame = frames[safeIndex];

        if (frame.status === 'loaded' || frame.status === 'loading') {
            return frame.promise;
        }

        if (frame.status === 'queued') {
            if (priority) prioritizeQueuedFrame(safeIndex);
            return frame.promise;
        }

        frame.status = 'queued';
        frame.promise = new Promise((resolve, reject) => {
            frame.job = {
                index: safeIndex,
                start: () => {
                    frame.status = 'loading';

                    const image = new Image();
                    image.decoding = 'async';

                    image.onload = () => {
                        const decode = image.decode ? image.decode().catch(() => null) : Promise.resolve();

                        decode.then(() => {
                            frame.image = image;
                            frame.status = 'loaded';
                            activeLoads -= 1;
                            resolve(image);
                            pumpQueue();
                            requestDraw();
                        });
                    };

                    image.onerror = () => {
                        frame.status = 'error';
                        activeLoads -= 1;
                        reject(new Error(`Unable to load hero frame ${safeIndex}`));
                        pumpQueue();
                    };

                    image.src = frameUrl(safeIndex);
                }
            };

            if (priority) {
                queue.unshift(frame.job);
            } else {
                queue.push(frame.job);
            }

            pumpQueue();
        });

        return frame.promise;
    }

    function resizeCanvas() {
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.ceil(canvas.clientWidth * pixelRatio));
        const height = Math.max(1, Math.ceil(canvas.clientHeight * pixelRatio));

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    function drawCover(image) {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        const drawX = (width - drawWidth) / 2;
        const drawY = (height - drawHeight) / 2;

        resizeCanvas();
        context.clearRect(0, 0, width, height);
        context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    }

    function nearestLoadedFrame(index) {
        for (let offset = 0; offset < FRAME_COUNT; offset += 1) {
            const before = frames[index - offset];
            const after = frames[index + offset];

            if (before?.status === 'loaded') return index - offset;
            if (after?.status === 'loaded') return index + offset;
        }

        return -1;
    }

    function warmFrameWindow(index) {
        for (let offset = 0; offset <= 6; offset += 1) {
            loadFrame(index + offset, true).catch(() => null);
            if (offset > 0) loadFrame(index - offset, true).catch(() => null);
        }
    }

    function requestDraw() {
        if (rafId) return;

        rafId = requestAnimationFrame(() => {
            rafId = 0;
            renderFrame();
        });
    }

    function renderFrame() {
        const frame = frames[desiredFrame];

        if (frame.status !== 'loaded') {
            loadFrame(desiredFrame, true).catch(() => null);
            warmFrameWindow(desiredFrame);
        }

        const renderIndex = frame.status === 'loaded'
            ? desiredFrame
            : nearestLoadedFrame(desiredFrame);

        if (renderIndex === -1 || (renderIndex === drawnFrame && !forceRedraw)) return;

        drawCover(frames[renderIndex].image);
        drawnFrame = renderIndex;
        forceRedraw = false;
        canvas.classList.add('is-ready');
    }

    function requestResizeDraw() {
        forceRedraw = true;
        requestDraw();
    }

    function setDesiredFrame(index) {
        desiredFrame = clampFrame(index);
        warmFrameWindow(desiredFrame);
        requestDraw();
    }

    loadFrame(0, true)
        .then(() => {
            setDesiredFrame(0);

            if (prefersReducedMotion) return;

            const heroTrigger = ScrollTrigger.create({
                trigger: container,
                start: "top top",
                end: "bottom bottom",
                invalidateOnRefresh: true,
                onUpdate: (self) => {
                    setDesiredFrame(progressToFrame(self.progress));
                }
            });

            setDesiredFrame(progressToFrame(heroTrigger.progress));
            loadFrame(FRAME_COUNT - 1, true).catch(() => null);

            for (let index = 1; index < FRAME_COUNT - 1; index += 1) {
                loadFrame(index).catch(() => null);
            }
        })
        .catch((error) => {
            console.warn(error);
        });

    window.addEventListener('resize', requestResizeDraw, { passive: true });
}

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
