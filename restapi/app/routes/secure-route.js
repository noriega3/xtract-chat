const express = require('express')
const router = express.Router()

require('./admin-routes')(router)

const _isEqual = require('lodash/isEqual')

const {sendDeleteToken} = require('../services/PushNotify')
const DataRequestQueue = require('../services/dataRequest/Queue')
const DataRequest = require('../services/dataRequest')
const { check, validationResult, body, checkSchema } = require('express-validator/check')

const UserStore = require('../services/UserStore')

router.post('/echo', (req, res) => {
    res.json({
        pong: true,
        message: req.body.message || undefined,
        rtime: req.responseStartTime,
        st: Date.now()
    })
})

//Displays information tailored according to the logged in user
router.get('/users/me', async (req, res) => {
    //We'll just send back the user details and the token
    let data = await UserStore.getUserData(req.user.uId)
    res.json({
        data,
        rtime: req.responseStartTime,
    })
})

router.get('/users/me/facebook/status', async (req, res, next) => {
    //We'll just send back the user details and the token
    const hasFbId = await UserStore.getUserFacebookIdExists(req.user.uId)
    res.json({
        data: {hasFbId},
        user : req.user
    })
})

router.post('/users/me/facebook/disconnect', checkSchema({
        fbId:{
            errorMessage: 'fbId not defined',
            options: { min: 16 }
        },
        current: {
            optional: true,
        },
        next: {
            optional: true
        },
        nextConfirm: {
            optional: true,
        }
    }), async (req, res, next) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() })
        }

        const hasPassword = await UserStore.getUserPasswordExists(req.user.uId)
        let validated = false
        //if user has password set we only check 'current' body param
        if(hasPassword){
            validated = await UserStore.validateCurrentPassword(req.user.uId, req.body.current)
            if(!validated) {
                res.status(422)
                return next(new Error('Wrong Password Entered'))
            }
        } else {
            if(req.body.next){ //invalid
                validated = await UserStore.setUserPassword(req.user.uId, req.body.next)
                if(!validated) {
                    res.status(422)
                    return next(new Error('Could not set new password'))
                }
            }
        }
        //We'll just send back the user details and the token
        const unsetStatus = await UserStore.unsetFacebookId(req.user.uId)
        if(unsetStatus){
            return res.json({
                data: 'OK',
                message: 'Successfully disconnected from facebook.',
                user: req.user
            })
        } else {
            res.status(422)
            return next(new Error('Could not remove facebook id.'))
        }
    })

router.get('/users/me/email', async (req, res, next) => {
    //We'll just send back the user details and the token
    const data = await UserStore.getUserEmailByUserId(req.user)
    res.json({
        data,
        user : req.user
    })
})

router.get('/users/me/app/:appName', async (req, res, next) => {
    //We'll just send back the user details and the token
    const data = await UserStore.getUserDataApp(req.user.uId, req.params.appName)
    res.json({
        data,
        user : req.user
    })
})

router.post('/users/me/datarequest/start', async (req, res, next) => {

    const job = await DataRequestQueue.addToQueue(req.user.uId)

    if(job){
        res.json({
            data: {
                jobId: job.id,
                progress: 1
            },
            message: 'Request successfully received',
            user: req.user
        })
    } else {
        res.json({
            data: {
                jobId: false,
                progress: -1
            },
            message: 'Invalid data request',
            user: req.user
        })
    }
})

router.post('/users/me/datarequest/state', async (req, res, next) => {
    const {progress, lastRequestTime} = await DataRequestQueue.getStatus(req.user.uId)
    if(progress){
        res.json({
            data: {
                jobId: req.user.uId,
                progress,
                lastRequestTime
            },
            user: req.user
        })
    } else {
        res.json({
            data: {
                jobId: false,
                progress: -1
            },
            user: req.user
        })
    }
})

router.post('/users/me/datarequest/download', async (req, res, next) => {
    let data = await DataRequestQueue.getFinished(req.user.uId)

    if(!data){
        res.json({
            message: 'No request with id found. Process request again.',
            user: req.user
        })
    } else {
        let filePath = DataRequest.getUserDataFilePath(data.confirmationId)

        if(filePath){
            res.download(filePath)
        } else {
            DataRequestQueue.remove(req.user.uId) //remove queue job
            res.json({
                message: 'No file with given confirmation id found. Process request again.',
                user: req.user
            })
        }
    }
})

router.post('/users/me/email/register', [
    checkSchema({
        userId: {
            in: ['user'],
            custom: {
                options: async (value, {req, location, path}) => {
                    return await UserStore.validateAccountType(value, 'email')
                }
            },
            toInt: true
        },
        emailAddress:{
            errorMessage: 'fbId not defined',
            options: { min: 16 }
        },
        next: {
            errorMessage: 'Password should be at least 7 chars long',
            options: { min: 7 }
        },
        nextConfirm: {
            errorMessage: 'Password should be at least 7 chars long',
            options: { min: 7 }
        },
    }),
], async (req, res, next) => {

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() })
    }
    let didConvert = await UserStore.changeUserGuestToEmail(req.user.uId, req.body)

    if(_isEqual(didConvert, true)){
        res.json({
            didConvert,
            user : req.user,
            rtime: req.responseStartTime,
        })
    } else {
        res.status(422)
        return next(new Error('Could not convert account'))
    }
})

router.post('/users/me/password/change', [
    check('next').isLength({ min: 5 }),
    body('current').custom( async (value, { req }) => {
        let valid = await UserStore.getUserPasswordExists(req.user.uId)
        if(valid){
            valid = await UserStore.validateCurrentPassword(req.user.uId, value)
            if(!valid) throw new Error('Current password is invalid')
            valid = !_isEqual(value, req.body.next)
            if(!valid) throw new Error('New password matches old password')
        }
        return valid
    }),
    body('nextConfirm').custom(async (value, { req }) => {
        if (!_isEqual(value, req.body.next))
            throw new Error('Password confirmation does not match new password');
    })
], async (req, res, next) => {

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        console.log('errors', errors.array())
        return res.status(422).json({ errors: errors.array() })
    }

    let didSet = await UserStore.setUserPassword(req.user.uId, req.body.nextConfirm)
    if(_isEqual(didSet, true)){
        res.json({
            changed: true,
            user : req.user,
            rtime: req.responseStartTime,
        })
    } else {

        res.status(422)
        return next(new Error('Could not set password.'))
    }
})

//Locks down the function via the user's current gcm address
router.post('/users/me/data/delete', async (req, res, next) => {
    //We'll send back a basically (2 factor) thing that will verify with the current owner of device
    // Specify which registration IDs to deliver the message to
    const userFcm = 'dfdfff'

    const didSend = await sendDeleteToken(userFcm)

    res.json({
        data: didSend,
        user : req.user,
        rtime: req.responseStartTime,
    })
})

//Locks down the function via the user's current gcm address
router.post('/users/me/data/delete/confirm', async (req, res, next) => {
    res.json({
        data,
        user : req.user,
        rtime: req.responseStartTime,
    })
})

//Those paths with id as a parameter, we make sure of the role
router.param('uid', async (req, res, next, value) => {
    //TODO: do a user id check

    const doesExist = await UserStore.getUserIdExists(value).catch(false)

    if(!doesExist)
        next(new Error('User Does Not Exist'))
    else
        next()
})
module.exports = router