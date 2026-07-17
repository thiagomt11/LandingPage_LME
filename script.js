'use strict';

const HERO_FRAME_COUNT = 121;
const HERO_FRAME_PATH = 'assets/hero-frames';
const HERO_PRELOAD_RADIUS = 6;
const MAX_CONCURRENT_FRAME_LOADS = 6;
const MAX_CANVAS_PIXEL_RATIO = 2;
const NAVBAR_SCROLL_THRESHOLD = 50;

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

document.addEventListener('DOMContentLoaded', initializePage);

function initializePage() {
    const heroCanvas = document.getElementById('hero-canvas');
    const heroSequence = document.getElementById('video-sequence');

    setupHeroFrameScroll(heroCanvas, heroSequence);
    setupTitleReveal();
    setupNavbar();
    setupComparisonReveal();
}

function setupTitleReveal() {
    gsap.fromTo(
        '.title-reveal',
        { y: 50, opacity: 0 },
        {
            y: 0,
            opacity: 1,
            duration: 1.5,
            ease: 'power4.out',
            stagger: 0.2
        }
    );
}

function setupNavbar() {
    const navbar = document.getElementById('navbar');

    if (!navbar) return;

    const updateNavbarState = () => {
        navbar.classList.toggle(
            'is-scrolled',
            window.scrollY > NAVBAR_SCROLL_THRESHOLD
        );
    };

    updateNavbarState();
    window.addEventListener('scroll', updateNavbarState, { passive: true });
}

function setupComparisonReveal() {
    const section = document.querySelector('.comparison-section');

    if (!section) return;

    const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion) {
        section.classList.add('is-visible');
        return;
    }

    const timeline = gsap.timeline({
        scrollTrigger: {
            trigger: section,
            start: 'top 72%',
            once: true
        }
    });

    timeline
        .fromTo(
            '.comparison-header > *',
            { y: 28, opacity: 0 },
            {
                y: 0,
                opacity: 1,
                duration: 0.75,
                stagger: 0.1,
                ease: 'power3.out'
            }
        )
        .fromTo(
            '.comparison-card--advantages',
            { x: -56, y: 20, opacity: 0, rotateY: -3 },
            {
                x: 0,
                y: 0,
                opacity: 1,
                rotateY: 0,
                duration: 0.9,
                ease: 'power3.out'
            },
            '-=0.35'
        )
        .fromTo(
            '.comparison-card--disadvantages',
            { x: 56, y: 20, opacity: 0, rotateY: 3 },
            {
                x: 0,
                y: 0,
                opacity: 1,
                rotateY: 0,
                duration: 0.9,
                ease: 'power3.out'
            },
            '<0.1'
        )
        .fromTo(
            '.comparison-list li',
            { y: 18, opacity: 0 },
            {
                y: 0,
                opacity: 1,
                duration: 0.55,
                stagger: 0.075,
                ease: 'power2.out'
            },
            '-=0.5'
        )
        .add(() => section.classList.add('is-visible'));
}

function setupHeroFrameScroll(canvas, container) {
    if (!canvas || !container) return;

    const context = canvas.getContext('2d', { alpha: false });

    if (!context) return;

    const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    ).matches;
    const frames = Array.from({ length: HERO_FRAME_COUNT }, () => ({
        image: null,
        job: null,
        promise: null,
        status: 'idle'
    }));
    const loadQueue = [];

    let activeLoads = 0;
    let desiredFrameIndex = 0;
    let renderedFrameIndex = -1;
    let animationFrameId = 0;
    let forceRedraw = false;

    const clampFrameIndex = (index) =>
        Math.min(HERO_FRAME_COUNT - 1, Math.max(0, index));

    const getFrameUrl = (index) =>
        `${HERO_FRAME_PATH}/frame-${String(index).padStart(3, '0')}.webp`;

    const progressToFrameIndex = (progress) =>
        clampFrameIndex(Math.round(progress * (HERO_FRAME_COUNT - 1)));

    // Starts only a small number of image requests at once to avoid saturating the browser.
    function processLoadQueue() {
        while (
            activeLoads < MAX_CONCURRENT_FRAME_LOADS &&
            loadQueue.length > 0
        ) {
            const job = loadQueue.shift();

            activeLoads += 1;
            job.start();
        }
    }

    function prioritizeQueuedFrame(index) {
        const queuePosition = loadQueue.findIndex((job) => job.index === index);

        if (queuePosition <= 0) return;

        const [job] = loadQueue.splice(queuePosition, 1);
        loadQueue.unshift(job);
    }

    function loadFrame(index, priority = false) {
        const safeIndex = clampFrameIndex(index);
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
                    const image = new Image();

                    frame.status = 'loading';
                    image.decoding = 'async';

                    image.onload = async () => {
                        if (image.decode) {
                            await image.decode().catch(() => null);
                        }

                        frame.image = image;
                        frame.status = 'loaded';
                        activeLoads -= 1;

                        resolve(image);
                        processLoadQueue();
                        requestRender();
                    };

                    image.onerror = () => {
                        frame.status = 'error';
                        activeLoads -= 1;

                        reject(new Error(`Unable to load hero frame ${safeIndex}`));
                        processLoadQueue();
                    };

                    image.src = getFrameUrl(safeIndex);
                }
            };

            if (priority) {
                loadQueue.unshift(frame.job);
            } else {
                loadQueue.push(frame.job);
            }

            processLoadQueue();
        });

        return frame.promise;
    }

    function resizeCanvas() {
        const pixelRatio = Math.min(
            window.devicePixelRatio || 1,
            MAX_CANVAS_PIXEL_RATIO
        );
        const width = Math.max(1, Math.ceil(canvas.clientWidth * pixelRatio));
        const height = Math.max(1, Math.ceil(canvas.clientHeight * pixelRatio));

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    // Draws the image using the same crop behavior as object-fit: cover.
    function drawFrameCover(image) {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const scale = Math.max(
            width / image.naturalWidth,
            height / image.naturalHeight
        );
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        const drawX = (width - drawWidth) / 2;
        const drawY = (height - drawHeight) / 2;

        resizeCanvas();
        context.clearRect(0, 0, width, height);
        context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    }

    // Keeps a nearby loaded frame visible while the exact target is still decoding.
    function findNearestLoadedFrame(index) {
        for (let offset = 0; offset < HERO_FRAME_COUNT; offset += 1) {
            const previousFrame = frames[index - offset];
            const nextFrame = frames[index + offset];

            if (previousFrame?.status === 'loaded') return index - offset;
            if (nextFrame?.status === 'loaded') return index + offset;
        }

        return -1;
    }

    function preloadAdjacentFrames(index) {
        for (let offset = 0; offset <= HERO_PRELOAD_RADIUS; offset += 1) {
            loadFrame(index + offset, true).catch(() => null);

            if (offset > 0) {
                loadFrame(index - offset, true).catch(() => null);
            }
        }
    }

    // Coalesces rapid scroll updates into one canvas draw per animation frame.
    function requestRender() {
        if (animationFrameId) return;

        animationFrameId = requestAnimationFrame(() => {
            animationFrameId = 0;
            renderFrame();
        });
    }

    function renderFrame() {
        const desiredFrame = frames[desiredFrameIndex];

        if (desiredFrame.status !== 'loaded') {
            loadFrame(desiredFrameIndex, true).catch(() => null);
            preloadAdjacentFrames(desiredFrameIndex);
        }

        const frameIndexToRender =
            desiredFrame.status === 'loaded'
                ? desiredFrameIndex
                : findNearestLoadedFrame(desiredFrameIndex);

        const frameAlreadyRendered =
            frameIndexToRender === renderedFrameIndex && !forceRedraw;

        if (frameIndexToRender === -1 || frameAlreadyRendered) return;

        drawFrameCover(frames[frameIndexToRender].image);
        renderedFrameIndex = frameIndexToRender;
        forceRedraw = false;
        canvas.classList.add('is-ready');
    }

    function requestResizeRender() {
        forceRedraw = true;
        requestRender();
    }

    function setDesiredFrame(index) {
        desiredFrameIndex = clampFrameIndex(index);
        preloadAdjacentFrames(desiredFrameIndex);
        requestRender();
    }

    // The first frame activates the canvas. The remaining frames load progressively.
    loadFrame(0, true)
        .then(() => {
            setDesiredFrame(0);

            if (prefersReducedMotion) return;

            const heroScrollTrigger = ScrollTrigger.create({
                trigger: container,
                start: 'top top',
                end: 'bottom bottom',
                invalidateOnRefresh: true,
                onUpdate: ({ progress }) => {
                    setDesiredFrame(progressToFrameIndex(progress));
                }
            });

            setDesiredFrame(progressToFrameIndex(heroScrollTrigger.progress));
            loadFrame(HERO_FRAME_COUNT - 1, true).catch(() => null);

            for (let index = 1; index < HERO_FRAME_COUNT - 1; index += 1) {
                loadFrame(index).catch(() => null);
            }
        })
        .catch((error) => {
            console.warn(error);
        });

    window.addEventListener('resize', requestResizeRender, { passive: true });
}

function triggerSunTransition() {
    const flashOverlay = document.getElementById('sun-flash');

    if (!flashOverlay) return;

    const timeline = gsap.timeline();

    timeline
        .to(flashOverlay, {
            opacity: 1,
            duration: 0.2,
            ease: 'power2.in'
        })
        .add(() => {
            gsap.to(window, {
                duration: 0,
                scrollTo: { y: '#budget', offsetY: 50 }
            });
        })
        .to(flashOverlay, {
            opacity: 0,
            duration: 0.8,
            ease: 'power2.out',
            delay: 0
        });
}

window.triggerSunTransition = triggerSunTransition;
