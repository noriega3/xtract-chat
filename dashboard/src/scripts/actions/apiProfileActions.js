import { RSAA } from 'redux-api-middleware';
import { withAuth, withTokens } from '../reducers'
export const PROFILE_REQUEST = '@@profile/PROFILE_REQUEST';
export const PROFILE_SUCCESS = '@@profile/PROFILE_SUCCESS';
export const PROFILE_FAILURE = '@@profile/PROFILE_FAILURE';

export const REGISTER_REQUEST = '@@profile/REGISTER_REQUEST';
export const REGISTER_SUCCESS = '@@profile/REGISTER_SUCCESS';
export const REGISTER_FAILURE = '@@profile/REGISTER_FAILURE';

export const APPDATA_REQUEST = '@@profile/APPDATA_REQUEST';
export const APPDATA_SUCCESS = '@@profile/APPDATA_SUCCESS';
export const APPDATA_FAILURE = '@@profile/APPDATA_FAILURE';

export const PASSWORD_REQUEST = '@@profile/PASSWORD_REQUEST';
export const PASSWORD_SUCCESS = '@@profile/PASSWORD_SUCCESS';
export const PASSWORD_FAILURE = '@@profile/PASSWORD_FAILURE';

export const FBID_REQUEST = '@@profile/FBID_REQUEST';
export const FBID_SUCCESS = '@@profile/FBID_SUCCESS';
export const FBID_FAILURE = '@@profile/FBID_FAILURE';

export const FBID_DISCONNECT_REQUEST = '@@profile/FBID_DISCONNECT_REQUEST';
export const FBID_DISCONNECT_SUCCESS = '@@profile/FBID_DISCONNECT_SUCCESS';
export const FBID_DISCONNECT_FAILURE = '@@profile/FBID_DISCONNECT_FAILURE';

export const DATAREQ_START_REQUEST = '@@datarequest/DATAREQ_START_REQUEST';
export const DATAREQ_START_SUCCESS = '@@datarequest/DATAREQ_START_SUCCESS';
export const DATAREQ_START_FAILURE = '@@datarequest/DATAREQ_START_FAILURE';

export const DATAREQ_STATE_REQUEST = '@@datarequest/DATAREQ_STATE_REQUEST';
export const DATAREQ_STATE_SUCCESS = '@@datarequest/DATAREQ_STATE_SUCCESS';
export const DATAREQ_STATE_FAILURE = '@@datarequest/DATAREQ_STATE_FAILURE';

export const DATAREQ_DOWNLOAD_REQUEST = '@@datarequest/DATAREQ_DOWNLOAD_REQUEST';
export const DATAREQ_DOWNLOAD_SUCCESS = '@@datarequest/DATAREQ_DOWNLOAD_SUCCESS';
export const DATAREQ_DOWNLOAD_FAILURE = '@@datarequest/DATAREQ_DOWNLOAD_FAILURE';

import {saveAs} from 'file-saver'

export const summary = () => ({
	[RSAA]: {
		endpoint: '/api/v2/users/me',
		method: 'GET',
		headers: withAuth({ 'Content-Type': 'application/json' }),
		types: [
			PROFILE_REQUEST, PROFILE_SUCCESS, PROFILE_FAILURE
		]
	}
})

export const fbIdDetails = () => ({
	[RSAA]: {
		endpoint: '/api/v2/users/me/facebook/status',
		method: 'GET',
		headers: withAuth({ 'Content-Type': 'application/json' }),
		types: [
			FBID_REQUEST, FBID_SUCCESS, FBID_FAILURE
		]
	}
})

export const disconnectFb = (payload) => ({
	[RSAA]: {
		endpoint: '/api/v2/users/me/facebook/disconnect',
		method: 'POST',
		body: JSON.stringify(payload),
		headers: withAuth({ 'Content-Type': 'application/json' }),
		types: [
			FBID_DISCONNECT_REQUEST, FBID_DISCONNECT_SUCCESS, FBID_DISCONNECT_FAILURE
		]
	}
})

export const updatePassword = (payload) => ({
	[RSAA]: {
		endpoint: '/api/v2/users/me/password/change',
		method: 'POST',
		body: JSON.stringify(payload),
		headers: withAuth({ 'Content-Type': 'application/json' }),
		types: [
			PASSWORD_REQUEST, PASSWORD_SUCCESS, PASSWORD_FAILURE
		]
	}
})

export const appData = (appName) => ({
	[RSAA]: {
		endpoint: `/api/v2/users/me/app/${appName}`,
		method: 'GET',
		headers: withAuth({ 'Content-Type': 'application/json' }),
		types: [
			{
				type: APPDATA_REQUEST,
				meta: {appName}
			},
			{
				type: APPDATA_SUCCESS,
				meta: {appName}
			},
			APPDATA_FAILURE
		]
	}
})
export const dataRequest = () => ({
	[RSAA]: {
		endpoint: `/api/v2/users/me/datarequest/start`,
		method: 'POST',
		headers: withAuth({ 'Content-Type': 'application/json' }),
		types: [
			DATAREQ_START_REQUEST,
			DATAREQ_START_SUCCESS,
			DATAREQ_START_FAILURE
		]
	}
})


export const dataRequestProgress = () => ({
	[RSAA]: {
		endpoint: `/api/v2/users/me/datarequest/state`,
		method: 'POST',
		headers: withAuth({ 'Content-Type': 'application/json' }),
		types: [
			DATAREQ_STATE_REQUEST,
			DATAREQ_STATE_SUCCESS,
			DATAREQ_STATE_FAILURE
		]
	}
})

export const registerWithEmail = (payload) => ({
	[RSAA]: {
		endpoint: `/api/v2/users/me/email/register`,
		method: 'POST',
		body: JSON.stringify(payload),
		headers: withAuth({ 'Content-Type': 'application/json' }),
		types: [
			REGISTER_REQUEST,
			REGISTER_SUCCESS,
			REGISTER_FAILURE
		]
	}
})

export const dataRequestDownload = () => ({
	[RSAA]: {
		endpoint: `/api/v2/users/me/datarequest/download`,
		method: 'POST',
		headers: withAuth({ 'Content-Type': 'application/json' }),
		types: [
			DATAREQ_DOWNLOAD_REQUEST,
			{
				type: DATAREQ_DOWNLOAD_SUCCESS,
				payload: (action, state, response) => {

					//perform download in parallel
					return Promise
						.resolve(response)
						.then((res) => res.blob())
						.then((blob) => {
							saveAs(blob, 'requestedData.zip')
						})
				}
			},
			DATAREQ_DOWNLOAD_FAILURE
		]
	}
})
