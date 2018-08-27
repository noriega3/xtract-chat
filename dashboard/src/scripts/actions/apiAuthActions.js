import { RSAA } from 'redux-api-middleware';
import { withAuth } from '../reducers'

export const LOGIN_REQUEST = '@@auth/LOGIN_REQUEST'
export const LOGIN_SUCCESS = '@@auth/LOGIN_SUCCESS'
export const LOGIN_FAILURE = '@@auth/LOGIN_FAILURE'

export const LOGOUT_REQUEST = '@@auth/LOGOUT_REQUEST'
export const LOGOUT_SUCCESS = '@@auth/LOGOUT_SUCCESS'
export const LOGOUT_FAILURE = '@@auth/LOGOUT_FAILURE'

export const TOKEN_REQUEST = '@@auth/TOKEN_REQUEST'
export const TOKEN_RECEIVED = '@@auth/TOKEN_RECEIVED'
export const TOKEN_FAILURE = '@@auth/TOKEN_FAILURE'

//TODO: use proxy instead of direct api uri. (https://medium.com/@viewflow/full-stack-django-quick-start-with-jwt-auth-and-react-redux-part-ii-be9cf6942957)
export const login = (payload) => {
	console.log(payload, 'p sent')

	return ({
		[RSAA] : {
			endpoint: `/api/v2/auth/login`,
			method: 'POST',
			body: JSON.stringify(payload),
			headers: { 'Content-Type': 'application/json' },
			types: [LOGIN_REQUEST, LOGIN_SUCCESS, LOGIN_FAILURE]
		}
	})
}

export const logout = (payload) => ({
	[RSAA] : {
		endpoint: `/api/v2/auth/logout`,
		method: 'POST',
		body: JSON.stringify(payload),
		headers: withAuth({ 'Content-Type': 'application/json' }),
		types: [LOGOUT_REQUEST, LOGOUT_SUCCESS, LOGOUT_FAILURE]
	}
})

export const refresh = (payload) => ({
	[RSAA] : {
		endpoint: `/api/v2/auth/refresh`,
		method: 'POST',
		body: JSON.stringify(payload),
		headers: { 'Content-Type': 'application/json' },
		types: [TOKEN_REQUEST, TOKEN_RECEIVED, TOKEN_FAILURE]
	}
})
