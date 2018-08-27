import * as users from '../actions/apiUsersActions'
import _ from 'lodash'

const initialState = {
	processing: false,
	accountIds: [],
	userIds: [],

	selectedUserId: -1,
	selectedApp: '',
	selectedEditedPaths: {},
	selectedUserData: {},
	selectedAppData: {},
	selectedLastUpdate:  -1,
	selectedUpdateState: ''
}

//todo: check the accounts array first, then ping server if user wasn't found (aka. not already searched previously)

export default (state=initialState, action) => {
	let recUserId, recAccountId
	switch(action.type) {
		case users.APPDATA_SET_REQUEST:
			return {
				...state,
				processing: true,
				selectedUpdateState: 'BUSY'
			}
		case users.USER_ID_REQUEST:
			return {
				...state,
				processing: false
			}
		case users.PROFILE_REQUEST:
		case users.APPDATA_REQUEST:
			return {
				...state,
				processing: true,
				selectedUserId: action.meta.userId,
				selectedApp: users.APPDATA_REQUEST ? action.meta.appName : '',
				selectedAppData: {}
			}
		case users.USER_ID_SUCCESS:
			recUserId = _.get(action, 'payload.data.userId')
			recAccountId = _.get(action, 'payload.data.accountId')
			if(recUserId && recAccountId){
				return {
					...state,
					processing: false,
					userIds: [...state.userIds, recUserId],
					accountIds: [...state.accountIds, recAccountId]
				}
			} else {
				return state
			}

		case users.PROFILE_SUCCESS:
		case users.PROFILE_SET_SUCCESS:
			return {
				...state,
				processing: false,
				selectedUserId: action.meta.userId,
				selectedUserData: action.payload.data,
				selectedApp: '',
				selectedAppData: {},
				selectedLastUpdate: Date.now()
			}

		case users.APPDATA_SUCCESS:
		case users.APPDATA_SET_SUCCESS:
			return {
				...state,
				processing: false,
				selectedUpdateState: users.APPDATA_SET_SUCCESS ? 'OK' : '',
				selectedUserId: action.meta.userId,
				selectedApp: action.meta.appName,
				selectedAppData: action.payload.data,
				selectedLastUpdate: Date.now()
			}
		case users.USER_ID_FAILURE:
		case users.APPDATA_FAILURE:
		case users.PROFILE_FAILURE:
		case users.PROFILE_SET_FAILURE:
			return {
				...state,
				processing: false
			}
		case users.APPDATA_SET_FAILURE:
			return {
				...state,
				processing: false,
				selectedUpdateState: 'FAIL'
			}
		default:
			return state
	}
}

export const userId 			= (state) => state.selectedUserId
export const userLastFetch 		= (state) => state.selectedLastUpdate
export const userData 			= (state) => state.selectedUserData
export const userAppData 		= (state) => state.selectedAppData
export const userAppsList 		= (state) => JSON.parse(_.get(state, 'selectedUserData._appSaves', '{}'))
export const userAppSelected 	= (state) => state.selectedApp
export const userSaveState	 	= (state) => state.selectedUpdateState

export const userIds = (state) => state.userIds
export const accountIds = (state) => state.accountIds
export const apiBusy = (state) => state.processing

