document.addEventListener('DOMContentLoaded', function () {

    // ================= MOBILE MENU TOGGLE LOGIC =================
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const navbar = document.querySelector('.navbar'); // Used for checking clicks outside

    // Function to close the menu
    function closeMenu() {
        if (hamburger && navLinks) {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
        }
    }

    if (hamburger && navLinks) {
        // 1. Toggle the menu when the hamburger is clicked
        hamburger.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevents the document click listener from immediately closing it
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
        });

        // 2. Close menu when clicking on a link
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', closeMenu);
        });

        // 3. Close menu when clicking outside the navbar area
        document.addEventListener('click', (e) => {
            if (navbar && !e.target.closest('.navbar')) {
                closeMenu();
            }
        });
    }


    // ================= PROJECT CARD EXPANSION LOGIC =================
    // Select all "Read More" buttons
    const readMoreButtons = document.querySelectorAll('.read-more-btn');

    readMoreButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent the default link action (e.g., page jump)

            // Find the closest card container, then find the specific description paragraph inside it
            // We search for the container first to scope the selector
            const card = button.closest('.card');
            const description = card ? card.querySelector('.project-description') : null;

            // NOTE: The original code used .project-description-container which may not exist 
            // if the HTML structure is just .card > .card-content > .project-description.
            // Using `card.querySelector('.project-description')` is often more reliable
            // if the description is a direct child of the card or its immediate content wrapper.

            if (description) {
                // Toggle the 'expanded' class on the description paragraph
                description.classList.toggle('expanded');

                // Change the button text
                if (description.classList.contains('expanded')) {
                    button.textContent = 'Read Less';
                } else {
                    button.textContent = 'Read More';
                }
            }
        });
    });


    // ================= NAVBAR TRANSPARENCY ON SCROLL =================
    if (navbar) {
        // Function to handle scroll-based transparency
        const handleScroll = () => {
            if (window.scrollY > 50) {
                navbar.classList.add('transparent');
            } else {
                navbar.classList.remove('transparent');
            }
        };

        // Run once on load to set initial state
        handleScroll();

        // Add scroll listener
        window.addEventListener('scroll', handleScroll);
    }


    // ================= MAIN HERO CAROUSEL (INDEX PAGE ONLY) =================
    const carouselContainer = document.querySelector('.carousel');

    if (carouselContainer) {
        let slides = carouselContainer.querySelectorAll('.carousel-slide');
        let currentSlide = 0;
        const prevBtn = carouselContainer.querySelector('.carousel-controls .prev');
        const nextBtn = carouselContainer.querySelector('.carousel-controls .next');

        function showSlide(index) {
            slides.forEach((slide) => slide.classList.remove('active'));
            // Ensure the slide at the given index exists before trying to add a class
            if (slides[index]) {
                slides[index].classList.add('active');
            }
        }

        if (nextBtn && prevBtn && slides.length > 0) {
            // Next button logic
            nextBtn.addEventListener('click', () => {
                currentSlide = (currentSlide + 1) % slides.length;
                showSlide(currentSlide);
            });

            // Previous button logic
            prevBtn.addEventListener('click', () => {
                currentSlide = (currentSlide - 1 + slides.length) % slides.length;
                showSlide(currentSlide);
            });

            // Auto slide every 5 seconds
            setInterval(() => {
                currentSlide = (currentSlide + 1) % slides.length;
                showSlide(currentSlide);
            }, 5000);
        }

        // Initial show of the first slide (which should already have the 'active' class from EJS, but this guarantees it)
        showSlide(currentSlide);
    }


    // ================= SMALL PROJECT CAROUSEL FUNCTIONALITY (PROJECT PAGE ONLY) =================
    document.querySelectorAll('.project-carousel').forEach(carousel => {
        let imgs = carousel.querySelectorAll('img');

        // Only run carousel logic if there's more than one image
        if (imgs.length > 1) {
            let index = 0;

            const showImg = i => {
                imgs.forEach(img => img.classList.remove('active'));
                imgs[i].classList.add('active');
            };

            const prevBtn = carousel.querySelector('.prev');
            const nextBtn = carousel.querySelector('.next');

            if (prevBtn && nextBtn) {
                prevBtn.addEventListener('click', () => {
                    index = (index - 1 + imgs.length) % imgs.length;
                    showImg(index);
                });

                nextBtn.addEventListener('click', () => {
                    index = (index + 1) % imgs.length;
                    showImg(index);
                });
            }
            // Initial call to set the first image as active (if not already set in EJS)
            showImg(index);
        } else {
            // Hide controls if there's only one image
            const prevBtn = carousel.querySelector('.prev');
            const nextBtn = carousel.querySelector('.next');
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
        }
    });


    // ================= SMOOTH SCROLLING FOR ANCHOR LINKS (REVISED) =================
    // Selects links that point to the current page's root AND have a hash, 
    // OR links that just start with a hash (e.g., /#about, #contact)
    document.querySelectorAll('a[href*="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {

            // Extract the href value (e.g., "/#about" or "#foot")
            const fullHref = this.getAttribute('href');

            // 1. Determine if this link is intended for smooth scrolling on the current page.
            // It should start with a hash OR the current path + a hash.
            const isInternalAnchor = fullHref.startsWith('#') ||
                (fullHref.startsWith('/') && fullHref.includes('#'));

            if (!isInternalAnchor) return;

            // 2. Get the target ID (e.g., '#about' or '#foot')
            // This handles cases like "/#about" -> splits by #, takes the second part -> "about" -> then adds # -> "#about"
            const targetId = fullHref.includes('#') ? '#' + fullHref.split('#').pop() : fullHref;

            // Exit if the target is just "#" alone
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                e.preventDefault(); // Only prevent default if we found a valid target!

                // Offset by 60px (used 60px as the navbar height is 60px in the CSS)
                // You had 80px, but 60px matches the CSS provided earlier.
                const navbarHeight = 60;

                window.scrollTo({
                    top: targetElement.offsetTop - navbarHeight,
                    behavior: 'smooth'
                });

                // Optional: Close the mobile menu after clicking a link
                // if you think they might click one on mobile
                closeMenu();
            }
        });
    });

});