import { combineReducers } from 'redux'
import auth, * as fromAuth from './auth.js'
import echo, * as fromEcho from './echo.js'
import profile, * as fromProfile from './profile.js'
import users, * as fromUsers from './users.js'
import search, * as fromSearch from './search.js'
import datarequest, * as fromDataRequest from './datarequest.js'
import ws, * as fromWebsocket from './websocket.js'

/*
  Define your state shape in terms of your domain data and app state, not your UI component tree.

  Domain data: data that the application needs to show, use, or modify (such as "all of the Todos retrieved from the server")
  App state: data that is specific to the application's behavior (such as "Todo #5 is currently selected", or "there is a request in progress to fetch Todos")
  UI state: data that represents how the UI is currently displayed (such as "The EditTodo modal dialog is currently open")
 */

//modules' states to be included in global 'state'
import webClient from "./webClient"
import serverInfo from "./serverInfo"
import rooms from "./rooms"

export default combineReducers({
	auth,
	echo,
	search,
	users,
	profile,
	datarequest,
	rooms,
	serverInfo,
	webClient,
	ws
})

export const userId				= state => fromAuth.userId(state.auth)
export const userAccountId		= state => fromAuth.userAccountId(state.auth)
export const userAccountType	= state => fromAuth.userAccountType(state.auth)
export const userFbId			= state => fromAuth.userFbId(state.auth)
export const userHasPassword	= state => fromAuth.userHasPassword(state.auth)
export const isAuthenticated 	= state => fromAuth.isAuthenticated(state.auth)
export const isRoleAdmin 		= state => fromAuth.isRoleAdmin(state.auth)
export const isRoleStaff 		= state => fromAuth.isRoleStaff(state.auth)
export const didLogout	 		= state => fromAuth.didLogout(state.auth)
export const authBusy	 		= state => fromAuth.apiBusy(state.auth)

export const accessToken 			= state => fromAuth.accessToken(state.auth)
export const isAccessTokenExpired 	= state => fromAuth.isAccessTokenExpired(state.auth)
export const refreshToken 			= state => fromAuth.refreshToken(state.auth)
export const isRefreshTokenExpired 	= state => fromAuth.isRefreshTokenExpired(state.auth)
export const authErrors 			= state => fromAuth.errors(state.auth)
export const serverMessage 			= state => fromEcho.serverMessage(state.echo)

export const profileSummary 	= state => fromProfile.userData(state.profile)
export const profileAppsList 	= state => fromProfile.userAppsList(state.profile)
export const profileAppSelect	= state => fromProfile.userAppSelected(state.profile)
export const profileAppData 	= state => fromProfile.userAppData(state.profile)
export const profileLastFetch 	= state => fromProfile.userLastFetch(state.profile)
export const profileErrors	 	= state => fromProfile.userErrors(state.profile)

export const searchQuery 		= state => fromSearch.searchQuery(state.search)
export const searchResults 		= state => fromSearch.searchResults(state.search)
export const searchQuerying 	= state => fromSearch.searchQuerying(state.search)
export const searchNextCursor 	= state => fromSearch.searchNextCursor(state.search)

export const editUserId 		= state => fromUsers.userId(state.users)
export const editUserSummary 	= state => fromUsers.userData(state.users)
export const editUserAppsList 	= state => fromUsers.userAppsList(state.users)
export const editUserAppSelect  = state => fromUsers.userAppSelected(state.users)
export const editUserAppData 	= state => fromUsers.userAppData(state.users)
export const editUserLastFetch 	= state => fromUsers.userLastFetch(state.users)
export const editUserSaveState 	= state => fromUsers.userSaveState(state.users)

export const dataRequested 		= state => fromDataRequest.hasRequested(state.datarequest)
export const dataRequestReady 	= state => fromDataRequest.requestReady(state.datarequest)
export const dataRequestTime 	= state => fromDataRequest.requestReadyTime(state.datarequest)

export const wsIsConnected		= state => fromWebsocket.isConnected(state.ws)
export const wsIsRegistered		= state => fromWebsocket.isRegistered(state.ws)
export const wsIsRegistering	= state => fromWebsocket.isRegistering(state.ws)
export const wsLastError		= state => fromWebsocket.lastError(state.ws)
export const wsIsReady			= state => wsIsRegistering(state) || (wsIsConnected(state) && wsIsRegistered(state))

export const apiBusy = state => (
	fromAuth.apiBusy(state.auth) ||
	fromProfile.apiBusy(state.profile) ||
	fromDataRequest.apiBusy(state.datarequest) ||
	fromUsers.apiBusy(state.users) ||
	fromSearch.searchQuerying(state.search)
)


export function withAuth(headers={}) {
	return (state) => ({
		...headers,
		'Authorization': `Bearer ${accessToken(state)}`
	})
}

export function withTokens(params={}) {
	return (state) => ({
		...params,
		'tokens': {
			'token': `${accessToken(state)}`,
			'rtoken': `${refreshToken(state)}`
		}
	})
}
