require('dotenv').config();  // Load environment variables from .env file

const express = require('express');  // Import the Express framework
const ejs = require('ejs')  // Import EJS for rendering templates
const session = require('express-session');  // Import express-session for session management
const passport = require('passport');  // Import Passport.js for authentication
const LocalStrategy = require('passport-local').Strategy;  // Import local strategy for username/password authentication
const flash = require('express-flash');  // Import express-flash for flashing messages
const mongoose = require('mongoose');  // Import mongoose for MongoDB object modeling
const multer = require('multer');  // Import multer for handling file uploads
const bcrypt = require('bcrypt')  // Import bcrypt for password hashing
const { body, validationResult } = require('express-validator');  // Import express-validator for form validation
const cookieParser = require('cookie-parser');  // Import cookie-parser for parsing cookies
const path = require('path')  // Import path module for handling file paths
const { v4: uuidv4 } = require('uuid');  // Import uuid for generating unique IDs
const fs = require('fs')  // Import fs for file system operations


const app = express();  // Create an Express application
const PORT = 8000  // Define the port number for the server

// Multer storage configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');  // Destination directory for file uploads
    },
    filename: function (req, file, cb) {
        const extension = file.originalname.split('.').pop();  // Get file extension
        const name = `${uuidv4()}.${extension}`;  // Generate unique filename
        console.log(name);
        cb(null, name);  // Callback with the generated filename
    }
});


const upload = multer({
    storage: storage
});


app.set('view engine', 'ejs');
app.use(session({
    secret: process.env.SESSIONKEY,
    resave: false,
    saveUninitialized: false
}));
app.use(flash());  // Flash messages middleware
app.use(passport.initialize());  // Initialize Passport.js
app.use(passport.session());  // Session middleware for Passport.js
app.use(express.static('public'));  // Serve static files from the public directory
app.use(cookieParser());  // Cookie parser middleware
app.use(express.urlencoded({ extended: true }));  // Parse URL-encoded bodies
app.use((req, res, next) => {
    res.locals.user = req.user;  // Make user object available to templates
    next();
});
app.use((req, res, next) => {
    res.locals.errorMessages = req.flash('error');  // Flash error messages
    next()
});


// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log(`[INFORMATION]> Connection to DB was successful`))
.catch(err => console.log(err));


// Define user schema for MongoDB
const userSchema = new mongoose.Schema({
    email: String,
    password: String
});

// Define post schema for MongoDB
const postSchema = new mongoose.Schema({
    title: String,
    filename: String,
    body: String,
    authorId: String,
    username: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create User and Post models
const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);

// Validation middleware for email and password
const validateEmail = [
    body('email')
    .isEmail()
    .withMessage('Please enter a valid email address'),
    body('password')
    .isLength({
        min: 6
    })
    .withMessage('Password must be atleast 6 letters long')
]

// Passport local strategy for user authentication
passport.use(new LocalStrategy({
    usernameField: 'email'
}, async (email, password, done) => {
    try {
        const user = await User.findOne({ email });  // Find user by email
        if (!user) {
            return done(null, false, {
                message: 'Incorrect email or password'
            });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);  // Compare passwords
        if (!isPasswordValid) {
            return done(null, false, {
                message: 'Incorrect email or password'
            });
        }
        return done(null, user);  // Return user on successful authentication
    } catch (error) {
        return done(error);
    }
}));

// Serialize user for session
passport.serializeUser(function (user, done) {
    done(null, user.id);
});

// Deserialize user for session
passport.deserializeUser(function (id, done) {
    User.findById(id)
        .then(function (user) {
            done(null, user);
        })
        .catch(function (err) {
            done(err);
        });
});
// Middleware to check if user is logged in
function isLoggedin(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// Middleware to check if user is logged out
function isLoggedOut(req, res, next) {
    if (!req.isAuthenticated()) {
        return next();
    }
    res.redirect('/dashboard');
}
// Middleware to store original URL
function storeOriginalUrl(req, res, next) {
    // Check if the user is authenticated
    if (!req.isAuthenticated()) {
        // If not authenticated, store the original URL in a cookie
        res.cookie('redUrl', req.url);

    }
    next();
}





// Route to render homepage with posts sorted by creation date
app.get('/', storeOriginalUrl, (req, res) => {
    var user = req.user;  // Get current logged in user
    if (req.query.sortby === 'old') {
        Post.find({}).sort({ createdAt: 1 })  // Sort posts by oldest first
            .then((posts) => {
                res.render('index', {
                    posts: posts,
                    user: user
                });
            })
            .catch((err) => {
                console.error(err);
                res.status(500).send('Internal Server Error');
            });
    } else {
        Post.find({}).sort({ createdAt: -1 })  // Sort posts by newest first
            .then((posts) => {
                res.render('index', {
                    posts: posts,
                    user: user
                });
            })
            .catch((err) => {
                console.error(err);
                res.status(500).send('Internal Server Error');
            });
    }
});

// signup post and get start
app.get('/signup', isLoggedOut, (req, res) => {
    res.render('signup')
})


app.post('/signup', validateEmail, isLoggedOut, async (req, res) => {
    const existingUser = await User.findOne({
        email: req.body.email
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => error.msg)
        req.flash('error', errorMessages);
        return res.redirect('/signup')
    }



    if (existingUser) {
        res.send("Email is already in use.")
        return
    }
    const hash = await bcrypt.hash(req.body.password, 10);

    const newUser = new User({
        email: req.body.email,
        password: hash,
        admin: false
    })

    await newUser.save();

    req.login(newUser, err => {
        if (err) {
            console.log(err);
        } else {
            if (req.cookies.redUrl) {
                const redirectUrl = req.cookies.redUrl
                res.redirect(redirectUrl)
            } else {
                res.redirect('/dashboard')
            }
        }
    })
})
// signup post and get end



//login stuff start

app.get('/login', isLoggedOut, (req, res) => {
    res.render('login')
});

app.post('/login', validateEmail, passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: true
}), (req, res) => {
    if (req.cookies.redUrl) {
        const redirectUrl = req.cookies.redUrl
        res.redirect(redirectUrl)
    } else {
        res.redirect('/dashboard')
    }
});

//login stuff end

//logout stuff start

app.get('/logout', (req, res) => {
    req.logOut(function (err) {
        if (err) {
            return next(err);
        }
        res.redirect('/')
    });
});


//logout stuff end

// Post stuff

app.post('/post', isLoggedin, upload.single('image'), async function (req, res) {
    try {

        const {
            title,
            body
        } = req.body;

        const username = req.user.email.split('@')[0];

        const post = new Post({
            title,
            body,
            filename: req.file.filename,
            authorId: req.user._id,
            username: username,
            createdAt: new Date()
        });

        await post.save();

        req.flash('success', 'Post created successfully.');
        res.redirect('/dashboard');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Internal Server Error');
        res.status(500).send('Internal Server Error');
    }
});

// Post stuff end

// user/posts
// Route to render user's posts
app.get('/myposts', storeOriginalUrl, isLoggedin, (req, res) => {
    Post.find({ authorId: req.user._id })  // Find posts by the logged-in user
        .then((post) => {
            res.render('dirupload', {
                posts: post
            });
        })
        .catch((err) => {
            console.error(err);  // Log any errors
        }); 
});

// Route to render admin page
app.get('/dashboard', isLoggedin, (req, res) => {
    res.render('admin', {
        successMessages: req.flash('success'),
        errorMessages: req.flash('error')
    });
});

// Route to delete a post by ID
app.get('/delete/:id', isLoggedin, async function (req, res) {
    try {
        const postId = req.params.id;
        const userId = req.user._id;

        // Find the post by ID
        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).send('Post not found');  // Handle post not found
        }

        // Check if the user is the author or an admin
        if (post.authorId.toString() !== userId.toString() && !req.user.isAdmin) {
            return res.status(403).send('You are not authorized to delete this post');  // Handle unauthorized access
        }

        // Delete the file associated with the post
        fs.unlink(__dirname + `/public/uploads/${post.filename}`, (err) => {
            if (err) throw err;
            console.log(`[DEBUG]> Successful deletion of file ${post.filename}`);
        });

        // Delete the post
        await Post.deleteOne({ _id: postId });

        res.redirect('/myposts');  // Redirect to user's posts after deletion
        console.log(`[DEBUG]> Successful deletion of ID ${postId}`);
    } catch (error) {
        console.log(error);  // Log any errors
        res.status(500).send('Internal Server Error');
    }
});

// Route to view a specific post by ID
app.get('/posts/:id', async (req, res) => {
    try {
        const postId = req.params.id;

        // Validate postId format if necessary
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return res.status(400).send('Invalid post ID');
        }

        // Find the post by ID
        const post = await Post.findOne({ _id: postId });

        // Check if the post exists
        if (!post) {
            return res.status(404).send('Post not found');
        }

        // Render the post page with the found post
        res.render('post', {
            post
        });
    } catch (err) {
        console.error(err);  // Log any errors
        res.status(500).send('Internal Server Error');
    }
});

// Route to view all posts by a specific user
app.get('/posts/user/:id', async (req, res) => {
    try {
        const posts = await Post.find({ authorId: req.params.id });
        res.render('index', {
            posts: posts
        });
    } catch (err) {
        console.error(err);  // Log any errors
        res.status(500).send('Internal Server Error');
    }
});

// Route to render the edit post page
app.get('/post/edit/:postId', storeOriginalUrl, isLoggedin, async function (req, res) {
    try {
        // Fetch the post with the given ID from the database
        const post = await Post.findById(req.params.postId);

        if (!post) {
            return res.status(404).send('Post not found');  // Handle post not found
        }
        
        // Check if the user is the author
        if (post.authorId.toString() !== req.user._id.toString()) {
            return res.status(403).send('You are not authorized to edit this post');  // Handle unauthorized access
        }

        // Render the edit page and pass the post data
        res.render('edit', {
            post
        });
    } catch (err) {
        console.error(err);  // Log any errors
        res.status(500).send('Internal Server Error');
    }
});

// Route to handle post edit form submission
app.post('/post/edit/:postId', upload.single('newImage'), async function (req, res) {
    try {
        const postId = req.params.postId;

        // Fetch the post with the given ID from the database
        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).send('Post not found');  // Handle post not found
        }

        // Check if the user is the author
        if (post.authorId.toString() !== req.user._id.toString()) {
            return res.status(403).send('You are not authorized to edit this post');  // Handle unauthorized access
        }

        const oldFilename = post.filename;

        // Update post properties with the new data from the form
        post.title = req.body.title;
        post.body = req.body.body;  // Fixed this line from 'description' to 'body'

        // Check if new image was uploaded
        if (req.file) {
            post.filename = req.file.filename;
        }

        // Save the updated post
        await post.save();

        if (req.file && oldFilename) {
            const oldFilePath = path.join(__dirname, 'public', 'uploads', oldFilename);
            fs.unlink(oldFilePath, (err) => {
                if (err) {
                    console.error(`Error deleting old image: ${err}`);
                }
            });
        }

        // Redirect back to the edit page
        res.redirect(`/post/edit/${postId}`);
    } catch (err) {
        console.error(err);  // Log any errors
        res.status(500).send('Internal Server Error');
    }
});

// Start the server on the specified port
app.listen(PORT, () => {
    console.log(`[+] Server Started On Port: ${PORT}`);
});
