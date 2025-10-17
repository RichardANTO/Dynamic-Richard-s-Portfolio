// ************************************************
// 0. REQUIRE DOTENV and load environment variables
// ************************************************
require('dotenv').config();

// --- CRITICAL ENVIRONMENT CHECK ---
if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    console.error("FATAL ERROR: ADMIN_USERNAME and ADMIN_PASSWORD must be set in the .env file!");
    process.exit(1);
}
if (!process.env.MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI must be set in the .env file for database persistence!");
    process.exit(1);
}
// 1. ADD CLOUDINARY CHECK
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("FATAL ERROR: Cloudinary credentials (CLOUD_NAME, API_KEY, API_SECRET) must be set in the .env file for persistent file storage!");
    process.exit(1);
}
// --- END CRITICAL CHECK ---


// Import required modules
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
// 2. IMPORT CLOUDINARY LIBRARIES
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Mongoose and utility libraries
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Initialize app
const app = express();

// --- MONGOOSE CONNECTION & SCHEMA CONFIGURATION (from previous step) ---
const MONGO_URI = process.env.MONGO_URI;

// Define the Mongoose Schema for the entire portfolio document
const portfolioSchema = new mongoose.Schema({
    _id: { type: String, default: 'portfolio_data' },
    carousel: Array,
    about: Object,
    projectSummary: Object,
    education: Array,
    certificates: Array,
    gallery: Array,
    projects: Array,
    footerInfo: Object
}, { strict: false });

const Portfolio = mongoose.model('Portfolio', portfolioSchema);
let portfolioData = null;

// --- CLOUDINARY CONFIGURATION (New) ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper function to delete assets from Cloudinary (New)
const deleteCloudinaryAsset = async (publicId) => {
    try {
        if (!publicId) return;
        const result = await cloudinary.uploader.destroy(publicId);
        if (result.result === 'not found') {
            console.warn(`Cloudinary asset not found: ${publicId}`);
        } else if (result.result === 'ok') {
            console.log(`Successfully deleted Cloudinary asset: ${publicId}`);
        } else {
            console.error(`Failed to delete Cloudinary asset ${publicId}:`, result);
        }
    } catch (error) {
        console.error("Cloudinary Deletion Error:", error);
    }
};

// Function to extract the public ID from the Cloudinary URL
// URL format: .../v123456789/folder/filename.ext
// Public ID is: folder/filename
const extractPublicId = (fileUrl) => {
    if (!fileUrl || !fileUrl.includes('cloudinary.com')) {
        return null;
    }

    // This new regex is more robust. It looks for the path segment 
    // immediately after /upload/ (optionally skipping the version 'vXXX/' part)
    // and captures the rest, which is the folder/filename.ext.
    const regex = /\/upload\/(?:v\d+\/)?(.*)/;
    const match = fileUrl.match(regex);

    if (match && match[1]) {
        let publicIdWithExtension = match[1];
        // Remove the file extension (e.g., '.png')
        // Cloudinary only needs the path without the extension for the destroy method.
        return publicIdWithExtension.substring(0, publicIdWithExtension.lastIndexOf('.'));
    }
    return null;
};


// Function to create Cloudinary storage configuration
const createCloudinaryStorage = (folder) => new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: `portfolio/${folder}`, // All files go into a 'portfolio' master folder
        allowed_formats: folder.includes('Pdf') ? ['pdf'] : ['jpg', 'png', 'jpeg'],
        transformation: [{ quality: 'auto', fetch_format: 'auto' }] // Optimization for images
    }
});

// Configure Multer instances using Cloudinary storage
const carouselUpload = multer({ storage: createCloudinaryStorage('Carousel') });
const profilePhotoUpload = multer({ storage: createCloudinaryStorage('Story') });
const certificateUpload = multer({ storage: createCloudinaryStorage('Pdf') });
const galleryUpload = multer({ storage: createCloudinaryStorage('Gallery') });
const projectImageUpload = multer({ storage: createCloudinaryStorage('Project') });
const projectSummaryImageUpload = projectImageUpload;
const educationLogoUpload = multer({ storage: createCloudinaryStorage('Education') });
// --------------------------------------------------------------------------


// Function to connect to DB and load/initialize data (Same as previous step)
const connectDBAndLoadData = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ MongoDB Connected successfully.');

        let data = await Portfolio.findById('portfolio_data');

        if (!data) {
            console.log('⚠️ Portfolio data not found. Initializing with mock data.');
            // This relies on having a data/initialPortfolioData.json file
            // **ACTION REQUIRED: Create a 'data' folder and put your initial JSON structure in 'initialPortfolioData.json'**
            const initialData = require('./data/initialPortfolioData.json');

            data = new Portfolio({
                _id: 'portfolio_data',
                ...initialData
            });
            await data.save();
            console.log('✅ Initial portfolio data saved to MongoDB.');
        }

        portfolioData = data;

    } catch (err) {
        console.error(`❌ DB Connection Error: ${err.message}`);
        process.exit(1);
    }
};

// Middleware and other configurations remain the same...

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- AUTHENTICATION CHECK (MOCK) ---
const isAuthenticated = (req, res, next) => {
    const isMockLoggedIn = app.locals.isLoggedIn === true;
    if (isMockLoggedIn) {
        return next();
    }
    res.redirect('/login');
};

// --- Middleware to ensure data is loaded before rendering pages ---
const ensureDataLoaded = (req, res, next) => {
    if (portfolioData) {
        next();
    } else {
        res.status(503).send('Service Unavailable. Data not loaded.');
    }
}
app.use(ensureDataLoaded);


// ------------------------------------
// --- PUBLIC ROUTES ---
// ------------------------------------
app.get('/', (req, res) => {
    res.render('index', { portfolioData: portfolioData.toObject() });
});
// ... (other public routes) ...
app.get('/projects', (req, res) => {
    res.render('projects', { portfolioData: portfolioData.toObject() });
});
app.get('/certificates', (req, res) => {
    res.render('certificates', { portfolioData: portfolioData.toObject() });
});
app.get('/about', (req, res) => {
    res.render('about', { portfolioData: portfolioData.toObject() });
});

// ------------------------------------
// --- LOGIN & ADMIN ROUTES ---
// ------------------------------------
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// THIS IS THE CRITICAL DEBUGGING ROUTE
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    // 🔑🔑🔑 START DEBUGGING LINES 🔑🔑🔑
    console.log("\n--- Login Debugging ---");
    console.log("Input Password:    ", password);
    console.log("Expected Password: ", ADMIN_PASSWORD);
    console.log("-----------------------\n");
    // 🔑🔑🔑 END DEBUGGING LINES 🔑🔑🔑

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        app.locals.isLoggedIn = true;
        return res.redirect('/admin');
    }
    res.render('login', { error: 'Invalid username or password.' });
});

app.get('/admin', isAuthenticated, (req, res) => {
    res.render('admin', { portfolioData: portfolioData.toObject() });
});

app.post('/logout', (req, res) => {
    app.locals.isLoggedIn = false;
    res.redirect('/');
});


// ------------------------------------
// --- ADMIN POST ROUTES (Updated for Cloudinary) ---
// ------------------------------------

// 1. CAROUSEL UPDATE
app.post('/admin/update-carousel/:index', isAuthenticated, (req, res) => {
    carouselUpload.single('carouselImage')(req, res, async (err) => {
        if (err) {
            console.error("❌ Carousel Upload Error:", err.message || err);
            return res.redirect('/admin?uploadError=' + encodeURIComponent('Carousel upload failed. Check server log.'));
        }

        const index = parseInt(req.params.index);
        const { title, description, link, buttonText } = req.body;

        if (index >= 0 && index < portfolioData.carousel.length) {
            if (req.file) {
                // Delete old asset from Cloudinary
                const publicId = extractPublicId(portfolioData.carousel[index].url);
                await deleteCloudinaryAsset(publicId);

                // Use the secure_url provided by Cloudinary
                portfolioData.carousel[index].url = req.file.path;
            }

            portfolioData.carousel[index].title = title;
            portfolioData.carousel[index].description = description;
            portfolioData.carousel[index].link = link;
            portfolioData.carousel[index].buttonText = buttonText;

            portfolioData.markModified('carousel');
            await portfolioData.save();
        }
        res.redirect('/admin#carousel');
    });
});


// 4. PROFILE PHOTO UPDATE
app.post('/admin/upload-photo', isAuthenticated, (req, res) => {
    profilePhotoUpload.single('profilePhoto')(req, res, async (err) => {
        if (err) {
            console.error("❌ Profile Photo Upload Error:", err.message || err);
            return res.redirect('/admin?uploadError=' + encodeURIComponent('Profile photo upload failed. Check server log.'));
        }

        if (req.file) {
            const publicId = extractPublicId(portfolioData.about.photoUrl);
            await deleteCloudinaryAsset(publicId);

            portfolioData.about.photoUrl = req.file.path;

            portfolioData.markModified('about');
            await portfolioData.save();
        }
        res.redirect('/admin#general');
    });
});

// 3. COMBINED PROJECT SUMMARY TEXT & IMAGE UPDATE
app.post('/admin/update-project-summary', isAuthenticated, (req, res) => {
    projectSummaryImageUpload.single('projectSummaryImage')(req, res, async (err) => {
        if (err) {
            console.error("❌ Project Summary Image Upload Error:", err.message || err);
            return res.redirect('/admin?uploadError=' + encodeURIComponent('Project summary image upload failed. Check server log.'));
        }

        const { title, paragraph1, paragraph2, buttonLink } = req.body;

        if (req.file) {
            const publicId = extractPublicId(portfolioData.projectSummary.image);
            await deleteCloudinaryAsset(publicId);

            portfolioData.projectSummary.image = req.file.path;
        }

        portfolioData.projectSummary.title = title;
        portfolioData.projectSummary.paragraph1 = paragraph1;
        portfolioData.projectSummary.paragraph2 = paragraph2;
        portfolioData.projectSummary.buttonLink = buttonLink;

        portfolioData.markModified('projectSummary');
        await portfolioData.save();
        res.redirect('/admin#general');
    });
});

// 7. UPLOAD PROJECT IMAGE
app.post('/admin/upload-project-image/:id', isAuthenticated, (req, res) => {
    projectImageUpload.single('projectImage')(req, res, async (err) => {
        if (err) {
            console.error("❌ Project Image Upload Error:", err.message || err);
            return res.redirect('/admin?uploadError=' + encodeURIComponent('Project image upload failed. Check server log.'));
        }

        const projectId = req.params.id;
        const project = portfolioData.projects.find(p => p.id === projectId);

        if (project && req.file) {
            // Use req.file.path (the Cloudinary URL)
            project.images.push(req.file.path);

            portfolioData.markModified('projects');
            await portfolioData.save();
        }
        res.redirect('/admin#projects');
    });
});

// 7A. DELETE INDIVIDUAL PROJECT IMAGE
app.post('/admin/delete-project-image/:id', isAuthenticated, async (req, res) => {
    const projectId = req.params.id;
    const { imageUrl } = req.body;
    const project = portfolioData.projects.find(p => p.id === projectId);

    if (project && imageUrl) {
        const imageIndex = project.images.indexOf(imageUrl);

        if (imageIndex > -1) {
            // Delete asset from Cloudinary first
            const publicId = extractPublicId(imageUrl);
            await deleteCloudinaryAsset(publicId);

            // Remove the URL from the project's data array
            project.images.splice(imageIndex, 1);

            portfolioData.markModified('projects');
            await portfolioData.save();
            // CRITICAL FIX: Reload data after save
            portfolioData = await Portfolio.findById('portfolio_data');
            console.log(`Image ${imageUrl} deleted from project ${projectId}.`);
        }
    }
    res.redirect('/admin#projects');
});


// 7B. DELETE ENTIRE PROJECT
app.post('/admin/delete-project/:id', isAuthenticated, async (req, res) => {
    const projectId = req.params.id;
    const projectIndex = portfolioData.projects.findIndex(p => p.id === projectId);

    if (projectIndex !== -1) {
        const projectToDelete = portfolioData.projects[projectIndex];

        // Delete all associated files from Cloudinary
        for (const imgUrl of projectToDelete.images) {
            const publicId = extractPublicId(imgUrl);
            await deleteCloudinaryAsset(publicId);
        }

        portfolioData.projects.splice(projectIndex, 1);
        portfolioData.markModified('projects');
        await portfolioData.save();
        // CRITICAL FIX: Reload data after save
        portfolioData = await Portfolio.findById('portfolio_data');
        console.log(`Project with ID ${projectId} and its images deleted.`);
    }
    res.redirect('/admin#projects');
});


// 8. UPLOAD NEW CERTIFICATE
app.post('/admin/upload-certificate', isAuthenticated, (req, res) => {
    certificateUpload.single('certificateFile')(req, res, async (err) => {
        if (err) {
            console.error("❌ Certificate Upload Error:", err.message || err);
            return res.redirect('/admin?uploadError=' + encodeURIComponent('Certificate upload failed. Check server log.'));
        }

        if (req.file) {
            const { title, issuer } = req.body;
            const newId = uuidv4();

            portfolioData.certificates.push({
                id: newId,
                title: title,
                issuer: issuer,
                pdfUrl: req.file.path // Cloudinary URL
            });

            portfolioData.markModified('certificates');
            await portfolioData.save();
            // CRITICAL FIX: Reload data after save
            portfolioData = await Portfolio.findById('portfolio_data');
        }
        res.redirect('/admin#certificates');
    });
});

// 9. UPLOAD GALLERY PHOTO (New addition)
app.post('/admin/upload-gallery', isAuthenticated, (req, res) => {
    galleryUpload.single('galleryImage')(req, res, async (err) => {

        // --- 1. HANDLE UPLOAD ERROR ---
        if (err) {
            console.error("❌ Gallery Upload Error:", err.message || err);
            return res.redirect('/admin?uploadError=' + encodeURIComponent('Gallery photo upload failed. Check server log.'));
        }

        // --- 2. SUCCESS LOGIC ---
        if (req.file) {
            const { caption } = req.body;
            const newId = uuidv4();

            try {
                portfolioData.gallery.push({
                    id: newId,
                    url: req.file.path, // Cloudinary URL
                    caption: caption
                });

                portfolioData.markModified('gallery');
                await portfolioData.save();

                // --- CRITICAL FIX: Reload data after save ---
                portfolioData = await Portfolio.findById('portfolio_data');
                console.log(`✅ Gallery photo saved: ${req.file.path}`);

            } catch (dbError) {
                console.error("❌ Database Save Error after Cloudinary upload:", dbError);
                return res.status(500).send("Database save failed after successful file upload.");
            }
        }

        // --- 3. FINAL SUCCESS REDIRECT ---
        res.redirect('/admin#gallery');
    });
});

// 9A. NEW: UPDATE GALLERY PHOTO (Image replacement)
app.post('/admin/update-gallery-photo/:id', isAuthenticated, (req, res) => {
    // FIX: Change 'galleryImageFile' to 'galleryImage' to match client expectations
    galleryUpload.single('galleryImage')(req, res, async (err) => {
        // --- 1. HANDLE UPLOAD ERROR ---
        if (err) {
            // The console error now occurs here if the client sends a file but Multer rejects the name
            console.error("❌ Gallery Photo Update Upload Error:", err.message || err);
            return res.redirect('/admin?uploadError=' + encodeURIComponent('Gallery photo replacement failed. Check server log.'));
        }

        // --- 2. SUCCESS LOGIC ---
        const photoId = req.params.id;
        // FIX APPLIED: Changed === to == to support old numerical IDs
        const photo = portfolioData.gallery.find(p => p.id == photoId);

        if (photo && req.file) {
            try {
                // A. Delete old asset from Cloudinary
                const publicId = extractPublicId(photo.url);
                await deleteCloudinaryAsset(publicId);

                // B. Update URL with the new Cloudinary path
                photo.url = req.file.path; // Cloudinary URL

                // C. Save to DB
                portfolioData.markModified('gallery');
                await portfolioData.save();

                // D. CRITICAL: Reload data after save
                portfolioData = await Portfolio.findById('portfolio_data');
                console.log(`✅ Gallery photo with ID ${photoId} URL updated.`);

            } catch (dbError) {
                console.error("❌ Database Save Error after Cloudinary photo update:", dbError);
                return res.status(500).send("Database save failed after successful file upload.");
            }
        } else if (!req.file) {
            console.warn("Attempted to update gallery photo but no file was provided.");
        }

        // --- 3. FINAL SUCCESS REDIRECT ---
        res.redirect('/admin#gallery');
    });
});

// 10. DELETE CERTIFICATE
app.post('/admin/delete-certificate/:id', isAuthenticated, async (req, res) => {
    const certId = req.params.id;
    // FIX APPLIED: Changed === to == to support old numerical IDs
    const certIndex = portfolioData.certificates.findIndex(cert => cert.id == certId);

    if (certIndex !== -1) {
        const certToDelete = portfolioData.certificates[certIndex];

        // Delete file from Cloudinary
        const publicId = extractPublicId(certToDelete.pdfUrl);
        await deleteCloudinaryAsset(publicId);

        portfolioData.certificates.splice(certIndex, 1);
        portfolioData.markModified('certificates');
        await portfolioData.save();

        // --- CRITICAL FIX: Reload data after save ---
        portfolioData = await Portfolio.findById('portfolio_data');
        console.log(`Certificate with ID ${certId} deleted.`);
    }
    res.redirect('/admin#certificates');
});

// 11. DELETE GALLERY PHOTO
app.post('/admin/delete-gallery-photo/:id', isAuthenticated, async (req, res) => {
    const photoId = req.params.id;
    // FIX APPLIED: Changed === to == to support old numerical IDs
    const photoIndex = portfolioData.gallery.findIndex(photo => photo.id == photoId);

    if (photoIndex !== -1) {
        const photoToDelete = portfolioData.gallery[photoIndex];

        // Delete file from Cloudinary
        const publicId = extractPublicId(photoToDelete.url);
        await deleteCloudinaryAsset(publicId);

        portfolioData.gallery.splice(photoIndex, 1);
        portfolioData.markModified('gallery');
        await portfolioData.save();

        // --- CRITICAL FIX: Reload data after save ---
        portfolioData = await Portfolio.findById('portfolio_data');
        console.log(`Gallery photo with ID ${photoId} deleted.`);
    }
    res.redirect('/admin#gallery');
});

// 13. ADD NEW EDUCATION ENTRY (Refactored to use ID)
app.post('/admin/add-education', isAuthenticated, (req, res) => {
    educationLogoUpload.single('educationLogo')(req, res, async (err) => {
        if (err) {
            console.error("❌ Education Logo Upload Error:", err.message || err);
            return res.redirect('/admin?uploadError=' + encodeURIComponent('Education logo upload failed. Check server log.'));
        }

        const { title, institution, years } = req.body;

        if (req.file) {
            const newId = uuidv4(); // Generate a unique ID

            portfolioData.education.push({
                id: newId, // Store the unique ID
                imageUrl: req.file.path, // Cloudinary URL
                title: title,
                institution: institution,
                years: years
            });

            portfolioData.markModified('education');
            await portfolioData.save();
            // CRITICAL FIX: Reload data after save
            portfolioData = await Portfolio.findById('portfolio_data');
        } else {
            console.error("No file uploaded for new education entry.");
        }
        res.redirect('/admin#general');
    });
});

// 14. DELETE EDUCATION ENTRY (Refactored to use ID)
app.post('/admin/delete-education/:id', isAuthenticated, async (req, res) => {
    const identifier = req.params.id;
    let eduIndex = -1;

    // 1. Try to find by UUID (for new entries)
    // We use '==' to match string params to data fields
    eduIndex = portfolioData.education.findIndex(edu => edu.id == identifier);

    // 2. If not found, and the identifier looks like a number, treat it as an array index (for old, ID-less entries)
    if (eduIndex === -1) {
        const indexAsNumber = parseInt(identifier);
        if (!isNaN(indexAsNumber) && indexAsNumber >= 0 && indexAsNumber < portfolioData.education.length) {
            eduIndex = indexAsNumber;
            console.log(`⚠️ Education entry deleted by array index: ${eduIndex}. Old entry likely had no UUID.`);
        }
    }

    // 3. Perform deletion if an index was found
    if (eduIndex !== -1) {
        const eduToDelete = portfolioData.education[eduIndex];

        // Delete file from Cloudinary
        const publicId = extractPublicId(eduToDelete.imageUrl);
        await deleteCloudinaryAsset(publicId);

        portfolioData.education.splice(eduIndex, 1);
        portfolioData.markModified('education');
        await portfolioData.save();

        // --- CRITICAL FIX: Reload data after save ---
        portfolioData = await Portfolio.findById('portfolio_data');
        console.log(`Education entry deleted (Identifier: ${identifier}).`);
    } else {
        console.warn(`Could not find Education entry with identifier: ${identifier}`);
    }
    res.redirect('/admin#general');
});

// --- Other text-only routes ---

// 2. GENERAL & ABOUT TEXT UPDATE
app.post('/admin/update-text', isAuthenticated, async (req, res) => {
    const { aboutSummary, aboutFull, aboutSkills } = req.body;

    portfolioData.about.summary = aboutSummary;
    portfolioData.about.fullStory = aboutFull;
    portfolioData.about.skills = aboutSkills.split('\n').map(s => s.trim()).filter(s => s.length > 0);

    portfolioData.markModified('about');
    await portfolioData.save();
    res.redirect('/admin#general');
});

// 5. ADD NEW PROJECT
app.post('/admin/add-project', isAuthenticated, async (req, res) => {
    const { title, description, githubLink } = req.body;
    const newId = 'proj' + uuidv4();

    portfolioData.projects.push({
        id: newId,
        title: title,
        description: description,
        githubLink: githubLink,
        images: []
    });

    portfolioData.markModified('projects');
    await portfolioData.save();
    res.redirect('/admin#projects');
});

// 6. UPDATE PROJECT TEXT
app.post('/admin/update-project/:id', isAuthenticated, async (req, res) => {
    const projectId = req.params.id;
    const { title, description, githubLink } = req.body;
    const project = portfolioData.projects.find(p => p.id === projectId);

    if (project) {
        project.title = title;
        project.description = description;
        project.githubLink = githubLink;

        portfolioData.markModified('projects');
        await portfolioData.save();
    }
    res.redirect('/admin#projects');
});

// 12. UPDATE GALLERY CAPTION 
app.post('/admin/update-gallery-caption/:id', isAuthenticated, async (req, res) => {
    const photoId = req.params.id;
    const { caption } = req.body;

    // FIX APPLIED: Changed === to == to support old numerical IDs
    const photo = portfolioData.gallery.find(p => p.id == photoId);
    if (photo) {
        photo.caption = caption;

        portfolioData.markModified('gallery');
        await portfolioData.save();
    }
    res.redirect('/admin#gallery');
});

// 15. UPDATE FOOTER TEXT AND LINKS
app.post('/admin/update-footer', isAuthenticated, async (req, res) => {
    try {
        const { name, line1, line2, githubLink, emailLink, phoneLink, linkedinLink } = req.body;

        if (!portfolioData.footerInfo) {
            portfolioData.footerInfo = {};
        }

        portfolioData.footerInfo.name = name;
        portfolioData.footerInfo.line1 = line1;
        portfolioData.footerInfo.line2 = line2;
        portfolioData.footerInfo.githubLink = githubLink;
        portfolioData.footerInfo.emailLink = emailLink;
        portfolioData.footerInfo.phoneLink = phoneLink;
        portfolioData.footerInfo.linkedinLink = linkedinLink;

        portfolioData.markModified('footerInfo');
        await portfolioData.save();
        console.log("Footer text and links updated successfully.");
        res.redirect('/admin#general');

    } catch (error) {
        console.error("Error updating footer info:", error);
        res.redirect('/admin#general');
    }
});


// Start server only after connecting to DB and loading data
const PORT = process.env.PORT || 3000;
connectDBAndLoadData().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
        console.log(`🔑 Admin Login: http://localhost:${PORT}/login (User: ${process.env.ADMIN_USERNAME}, Pass: <check your .env file>)`);
    });
});