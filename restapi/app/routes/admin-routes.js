const express = require('express')
const _indexOf = require('lodash/indexOf')
const _isEqual = require('lodash/isEqual')

const DataRequestQueue = require('../services/dataRequest/Queue')
const DataRequest = require('../services/dataRequest')

const {
    getUserIdExists,
    getUserData,
    getUserDataApp,
    getUsersBySearchByScan,
    setUserData,
    setUserAppData
} = require('../services/UserStore')

module.exports = (router) => {

    router.use('/admin', (req, res, next) => {
        if(!req.user.roles || _indexOf(req.user.roles, 'a') >= 0 || _indexOf(req.user.roles, 's') >= 0){
            next()
        } else {
            next(new Error("Unauthorized"))
        }
    })

    router.post('/admin/search/users', async (req, res, next) => {
        console.log(req, '\n----------------------------------------------\n', res)
        //We'll just send back the user details and the token
        let {data, nextCursor} = await getUsersBySearchByScan(req.body.term, req.body.cursor, 10)

        res.json({
            query: req.body.term,
            nextCursor,
            data,
            user : req.user
        })

        next()
    })


//TODO: this is an admin request
    router.post('/users/me/datarequest/remove', async (req, res, next) => {

        await DataRequest.removeStoredUserDataFile(req.user.uId)
        await DataRequestQueue.remove(req.user.uId)

        res.json({
            message: 'Request data file successfully removed',
            user: req.user
        })
    })

    router.get('/admin/users/:uid/app/:appName', async (req, res, next) => {

        //We'll just send back the user details and the token
        const data = await getUserDataApp(req.params.uid, req.params.appName)
        res.json({
            data,
            user : req.user
        })
    })

    router.post('/admin/users/:uid', async (req, res, next) => {

        //We'll just send back the user details and the token
        const data = await setUserData(req.params.uid, req.body)
        res.json({
            data,
            user : req.user
        })
    })

    router.post('/admin/users/:uid/app/:appName', async (req, res, next) => {

        //We'll just send back the user details and the token
        const data = await setUserAppData(req.params.uid, req.params.appName, req.body)
        res.json({
            data,
            user : req.user
        })
    })

    router.get('/admin/users/:uid', async (req, res, next) => {

        //We'll just send back the user details and the token
        const data = await getUserData(req.params.uid)

        res.json({
            data,
            user : req.user
        })
    })
}