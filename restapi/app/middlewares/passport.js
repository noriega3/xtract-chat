const config =  require('../config');
const passport = require('passport');
const CustomStrategy = require('passport-custom').Strategy;
const UserModel = require('../models').UserModel;

const _ = require('lodash')

//Create a passport middleware to handle user registration

/*
//no signups via web yet.
passport.use('signup', new LocalStrategy({
    usernameField : 'email',
    passwordField : 'password'
}, async (email, password, done) => {
    try {
        //Save the information provided by the user to the the database
        const user = await UserModel.create({ email, password });
        //Send the user information to the next middleware
        return done(null, user);
    } catch (error) {
        done(error);
    }
}));
*/

const JWTStrategy = require('passport-jwt').Strategy;
const ExtractJWT = require('passport-jwt').ExtractJwt; //We use this to extract the JWT sent by the user
let user_cache = {};

passport.serializeUser(function(user, next) {
    let id = user._id;
    user_cache[id] = user;
    next(null, id);
});

passport.deserializeUser(function(id, next) {
    next(null, user_cache[id]);
});

//This verifies that the token sent by the user is valid
passport.use(new JWTStrategy({
    secretOrKey : config.jwtSecret,    //secret we used to sign our JWT
    jwtFromRequest : ExtractJWT.fromAuthHeaderAsBearerToken()    //we expect the user to send the token as a bearer token
}, async (auth, done) => {
    try {
        done(null, auth.user);
    } catch (error) {
        done(error);
    }
}));

//Create a passport middleware to handle User login
passport.use('login', new CustomStrategy(
    async (req, done) => {
        try {
            let user = await UserModel.requestLogin(req.body)
            return done(null, user, { message : 'Logged in Successfully'});
        } catch (error) {
            console.log('error', error)
            return done(error);
        }
    }));

//Create a passport middleware to handle User token refresh
passport.use('refresh', new CustomStrategy(
    async (req, done) => {
        try {
            let user = await UserModel.requestRefresh(req.user, req.body)
            return done(null, user, { message : 'Refreshed Successfully' });
        } catch (error) {
            console.log('ERROR', error)
            return done(error);
        }
    }));

//Create a passport middleware to handle User logout
passport.use('logout', new JWTStrategy({
    secretOrKey : config.jwtSecret,    //secret we used to sign our JWT
    jwtFromRequest : ExtractJWT.fromAuthHeaderAsBearerToken(),    //we expect the user to send the token as a bearer token
    passReqToCallback: true,
}, async (req, user, done) => {
    try {
        const result = await UserModel.requestLogout(user, req.body)
        return done(null, result, { message: 'Successfully logged out'})
    } catch (error) {
        console.log('error', error)
        return done(error)
    }
}))