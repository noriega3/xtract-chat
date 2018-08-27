const Promise = require('bluebird')
const {promisify} = require('../utils')
const database = require('../store').db
const {
    compareJsons,
    filterChanges
} = require('./util')

const _ = require('lodash')

const _isEqual = require('lodash/isEqual')
const _toInteger = require('lodash/toInteger')
const _isEmpty = require('lodash/isEmpty')
const _reduce = require('lodash/reduce')
const _set = require('lodash/set')
const _get = require('lodash/get')
const _map = require('lodash/map')
const _indexOf = require('lodash/indexOf')

//==================================================================================
// Getters

async function getUserLastAppByUserId(userId){
    //TODO: convert to share with _search key
    let [err, result] = await promisify(database.hget(`users:${userId}`, '_lastApp'))
    if(err) return false
    return result || false
}
async function getUserEmailByUserId(userId){
    //TODO: convert to share with _search key
    let [err, result] = await promisify(database.hget(`users:${userId}`, '_emailAddress'))
    if(err) return false
    return result || false
}
async function getUserAccountIdByUserId(userId){
    //TODO: convert to share with _search key
    let [err, result] = await promisify(database.hget(`users:${userId}`, '_accountId'))
    if(err) return false
    return result || false
}

async function getUserAuthTokenByUserId(userId, appName){
    let [err, result] = await promisify(database.hget(`users:${userId}`, `data:${appName}:auth`))
    if(err) return false
    return result || false
}

async function getUserFacebookIdByUserId(userId){
    //TODO: convert to share with _search key
    let [err, result] = await promisify(database.hget(`users:${userId}`, '_facebookId'))
    console.log(err,result)
    if(err) return false
    return result || false
}

async function getUserAppDataExists(userId, appName){
    let [err, result] = await promisify(database.hexists(`users:${userId}`, `data:${appName}`))
    if(err) return false
    return _isEqual(result,1)
}

async function getUserAppDataPathExists(userId, appName, path){
    let hasData = await getUserAppDataExists(userId, appName)
    if(!hasData) return false
    let [errData, appData] = await getUserAppData(userId, appName)
    if(!errData) return false
    return _.has(appData, path)
}

async function getUserAppData(userId, appName){
    let [err, result] = await promisify(database.hget(`users:${userId}`, `data:${appName}`))
    if(err) return false
    return result || false
}

async function getUserAppDataPath(userId, appName, path){
    let appData = await getUserAppData(userId, appName)
    if(!appData) return undefined
    return _.get(appData, path)
}

async function getUserLastLoginType(userId){
    let [errGet, current] = await promisify(database.hget(`users:${userId}`, '_lastLoginType'))
    if(errGet) return false
    return current
}

async function getAccountTypeByUserId(userId){
    let [errGet, current] = await promisify(database.hget(`users:${userId}`, '_type'))
    if(errGet) return false
    return current
}

async function getUserIdByEmail(identifier){
    let [err, result] = await promisify(database.hget(`users:_emails`, identifier))
    if(err) return false
    return _toInteger(result) || false
}

async function getUserIdByFacebookId(identifier){
    let [err, result] = await promisify(database.hget(`users:_facebook`, identifier))
    if(err) return false
    return _toInteger(result) || false
}

async function getUserByAccountId(identifier){
    //TODO: not done yet need to convert on server to use users:_deviceIds
    let [err, result] = await promisify(database.hget(`users`, identifier))
    if(err || !result) return false
    return _toInteger(result) || false
}

async function getUserIdByDeviceId(identifier){
    //TODO: not done yet need to convert on server to use users:_deviceIds
    let userId = getUserByAccountId(identifier)
    if(!userId) return -1
    let [errType, type] = await promisify(database.hget(`users:${userId}`, '_type'))
    if(errType || !_.isEqual(type, 'guest')) return -2
    return userId
}

async function getUserLoginData(userId){
    const fields = ['_accountId', '_emailAddress', '_type', '_facebookId', '_roles', '_refreshToken', '_password']
    const savedData = await database.hmget(`users:${userId}`, fields).catch((error)=>console.log(error));
    return _reduce(savedData, function(userData, value, i) {
        if(value) _set(userData, fields[i], value)
        return userData
    }, {'_userId': userId, '_roles': '[]'})
}

async function getUserData(userId){
    const fields = ['_accountId', '_emailAddress', '_type', '_facebookId', '_roles', '_appSaves', '_lastApp']
    const savedData = await database.hmget(`users:${userId}`, fields).catch((error)=>console.log(error));
    return _reduce(savedData, function(userData, value, i) {
        if(value) _set(userData, fields[i], value)
        return userData
    }, {'_userId': userId})
}

async function getUserDataApp(userId, appName, options = {}){
    if(!userId) throw new Error('USER ID NOT FOUND')
    const field = name => `data:${appName}:${name}`

    //TODO: make dynamic based on a global key
    const fields = options.fields ? options.fields :
        [
            `data:${appName}`,
            field('auth'),
            field('avatar'),
            field('consecutiveDays'),
            field('lastSyncTime'),
            field('level'),
            field('score'),
            field('username')
        ]

    const savedData = await database.hmget(`users:${userId}`, fields).catch((error)=>console.log(error));
    return _reduce(savedData, function(userData, value, i) {
        if(value) _set(userData, fields[i], value)
        return userData
    }, {})
}

async function getUserIdByAccount(accountId){
    let [errExists, exists] = await promisify(database.hexists('users', accountId))
    if(errExists || _isEqual(exists, 0)) throw new Error('ACCOUNT NOT FOUND')
    let [errId, userId] = await promisify(database.hget('users', accountId))
    if(errId || !userId) throw new Error('USER ID NOT FOUND')
    return _.toInteger(userId) || false
}

async function getUsersBySearchByScan(query, cursor = 0, count = 5){
    const [scanErr, scanResults] = await promisify(database.hscan('users', cursor, 'MATCH' ,`*${query}*`, 'COUNT', count))
    if(scanErr || _.size(scanResults) <= 0) throw new Error('No Users Found')
    const nextCursor = scanResults[0]
    const accountIds = scanResults[1]

    const [errIds, userIds] = await promisify(database.hmget('users', accountIds))
    if(errIds || _.size(userIds) <= 0) throw new Error('No Users Found')

    const data = !accountIds ? [] : _map(accountIds, (val, i) => [userIds[i], val])
    return {data, nextCursor}
}

async function getUsersBySearchByLex(query){
    //TODO: when ioredis-mock implements lexastores then we can test this to be much faster than scan

    return []
}

async function getUserIdExists(userId){
    const [errExists, userExists] = await promisify(database.exists('users', userId))
    if(errExists) return false
    return _isEqual(userExists, 1)
}

async function getUserPasswordExists(userId){
    let [errGet, existResp] = await promisify(database.hexists(`users:${userId}`, '_password'))
    if(errGet) throw new Error('Invalid query for '+ userId)
    return existResp === 1
}

async function getUserFacebookIdExists(userId){
    let [errGet, existResp] = await promisify(database.hexists(`users:${userId}`, '_facebookId'))
    if(errGet) throw new Error('Invalid query for '+ userId)
    return existResp === 1
}

async function getUserEmailExists(userId){
    let [errGet, existResp] = await promisify(database.hexists(`users:${userId}`, '_emailAddress'))
    if(errGet) throw new Error('Invalid query for '+ userId)
    return existResp === 1
}

async function getUserPassword(userId){
    let [errGet, current] = await promisify(database.hget(`users:${userId}`, '_password'))
    if(errGet) return false
    return current
}

//Validators

async function validateAccountType(userId, intendedType){
    let [errGet, current] = await promisify(getAccountTypeByUserId(userId))
    if(errGet) return false
    return _isEqual(intendedType, current)
}

async function validateCurrentFbId(userId, fbId){
    let [errGet, current] = await promisify(getUserFacebookIdByUserId(userId))
    if(errGet) return false
    if(!current) return -1
    return _isEqual(fbId, current)
}

async function validateCurrentDeviceId(userId, accId){
    let [errGet, current] = await promisify(getUserAccountIdByUserId(userId))
    if(errGet) return false
    if(!current) return -1
    return _isEqual(accId, current)
}

async function validateCurrentPassword(userId, password){
    let [errGet, current] = await promisify(getUserPassword(userId))
    if(errGet) return false
    if(!current) return -1
    return _isEqual(password, current)
}

async function validateCurrentEmail(userId, email){
    let [errGet, current] = await promisify(getUserEmailByUserId(userId))
    if(errGet) return false
    if(!current) return -1
    return _isEqual(email, current)
}

async function validateAuthToken(userId, authToken, appName){
    let [errGet, current] = await promisify(getUserAuthTokenByUserId(userId, appName))
    if(errGet) return false
    if(!current) return -1
    return _isEqual(authToken, current)
}

//==================================================================================
// Setters

async function setUserPassword(userId, nextPassword){
    let [errSet, updated] = await promisify(database.hmset(`users:${userId}`, '_password', nextPassword))
    if(errSet || !updated) return errSet
    return true
}

async function setUserLastLoginType(userId, type){
    let [errSet, updated] = await promisify(database.hmset(`users:${userId}`, '_lastLoginType', type))
    if(errSet || !updated) return errSet
    return true
}

async function setUserAppData(userId, appName, {prev, ...next}){

    const {field, value, type} = filterChanges(next, prev)
    compareJsons(next.value, prev.value)
    console.table(next.value)

    //set it normally with setUserData
    //update the 'shortcut props' if needed

    //ensure field starts with appName
    if(!_.startsWith(next.field, `data:${appName}`)) return getUserDataApp(userId, appName)  //starts with data:**

    //get current key value
    let [errExist, fieldExists] = await promisify(database.hexists(`users:${userId}`, field || next.field))
    if(errExist) return getUserDataApp(userId, appName)  //if renaming, make sure field doesn't already exist

    if(field){
        //Note: don't delete old field, let client do that manually

        //ensure that new field name doesn't already exist
        if(_isEqual(fieldExists, 1)) return getUserDataApp(userId, appName)  //if renaming, make sure field doesn't already exist

        if(!value){
            //do a copy of current values in the db
            let [errPrev, prevValue] = await promisify(database.hget(`users:${userId}`, prev.field))
            if(errPrev) return getUserDataApp(userId, appName)

            let [errSet, updated] = await promisify(database.hset(`users:${userId}`, field, prevValue))
            if(errSet) return getUserDataApp(userId, appName)
            console.log('new/updated field', updated)

        }
    }

    if(value){
        //make sure current field exists
        if(_isEqual(fieldExists, 0)) return getUserData(userId)  //make sure field does exist

        let [errSet, updated] = await promisify(database.hset(`users:${userId}`, next.field, value))
        if(errSet) return getUserDataApp(userId, appName)

        console.log('updated value', updated)
    }

    //verify based on options

    //check if key is used in other places and update those places too
    //todo: need a dynamic db key to call upon

    return getUserDataApp(userId, appName)
}


async function setUserAppData2(userId, appName, value){
    let [errSet, updated] = await promisify(database.hset(`users:${userId}`, `data:${appName}`, value))
    if(errSet || !updated) return errSet
    return true
}

async function setUserAppDataPath(userId, appName, path, value){
    let appData = await getUserAppData(userId, appName)
    if(!appData) return undefined

    let setData = _.set(appData, path, value)
    if(!setData) return false

    return await setUserAppData2(userId, appName, setData)
}

async function setUserData(userId, {prev, ...next}){
    const {field, value, type} = filterChanges(next, prev)
    console.log('change', filterChanges(next, prev))

    let [errExist, fieldExists] = await promisify(database.hexists(`users:${userId}`, field || next.field))

    if(errExist) return getUserData(userId)  //if renaming, make sure field doesn't already exist

    if(field){
        //Note: don't delete old field, let client do that manually

        //ensure that new field name doesn't already exist
        if(_isEqual(fieldExists, 1)) return getUserData(userId)  //if renaming, make sure field doesn't already exist

        if(!value){
            //do a copy of current values in the db
            let [errPrev, prevValue] = await promisify(database.hget(`users:${userId}`, prev.field))
            if(errPrev) return getUserData(userId)

            let [errSet, updated] = await promisify(database.hset(`users:${userId}`, field, prevValue))
            if(errSet) return getUserData(userId)
            console.log('new/updated field', updated)

        }
    }

    if(value){
        //make sure current field exists
        if(_isEqual(fieldExists, 0)) return getUserData(userId)  //if renaming, make sure field doesn't already exist

        let [errSet, updated] = await promisify(database.hset(`users:${userId}`, next.field, value))
        if(errSet) return getUserData(userId)

        console.log('updated value', updated)
    }

    //check if key is used in other places and update those places too
    //todo: need a dynamic db key to call upon

    //return new summary 'userData'
    return getUserData(userId)
}

async function updateAppSaveUserType(app, fieldValues){
    console.log('appname', app)
    let dataKey = `data:${app}`
    let {userId} = fieldValues
    let [errAppData, appData] = await promisify(database.hget(`users:${userId}`, `data:${app}`))
    if(errAppData || !appData) throw new Error('Invalid app data')

    appData = JSON.parse(appData)

    _.each(fieldValues, (value, key) => {
        appData = _.set(appData, `userData.${key}`, value)
    })

    console.log('appData after set', appData)

    appData = JSON.stringify(appData)
    let [errSaved, saved] = await promisify(database.hset(`users:${userId}`, dataKey, appData))
    console.log(errSaved, saved)
    if(errSaved || !_.isEqual(saved,0)) throw new Error('invalid saved data')
    return saved
}

//==================================================================================
//Custom guest functions

async function changeUserGuestToEmail(guestUserId, reqBody){

    try {
        //reqBody will contain email and password for new user to associate to
        //first get a new id
        let [errNextId, userId] = await promisify(database.incr(`users:_nextId`))
        if(errNextId || !userId) new Error('Invalid user incrementation')

        let user            = `users:${userId}`
        let emailAddress    = _get(reqBody, 'emailAddress')
        let accountId       = _get(reqBody, 'emailAddress')
        let password        = _get(reqBody, 'nextConfirm')

        //TODO: fix multiple apps bug  with fb id

        //Copy data from guest to new user id
        let [errRename, rename] = await promisify(database.rename(`users:${guestUserId}`, user))
        if(errRename || !rename) new Error('Invalid rename')

        let [errSet, set] = await promisify(database.hset(user, '_setup', Date.now()))
        if(errSet || !set) new Error('Invalid setup flag')

        //TODO: when logging in, make sure no one starts writing to users:userid when a _setup flag is present

        //update each app inside this guest account with new ids
        //get app saves
        let [errSaves, appSaves] = await promisify(database.hget(user, '_appSaves'))
        console.log('app saves raw', appSaves)
        appSaves = appSaves ? JSON.parse(appSaves) : []
        if(errSaves || !appSaves) new Error('Invalid app saves')
        console.log('app saves parsed', appSaves)

        if(!_.isEmpty(appSaves)){
            await Promise.map(_.keys(appSaves), (app) => {
                console.log('next app save', app)
                return updateAppSaveUserType(app, {emailAddress, userId, accountType: 'email', accountId})
            })
        }

        let [errUpdate, updated] = await promisify(
            database.multi()
                .hset(user, '_fromGuestId', guestUserId)
                .hset(user, '_type', 'email')
                .hset(user, '_emailAddress', emailAddress)
                .hset(user, '_accountId', emailAddress)
                .hset(user, '_password', password)
                .hdel(user, '_setup')
                .hset(`users`, emailAddress, userId) //finally set
                .hset(`users:_emails`, emailAddress, userId) //finally set
                .exec()
        )

        if(errUpdate || !updated) new Error('Could not update new user account')
        console.log(await promisify(database.get('users')))
        return true
    } catch(err) {
        console.error(err)

        return false
    }
}

async function userIdIsStaff(userId){
    const [errExists, exists] = await promisify(database.hexists('users', userId, '_roles'))
    if(errExists || !_isEqual(exists, 1)) return false

    const [errRoles, userRoles] = await promisify(database.hget('users', userId, '_roles'))
    if(errRoles || !_isEmpty(userRoles)) return false
    return _indexOf(userRoles, 'a') >= 0
}

async function unsetFacebookId(userId){
    try {
        let [errGetFbId, fbId] = await promisify(database.hget(`users:${userId}`, '_facebookId'))
        if(errGetFbId || !fbId) return new Error('INVALID FB ID')

        let [errRemAssociation, remAssociation] = await promisify(database.hdel(`users:${userId}`, '_facebookId'))
        if(errRemAssociation || !remAssociation) return new Error('INVALID REMOVAL OF FBID ON USER')

        let [errRemFbId, remFbId] = await promisify(database.hdel(`users:_facebook`, fbId))
        if(errRemFbId || !remFbId) return new Error('INVALID REMOVAL OF FBID ON LIST')

        return true

    } catch(err) {
        console.log('unset failure', err)
        return false
    }
}
module.exports = {

    getUserFacebookIdExists,
    getUserLastAppByUserId,
    getUserEmailByUserId,
    getUserData,
    getUserDataApp,
    getUsersBySearchByScan,
    getUserIdByAccount,
    getAccountTypeByUserId,
    getUserIdExists,
    getUserPasswordExists,
    getUserLoginData,
    getUserLastLoginType,

    validateAccountType,
    validateCurrentEmail,
    validateCurrentPassword,
    validateCurrentFbId,
    validateAuthToken,
    validateCurrentDeviceId,

    setUserLastLoginType,
    setUserData,
    setUserAppData,
    setUserPassword,

    unsetFacebookId,
    changeUserGuestToEmail

}