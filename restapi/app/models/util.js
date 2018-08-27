const _has = require('lodash/has')
const _get = require('lodash/get')

function getLoginType(loginData={}){
    console.log(loginData)
    if(_has(loginData, 'loginType'))
        return _get(loginData, 'loginType')
    if(_has(loginData, 'email')) {
        if(_has(loginData, 'password'))
            return 'email'
        if(_has(loginData, 'facebookId'))
            return 'facebook'
    } else if(_has(loginData, 'deviceId')) {
        return 'deviceId'
    } else {
        throw new Error('INVALID LOGIN TYPE')
    }
}

module.exports = {
    getLoginType
}