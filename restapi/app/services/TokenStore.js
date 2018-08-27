/*
Access token:
    It contains all the information the server needs to know if the user / device can access the resource you are requesting or not.
    They are usually expired tokens with a short validity period.

Refresh token:
https://security.stackexchange.com/questions/133388/does-expiring-the-oauth-refresh-token-at-the-same-time-as-the-access-token-have
    do not use refresh tokens to retrieve or set data, only to validate user and set a new refresh token.
    The refresh token is used to generate a new access token.
    Typically, if the access token has an expiration date, once it expires, the user would have to authenticate again to obtain an access token.
    With refresh token, this step can be skipped and with a request to the API get a new access token that allows the user to continue accessing the application resources.
 */
const {promisify} = require('../utils')
const database = require('../store').db
const jwt = require('jsonwebtoken')
const config = require('../config')
const uuidv4 = require('uuid/v4')

const _ = require('lodash')
const _isEqual = require('lodash/isEqual')

let storedRefreshTokens = {}

const REFRESH_TOKEN_EX = "60m"
const ACCESS_TOKEN_EX = "1m"

async function getRefreshTokenHexExistsById(tokenId){
    let [err, result] = await promisify(database.hexists(`users:_tokens`, `${tokenId}:`))
    if(err) return false
    return result || false
}

async function getUserRefreshTokenByUserIdExists(userId){
    let [err, result] = await promisify(database.hexists(`users:${userId}`, `_refreshToken`))
    if(err) return false
    return result || false
}

async function getRefreshTokenHexById(tokenId){
    let [err, result] = await promisify(database.hget(`users:_tokens`, `${tokenId}:`))
    if(err) return false
    return result || false
}

async function getUserRefreshTokenByUserId(userId){
    let [err, result] = await promisify(database.hget(`users:${userId}`, '_refreshToken'))
    if(err) return false
    return result || false
}

async function getUserIdByRefreshToken(rToken){
    let [errGet, extracted] = await promisify(getDecodedRefreshToken(rToken)) //extract the local token
    if(errGet) return false //validate local token
    let [err, result] = await promisify(database.hget(`users:_tokens`, `${extracted.id}:`))
    if(err || !result) return false
    return getExtractedDataByTokenHex(result).userId
}

async function getDecodedRefreshToken(jwtToken){
    return await new Promise((resolve,reject) => {
        jwt.verify(jwtToken, config.jwtSecret, {ignoreExpiration: true, maxAge: "60m"}, (err, decoded) => {
            if(err) {
                console.error(err)
                reject(-99)
            }
            resolve(decoded)
        })
    })
}

function getExtractedDataByTokenHex(tokenHex){
    let split = _.split(tokenHex, '::', 2)
    if(!split) return false
    return {refreshToken: _.head(split), userId: _.tail(split)}
}

async function setTokens(user){
    const {uId} = user
    let id                = uuidv4()
    let refresh           = await jwt.sign({id}, config.jwtSecret, {expiresIn: REFRESH_TOKEN_EX})  //we always refresh the token on the calling of this function
    let access            = await jwt.sign({user}, config.jwtSecret, {expiresIn: ACCESS_TOKEN_EX})
    let [errId, didSetId] = await promisify(database.hset('users:_tokens', `${id}:`, `${refresh}::${uId}`))
    if(errId || didSetId < 0) return false

    let [errUser, didSetUser] = await promisify(database.hset(`users:${uId}`, `_refreshToken`, refresh))

    console.log('did set tokens', refresh, uId)
    if(errUser || didSetUser < 0) return false

    storedRefreshTokens[refresh] = {userId: uId}

    return { refresh, access }
}

async function setTokensUseExisting(user){
    const {uId} = user
    let refresh           = await getUserRefreshTokenByUserId(uId)
    let access            = await jwt.sign({user}, config.jwtSecret, {expiresIn: ACCESS_TOKEN_EX})
    return { refresh, access }
}

async function validateDbRefreshTokenMatchesForUserId(userId, token){
    let current = await getUserRefreshTokenByUserId(userId)
    console.log('current stored is ', current)
    if(current) return false
    return _isEqual(token, current)
}

async function validateDbRefreshTokenExists(intendedToken){
    let [errGet, extracted] = await promisify(getDecodedRefreshToken(intendedToken)) //extract the local token
    if(errGet) return -1 //validate local token

    let [errId, hexExists] = await promisify(getRefreshTokenHexExistsById(extracted.id)) //get the stored refreshToken:userId hash at tokenId
    if(errId || !hexExists) return -2
}

//TODO: this is more thorough check extract both the db stored and locally stored refresh tokens. (not enabled for the cost of speed)
async function validateDbRefreshToken(intendedUserId, intendedToken){
    let [errGet, extracted] = await promisify(getDecodedRefreshToken(intendedToken)) //extract the local token
    if(errGet) return -1 //validate local token

    let [errId, storedHex] = await promisify(getRefreshTokenHexById(extracted.id)) //get the stored refreshToken:userId hash at tokenId
    if(errId || !storedHex) return -2

    let hex = getExtractedDataByTokenHex(storedHex) //extract the stored token hash
    if(!hex) return -3

    console.log('stored', hex.refreshToken, intendedToken)
    if(!_.get(hex, 'refreshToken') || !_.isEqual(intendedToken, _.get(hex, 'refreshToken'))) return -4//stored refresh token matches intended token
    if(!_.get(hex, 'userId') || _.isEqual(intendedUserId, hex.userId)) return -5 //validate hash userId

    return true
}

async function invalidate({userId, refreshToken}){

    if(userId){
        await promisify(database.hdel(`users:${userId}`, `_refreshToken`))
    }
    if(refreshToken){
        const [errDecode, tokenData] = await promisify(getDecodedRefreshToken(refreshToken))
        if(errDecode || _.lte(tokenData, 0) || !tokenData.id) return -1

        const storedHex = await getRefreshTokenHexById(tokenData.id)
        if(_.lte(storedHex, 0) || !storedHex.refreshToken || !storedHex.userId) return -2

        if(!_.isEqual(storedHex.refreshToken, refreshToken)) return -3

        let hex = getExtractedDataByTokenHex(storedHex) //extract the stored token hash
        if(!hex) return -4

        await promisify(database.hdel(`users:${hex.userId}`, `_refreshToken`))
        await promisify(database.hdel(`users:_tokens`, `${tokenData.id}:`))
    }
    return true
}

async function unsetTokens({userId, refreshToken}){
    let uId = userId ? userId : await getUserRefreshTokenByUserId(userId)
    let rToken = refreshToken ? refreshToken : await getUserIdByRefreshToken(refreshToken)
    return await invalidate({userId: uId, refreshToken: rToken})
}

module.exports = {
    getUserRefreshTokenByUserId,
    getUserRefreshTokenByUserIdExists,
    getRefreshTokenHexExistsById,
    setTokens,
    setTokensUseExisting,
    unsetTokens,
    validateDbRefreshTokenExists,
    validateDbRefreshTokenMatchesForUserId,
    validateDbRefreshToken,
}