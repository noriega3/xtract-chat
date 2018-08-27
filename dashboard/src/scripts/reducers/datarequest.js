import {LOGIN_SUCCESS, LOGOUT_SUCCESS } from '../actions/apiAuthActions'
import * as profile from '../actions/apiProfileActions'
import _ from 'lodash'
import _isEqual from 'lodash/isEqual'

const initialState = {
	jobId: '',
	requestState: '',
	blob: '',
	requested: false,
	lastRequestTime: -1,
	requestReady: false,
	downloaded: false,
	apiBusy: false
}

export default (state=initialState, action) => {
	switch(action.type) {
		case profile.DATAREQ_START_REQUEST:
			return {
				...state,
				apiBusy: true
			}
		case LOGOUT_SUCCESS:
		case LOGIN_SUCCESS:
			return initialState
		case profile.DATAREQ_START_SUCCESS:
		case profile.DATAREQ_STATE_SUCCESS:
			return {
				jobId: action.payload.data.jobId,
				requestProgress: action.payload.data.progress,
				requestReady: _isEqual(action.payload.data.progress, 100),
				lastRequestTime: action.payload.data.lastRequestTime
			}
		case profile.DATAREQ_DOWNLOAD_REQUEST:
			return {
				...state,
				apiBusy: true,
				downloaded: false
			}
		case profile.DATAREQ_DOWNLOAD_SUCCESS:
			console.log('payloaad', action)
			return {
				...state,
				apiBusy: false,
				blob: action.payload,
				downloaded: true
			}
		default:
			return state
	}
}
/*export const hasRequested = (state) =>
	_isEqual(state.requestState, 'completed') ||
	_isEqual(state.requestState, 'delayed') ||
	_isEqual(state.requestState, 'active') ||
	_isEqual(state.requestState, 'waiting') ||
	_isEqual(state.requestState, 'paused')*/
export const hasRequested	 = (state) => state.requestProgress > 0
export const requestReady	 = (state) => _isEqual(state.requestProgress, 100) && state.lastRequestTime
export const requestReadyTime = (state) => state.lastRequestTime
export function apiBusy(state) {
	return  state.apiBusy
}
