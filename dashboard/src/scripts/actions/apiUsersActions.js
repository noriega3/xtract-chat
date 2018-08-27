import { RSAA } from 'redux-api-middleware';
import { withAuth } from '../reducers'
export const USER_ID_REQUEST = '@@account/USER_ID_REQUEST';
export const USER_ID_SUCCESS = '@@account/USER_ID_SUCCESS';
export const USER_ID_FAILURE = '@@account/USER_ID_FAILURE';

export const PROFILE_REQUEST = '@@user/USER_PROFILE_REQUEST';
export const PROFILE_SUCCESS = '@@user/USER_PROFILE_SUCCESS';
export const PROFILE_FAILURE = '@@user/USER_PROFILE_FAILURE';

export const PROFILE_SET_REQUEST = '@@user/USER_PROFILE_SET_REQUEST';
export const PROFILE_SET_SUCCESS = '@@user/USER_PROFILE_SET_SUCCESS';
export const PROFILE_SET_FAILURE = '@@user/USER_PROFILE_SET_FAILURE';

export const APPDATA_REQUEST = '@@user/USER_APPDATA_REQUEST';
export const APPDATA_SUCCESS = '@@user/USER_APPDATA_SUCCESS';
export const APPDATA_FAILURE = '@@user/USER_APPDATA_FAILURE';

export const APPDATA_SET_REQUEST = '@@user/USER_APPDATA_SET_REQUEST';
export const APPDATA_SET_SUCCESS = '@@user/USER_APPDATA_SET_SUCCESS';
export const APPDATA_SET_FAILURE = '@@user/USER_APPDATA_SET_FAILURE';

export const userIdFromAccountId = (accountId) => ({
	[RSAA]: {
		endpoint: `/api/v2/accounts/${accountId}`,
		method: 'GET',
		headers: withAuth({ 'Content-Type': 'application/json' }),
		types: [
			USER_ID_REQUEST,
			USER_ID_SUCCESS,
			USER_ID_FAILURE
		]
	}
})

export const summary = (userId) => ({
	[RSAA]: {
		endpoint: `/api/v2/admin/users/${userId}`,
		method: 'GET',
		headers: withAuth({ 'Content-Type': 'application/json' }),
		types: [
			{
				type: PROFILE_REQUEST,
				meta: {userId}
			},
			{
				type: PROFILE_SUCCESS,
				meta: {userId}
			},
			PROFILE_FAILURE
		]
	}
})

export const appData = (userId, appName) => ({
	[RSAA]: {
		endpoint: `/api/v2/admin/users/${userId}/app/${appName}`,
		method: 'GET',
		headers: withAuth({ 'Content-Type': 'application/json' }),
		types: [
			{
				type: APPDATA_REQUEST,
				meta: {userId, appName}
			},
			{
				type: APPDATA_SUCCESS,
				meta: {userId,appName}
			},
			APPDATA_FAILURE
		]
	}
})

export const setSummary = (userId, payload) => ({
	[RSAA]: {
		endpoint: `/api/v2/admin/users/${userId}`,
		method: 'POST',
		body: JSON.stringify(payload),
		headers: withAuth({ 'Content-Type': 'application/json' }),
		types: [
			{
				type: PROFILE_SET_REQUEST,
				meta: {userId}
			},
			{
				type: PROFILE_SET_SUCCESS,
				meta: {userId}
			},
			PROFILE_SET_FAILURE
		]
	}
})

export const setAppData = (userId, appName, payload) => ({
	[RSAA]: {
		endpoint: `/api/v2/admin/users/${userId}/app/${appName}`,
		method: 'POST',
		body: JSON.stringify(payload),
		headers: withAuth({ 'Content-Type': 'application/json' }),
		options: { timeout: 3000 },
		types: [
			{
				type: APPDATA_SET_REQUEST,
				meta: {userId, appName}
			},
			{
				type: APPDATA_SET_SUCCESS,
				meta: {userId, appName}
			},
			{
				type: APPDATA_SET_FAILURE,
				meta: {userId, appName}
			}
		]
	}
})
