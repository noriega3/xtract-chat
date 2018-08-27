const express = require('express')
const passport = require('passport')
const router = express.Router()
const _ = require('lodash')
const UserModel = require('../models').UserModel;

//When the user sends a post request to this route, passport authenticates the user based on the
//middleware created previously
router.post('/signup', (req, res, next) =>
    passport.authenticate('signup', { session : false }, (err, user, info) => {
        if (err) return next(err)
        res.json({
            user,
            message: _.get(info, 'message'),
    })
    })(req, res, next)
)

router.post('/login', (req, res, next) =>
    passport.authenticate('login', {session: false}, (err, user, info) => {
        if (err) return next(err)
        res.json({
            auth: user.auth,
            message: _.get(info, 'message'),
        })
    })(req, res, next)
)

router.post('/refresh', (req, res, next) =>
    passport.authenticate('refresh', {session: false}, (err, user, info) => {
        if (err) return next(err)
        return res.json({
            auth: user.auth,
            message: _.get(info, 'message'),
        })
    })(req, res, next)
)

router.post('/logout', async (req, res, next) => {
    passport.authenticate('logout', {session: false}, (err, user, info) => {
        if (err) return next(err)
        return res.json({
            user,
            message: _.get(info, 'message'),
        })
    })(req, res, next)
})

module.exports = router