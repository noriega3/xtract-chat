import * as profile from '../actions/apiProfileActions'
import { toast } from 'react-toastify'
import _ from 'lodash'
const initialState = {
	lastFetch: -1,
	userData: {},
	selectedApp: '',
	hasFbId: undefined,
	appData: {},
	processing: false,
	errors: [],
}

export default (state=initialState, action) => {
	switch(action.type) {
		case profile.PROFILE_SUCCESS:
			return {
				userData: action.payload.data,
				appData: {},
				selectedApp: '',
				lastFetch: Date.now()
			}
	case profile.FBID_SUCCESS:
		return {
			...state,
			processing: false,
			errors: [],
			hasFbId: action.payload.data.hasFbId,
		}
	case profile.FBID_DISCONNECT_SUCCESS:
		return {
			...state,
			processing: false,
			hasFbId: undefined,
			errors: []
		}
	case profile.FBID_REQUEST:
	case profile.PASSWORD_REQUEST:
			return {
				...state,
				processing: true,
				errors: []
			}
		case profile.FBID_DISCONNECT_FAILURE:
		case profile.FBID_FAILURE:
		case profile.PASSWORD_FAILURE:
			return {
				...state,
				processing: false,
				errors: action.payload.response.errors
			}
		case profile.PASSWORD_SUCCESS:
			toast.success('Successfully changed password')
			return {
				...state,
				processing: false,
				errors: []
			}
		case profile.APPDATA_REQUEST:
			return {
				...state,
				selectedApp: action.meta.appName,
				appData: {},
			}
		case profile.APPDATA_SUCCESS:
			return {
				...state,
				appData: action.payload.data,
				selectedApp: action.meta.appName,
				lastFetch: Date.now()
			}
		default:
			return state
	}
}
export const userLastFetch 		= (state) => state.lastFetch
export const userData 			= (state) => state.userData
export const userAppData 		= (state) => state.appData
export const userAppsList 		= (state) => JSON.parse(_.get(state, 'userData._appSaves', '{}'))
export const userAppSelected 	= (state) => state.selectedApp
export const userErrors 		= (state) => state.errors
export const apiBusy 			= (state) => state.processing
