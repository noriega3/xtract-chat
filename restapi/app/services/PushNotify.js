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

const gcm = require('node-gcm')
const config = require('../config')

// Set up the sender with your GCM/FCM API key (declare this once for multiple messages)
const sender = new gcm.Sender(config.fcm)
const jwt = require('jsonwebtoken')

const database = require('../store').db
const _has = require('lodash/has')
const uuidv4 = require('uuid/v4')
const _isEqual = require('lodash/isEqual')
const _toInteger = require('lodash/toInteger')
const _size = require('lodash/size')
const _isEmpty = require('lodash/isEmpty')
const _reduce = require('lodash/reduce')
const _isObject = require('lodash/isObject')
const _set = require('lodash/set')
const _get = require('lodash/get')
const _words = require('lodash/words')
const _remove = require('lodash/remove')
let storedRefreshTokens = {}


function generateDeleteToken(){
    return uuidv4()
}
async function sendDeleteToken(deviceToken, deleteToken = generateDeleteToken()){

    // Prepare a message to be sent
    const message = new gcm.Message({
        data: { delToken: deleteToken  }
    });

    const [err,response] = await sender.send(message, { registrationTokens: [deviceToken] }).catch(console.error);
    return [err, response]
}

module.exports = {
    generateDeleteToken,
    sendDeleteToken,
}