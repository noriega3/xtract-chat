const UserStore = require('../services/UserStore')
const TokenStore = require('../services/TokenStore')
const _ = require('lodash')

const {
    getLoginType
} = require('./util')


//TODO: switch to mongo from for a better data structure (mongo/mongoose)
const UserModel = {
    session: undefined,
    auth: undefined,

    async requestLogin(body) {
        const loginType = getLoginType(body)
        const useCurrentToken = _.has(body, 'dashboardToken')
        //perform login of certain type

        const userId = await (async () => {
            switch(loginType) {
                case 'email':
                case 'facebook':
                case 'deviceId':
                    return await UserStore.getUserIdByAccount(body.deviceId || body.email)
                default:
                    return false
            }
        })()

        const validCredentials = await (async () => {
            //immediately check if there is a login type
            let isValid = _.has(body, 'loginType')
            if(!isValid) throw new Error('Empty login type')

            switch(loginType) {
                case 'email':
                    isValid = isValid && await UserStore.validateAccountType(userId, 'email')
                    if(!isValid || _.lte(isValid, 0)) throw new Error('Invalid login type selected')
                    isValid = _.has(body, 'password') && _.has(body, 'email')
                    isValid = isValid && await UserStore.validateCurrentPassword(userId, body.password)
                    isValid = isValid && await UserStore.validateCurrentEmail(userId, body.email)
                    if(!isValid || _.lte(isValid, 0)) throw new Error('Invalid email/password combination')
                    break;
                case 'facebook':
                    isValid = isValid && await UserStore.validateAccountType(userId, 'email')
                    if(!isValid || _.lte(isValid, 0)) throw new Error('Invalid login type')
                    isValid = _.has(body, 'email') && _.has(body, 'facebookId')
                    isValid = isValid && await UserStore.validateCurrentFbId(userId, body.facebookId)
                    if(!isValid || _.lte(isValid, 0)) throw new Error(_.isEqual(isValid, -1) ? 'Account not associated to facebook' : 'Invalid facebook id')
                    isValid = isValid && await UserStore.validateCurrentEmail(userId, body.email)
                    if(!isValid || _.lte(isValid, 0)) throw new Error('Invalid email associated with facebook')
                    break;
                case 'deviceId':
                    isValid = isValid && await UserStore.validateAccountType(userId, 'guest') //assumes guests are always going to be device id accounts
                    if(!isValid || _.lte(isValid, 0)) throw new Error('Invalid login type selected')
                    isValid = _.has(body, 'authToken') && _.has(body, 'deviceId')
                    isValid = isValid && await UserStore.validateCurrentDeviceId(userId, body.deviceId)
                    if(!isValid || _.lte(isValid, 0)) {
                        await UserStore.getAccountTypeByUserId(userId)
                        throw new Error('Invalid deviceId/auth combination')
                    }
                    break;
                default:
                    throw new Error('Invalid login credentials')
            }

            if(_.has(body, 'authToken')){
                //Note: dashboard token == refresh token from app's call to the login function previously
                let lastApp = await UserStore.getUserLastAppByUserId(userId)
                isValid = await UserStore.validateAuthToken(userId, body.authToken, lastApp)
                if(!isValid || _.lte(isValid, 0)) throw new Error('Invalid auth token')

            }

            if(useCurrentToken){
                isValid = await TokenStore.validateDbRefreshToken(userId, body.dashboardToken)
                if(!isValid || _.lte(isValid, 0)) throw new Error(`Invalid dashboard token. Error: ${isValid || -999}`)
            }

            return isValid
        })()

        console.log('waiting uid', userId)
        console.log('creds', validCredentials)
        if(!userId) throw new Error('Invalid user id')
        if(!validCredentials || _.lte(validCredentials, 0)) throw new Error('Invalid login credentials')

        //set user id and last login type for the session model
        _.set(this, 'session.uId', userId)
        _.set(this, 'session.lType', loginType)

        //set last login type on store
        let setLoginType = await UserStore.setUserLastLoginType(this.session.uId, this.session.lType)
        if(!setLoginType) throw new Error('Invalid login type set')

        //retrieve validated user login data
        const userLogin = await this.requestUserLoginData()
        if(!userLogin) throw new Error('Invalid user data')

        let auth
        if(useCurrentToken){
            auth = await TokenStore.setTokensUseExisting(this.session, useCurrentToken)
        } else {
            auth = await TokenStore.setTokens(this.session)
        }
        if(!auth) throw new Error('Invalid token set')

        this.auth = auth

        return {...this.session, auth}
    },

    async requestUserLoginData(){
        if(!_.get(this,'session.uId')) throw new Error('Invalid user data')

        const userLogin = await UserStore.getUserLoginData(_.get(this,'session.uId'))
        if(!userLogin) throw new Error('Invalid user data')

        let userId  = _.get(userLogin,'_userId')
        if(!userId) throw new Error('Invalid user id received')
        let isValid = _.isEqual(userId, _.get(this,'session.uId'))
        if(!isValid) throw new Error('Invalid user id match')

        let accountId  = _.get(userLogin,'_accountId')
        if(!accountId) throw new Error('Invalid account id received')

        //NOTE: this.session is used to create the token and will be public facing!
        _.set(this, 'session.uId', userId)
        _.set(this, 'session.pass', _.has(userLogin, '_password')) //true/false
        _.set(this, 'session.aId', accountId)
        _.set(this, 'session.aType', _.get(userLogin,'_type', 'guest')) //account type
        _.set(this, 'session.fbId', _.get(userLogin,'_facebookId', false))
        _.set(this, 'session.roles',  _.words(_.get(userLogin, '_roles', ''))) //default to guest 'blank'
        return userLogin
    },

    async requestRefresh(user, body) {
        const currentId = _.get(this,'session.uId', _.get(user, 'uId'))
        if(!currentId) throw new Error('Not logged in')

        const userId = _.get(this, 'session.uId')
        const rToken = _.get(body, 'rtoken', _.get(body, 'token')) //TODO only refresh token for now and check if rtoken is present first
        if(!rToken) throw new Error(`No token specified`)

        let isValid = TokenStore.validateDbRefreshTokenMatchesForUserId(userId, rToken)
        if(_.lte(isValid, 0)) throw new Error(`Token mismatch. Code: ${isValid}`)

        isValid = await TokenStore.validateDbRefreshTokenExists(rToken)
        if(_.lte(isValid, 0)) throw new Error(`Invalid token exists. Code: ${isValid}`)

        let lastLoginType = await UserStore.getUserLastLoginType(this.session.uId) //login type
        if(_.lte(lastLoginType, 0)) throw new Error(`Invalid login type. Code: ${lastLoginType}`)

        let userLogin = await this.requestUserLoginData()
        if(_.lte(userLogin, 0)) throw new Error(`Invalid user data. Code: ${userLogin}`)

        let nextAuth = await TokenStore.setTokens(this.session)
        if(_.lte(nextAuth, 0)) throw new Error(`Invalid token set. Code: ${nextAuth}`)

        _.set(this, 'session.lType', lastLoginType)
        return {...this.session, auth: nextAuth}
    },
    async requestLogout(user, body) {
        if(!_.get(this,'session.uId')) return false
        const userId = _.get(this, 'session.uId')
        const token = _.get(body, 'rtk')

        if(!token) throw new Error(`No token specified`)

        let isValid = await TokenStore.getUserRefreshTokenByUserIdExists(userId)
        if(isValid) return false

        isValid = await TokenStore.validateDbRefreshTokenExists(token)
        if(_.lte(isValid, 0)) throw new Error(`Invalid token set.. Code: ${isValid}`)

        isValid = await TokenStore.validateDbRefreshTokenMatchesForUserId(userId, token)
        if(_.lte(isValid, 0)) throw new Error(`Invalid token set. Code: ${isValid}`)

        const result = await TokenStore.unsetTokens({userId, token})
        if(!result) throw new Error(`INVALID LOGOUT DATA. CODE: ${result}`)

        _.set(this, 'session', undefined)
        _.set(this, 'auth', undefined)

        return result
    }
}

module.exports = UserModel