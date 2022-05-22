//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));      // set public folder as style resource
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));


/////////////////////////////////////////////////
app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize()); // initialize passport
app.use(passport.session());    // use passport to manipulate sessions
/////////////////////////////////////////////////


// connect to mongodb
mongoose.connect("mongodb://localhost:27017/userDB");

// create schema
const userSchema = new mongoose.Schema (
    {
        email: String,
        password: String,
        googleId: String
    }, 
    { collection: "userinfo"}
);

/////////////////////////////////////////////////
// hash & salt password -> save user into mongodb database
userSchema.plugin(passportLocalMongoose);
// plugin google
userSchema.plugin(findOrCreate);
/////////////////////////////////////////////////

// create model
const User = new mongoose.model("User", userSchema);


passport.use(User.createStrategy());
///////////////////////GHoogle authentication//////////////////////////
// CHANGE: USE "createStrategy" INSTEAD OF "authenticate"

passport.serializeUser(function (user, done) {
    done(null, user.id);
});
passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
      console.log(profile);
    User.findOrCreate({ username: profile._json.email, googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));
/////////////////////////////////////////////////


app.get("/", function (req, res) {
    res.render("home");
});

app.get("/login", function (req, res) {
    res.render("login");
});

app.get("/register", function (req, res) {
    res.render("register");
});

// enable directly visit secret url when user logged in
app.get("/secrets", function (req, res) {
    // check if the user is authenticated
    if (req.isAuthenticated()) {
        res.render("secrets");
    } else {
        res.redirect("/login");
    }

});

app.get("/logout", function (req, res) {
    req.logout(function () { console.log('Done logging out.'); });
    res.redirect("/");
    
});

/////////////////////// google authentication
app.get('/auth/google',
    // pop up the google login
  passport.authenticate('google', { scope: ['openid', 'profile', 'email'] })
  );

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect secrets.
    res.redirect('/secrets');
  });
///////////////////////////////////


// catch the post from the register route
app.post("/register", function (req, res) {

    // from the passport-local-mongoose package
    User.register({username: req.body.username}, req.body.password, function(err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local") (req, res, function () {
                res.redirect("/secrets");
            });
        }
    }); 

});

// catche the post from the login route
app.post('/login', 
  passport.authenticate('local', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/secrets');
    });



app.listen(3000, function() {
    console.log("Server started on port 3000.")
});
