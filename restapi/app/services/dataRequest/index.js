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
const config = require('../../config')
const {promisify} = require('../../utils')
const database = require('../../store').db
const UserStore = require('../UserStore')

const _has = require('lodash/has')
const jwt = require('jsonwebtoken')
const uuidv4 = require('uuid/v4')
const _isEqual = require('lodash/isEqual')
const _toInteger = require('lodash/toInteger')
const _ = require('lodash')
const _size = require('lodash/size')
const _isEmpty = require('lodash/isEmpty')
const _reduce = require('lodash/reduce')
const _isObject = require('lodash/isObject')
const _set = require('lodash/set')
const _get = require('lodash/get')
const _words = require('lodash/words')
const _remove = require('lodash/remove')
const _split = require('lodash/split')
const _map = require('lodash/map')
const _indexOf = require('lodash/indexOf')
const _each = require('lodash/each')
const _keys = require('lodash/keys')

const fs = require('fs')
const archiver = require('archiver')

//TODO: this needs to go into a queue system

//takes each user data object and places it into a file
async function zipUserData(fileName = uuidv4(), data){
    let archive = archiver('zip', {})
    let output = fs.createWriteStream(`${__dirname}/zips/${fileName}.zip`);
    let jsonstr
    _map(data, ([userField, data]) => {
        jsonstr = _isObject(data) ? JSON.stringify(data) : data
        archive.append(jsonstr, { name: `${userField}.json` });
    })
   archive.finalize()

    await new Promise(function(resolve, reject) {
        output.on(`close`, function() {
            console.log(archive.pointer() + ` total bytes`);
            console.log(`archiver has been finalized and the output file descriptor has closed.`);
            resolve();
        });
        output.on(`error`, reject);
        output.on('end', function() {
            console.log('Data has been drained');
        });
        archive.pipe(output);
    });

   // good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', function(err) {
        if (err.code === 'ENOENT') {
            // log warning
        } else {
            // throw error
            throw err;
        }
    });

    // good practice to catch this error explicitly
    archive.on('error', function(err) {
        throw err;
    });

    return fileName
}

async function processAppSaves(array, userId){
    let data = []
    for (const appName of _keys(array)){
        let result = await UserStore.getUserDataApp(userId, appName, {fields: [`data:${appName}`]})
        result = _get(result, `data:${appName}`, {})
        data.push(['appData-'+appName, result])
    }
    return data
}
//get all date related to user and spits it out (formats it too)
async function getUserDataArr(data){
    console.log('generate', data)
    if(!_get(data, 'userId')) return false
    if(!_get(data, 'fileName')) return false

    let userSummary = await UserStore.getUserData(data.userId)
    let appSaves = _get(userSummary, '_appSaves')
    let zipData = [['userData', userSummary]]

    if(appSaves){
        appSaves = _isEqual(typeof appSaves, 'string') ? JSON.parse(appSaves) : appSaves
        if(_isObject(appSaves)){
            zipData = zipData.concat(await processAppSaves(appSaves, data.userId))
        }
    }
    return zipData
}

//finds the file for the id
function getUserDataFilePath(fileId){
    let filePath
    if(fileId){
        filePath = `${__dirname}/zips/${fileId}.zip`
        return fs.existsSync(filePath) ? filePath : false
    }
    return false
}

function removeUserDataFile(fileId) {
    console.log('fileId is ', fileId)

    if (!fileId) return true
    let filePath = getUserDataFilePath(fileId)
    console.log('filepath found is ', filePath)
    if (!filePath) return true

    //just return true, let node take care of this in the bg so user not held up with deleting
    fs.unlink(filePath, (err) => {
        console.log('unlinked file', filePath, err)
        if (err) throw err
    })

    return true
}

async function removeStoredUserDataFile(userId){
    console.log('here in removed store')
    let lastDataRequestFileName = await database.hget(`users:${userId}`, '_lastDataRequestId')
    console.log('lastDataRequestId is ', lastDataRequestFileName)
    if(!lastDataRequestFileName) return true

    return await removeUserDataFile(lastDataRequestFileName)
}
module.exports = {
    getUserDataArr,
    zipUserData,
    getUserDataFilePath,
    removeStoredUserDataFile,
    removeUserDataFile,
}