import jwtDecode from 'jwt-decode'
import * as auth from '../actions/apiAuthActions'
import _ from 'lodash'
import * as profile from '../actions/apiProfileActions'
const parseJson = (str) => _.attempt(JSON.parse.bind(null, str))

const initialState = {
	processing: false,
	logout: undefined,
	refresh: undefined,
	access: undefined,
	errors: {}
}

export default function (state = initialState, action) {
	console.log(action.payload)
	const type = _.get(action, 'type', 'invalid')
	switch (type) {
		case profile.REGISTER_SUCCESS:
		case auth.LOGIN_SUCCESS:
			return {
				processing: false,
				logout: false,
				access: {
					token: action.payload.auth.access,
					...jwtDecode(action.payload.auth.access)
				},
				refresh: {
					token: action.payload.auth.refresh,
					...jwtDecode(action.payload.auth.refresh)
				},
				errors: {}
			}
		case auth.TOKEN_RECEIVED:
			console.log('tokens received', action.payload)
			return {
				...state,
				processing: false,
				refresh: {
					token: action.payload.auth.refresh,
					...jwtDecode(action.payload.auth.refresh)
				},
				access: {
					token: action.payload.auth.access,
					...jwtDecode(action.payload.auth.access)
				}
			}
		case auth.LOGIN_FAILURE:
		case auth.TOKEN_FAILURE:
			return {
				processing: false,
				logout: undefined,
				refresh: undefined,
				access: undefined,
				errors: action.payload.response || {'global_error': action.payload},
			}
		case auth.LOGOUT_SUCCESS:
			return {
				...initialState,
				processing: false,
				logout: true
			}
		case profile.FBID_DISCONNECT_SUCCESS:
			return _.set(_.cloneDeep(state), 'access.user.fbId', undefined)
		case profile.REGISTER_FAILURE:
			return {
				...state,
				processing: false,
				errors: action.payload.response || {'global_error': action.payload},
			}
		default:
			return state
	}
}

export function accessToken(state) {
	if (state.access) {
		return  state.access.token
	}
}

export function refreshToken(state) {
	if (state.refresh) {
		return  state.refresh.token
	}
}

export function userId(state) {
	return _.get(state,'access.user.uId')
}

export function userFbId(state) {
	return _.get(state,'access.user.fbId')
}

export function userAccountId(state) {
	return _.get(state,'access.user.aId')
}

export function userAccountType(state) {
	return _.get(state,'access.user.aType')
}

export function userHasPassword(state) {
	return _.isEqual(_.get(state,'access.user.pass', false), true) //ensure still a bool
}

export function isAccessTokenExpired(state) {
	if (state.access && state.access.exp) {
		console.log('access token is expired',((1000 * state.access.exp) - (new Date()).getTime()))
		return ((1000 * state.access.exp) - (new Date()).getTime()) < 5000
	}
	return true
}
export function isRefreshTokenExpired(state) {
	if (state.refresh && state.refresh.exp) {
		console.log('refresh token is expired', ((1000 * state.refresh.exp) - (new Date()).getTime()))
		return ((1000 * state.refresh.exp) - (new Date()).getTime()) < 5000
	}
	return true
}
export function isAuthenticated(state) {
	return !isRefreshTokenExpired(state)
}

export function isRoleAdmin(state) {
		if (state.access && state.access.user.roles) {
			return _.indexOf(state.access.user.roles, 'a') >= 0
		}
		return false
}

export function isRoleStaff(state) {
		if (state.access && state.access.user.roles) {
				return (_.indexOf(state.access.user.roles, 'a') >=0) || (_.indexOf(state.access.user.roles, 's') >=0)
		}
		return false
}

export function errors(state) {
	return  state.errors
}

export function apiBusy(state) {
	return  state.processing
}
export function didLogout(state) {
	return  state.logout
}
