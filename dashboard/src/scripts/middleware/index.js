import { isRSAA, apiMiddleware } from 'redux-api-middleware';
import { TOKEN_RECEIVED, refresh } from '../actions/apiAuthActions'
import { refreshToken, isAccessTokenExpired, isRefreshTokenExpired } from '../reducers'

//TODO: clean up this loop

export function createApiMiddleware() {
	let postponedRSAAs = []

	return ({ dispatch, getState }) => {

		const rsaaMiddleware = apiMiddleware({dispatch, getState})

		return (next) => (action) => {
			const nextCheckPostponed = (nextAction) => {

				console.log('checking next posponeed', nextAction.type)
				// Run postponed actions after token refresh
				if (nextAction.type === TOKEN_RECEIVED) {
					console.log('token receieved')
					next(nextAction);
					postponedRSAAs.forEach((postponed) => {
						rsaaMiddleware(next)(postponed)
					})
					postponedRSAAs = []
				} else {
					next(nextAction)
				}
			}
			if(isRSAA(action)) {
				const state = getState()
				const rtoken = refreshToken(state)
				if(isAccessTokenExpired(state) && !isRefreshTokenExpired(state)) {

		/*			if(isRefreshTokenExpired(state)){
						//Redirect to login page if invalid
						postponedRSAAs = []
					}*/
					console.log('pushed', action)
					postponedRSAAs.push(action)
					if(postponedRSAAs.length === 1) {
						const action = refresh({rtoken})
						return rsaaMiddleware(nextCheckPostponed)(action)
					} else {


						console.log('in access expired no token and postposned length greather than 1')
						return
					}
				}
				return rsaaMiddleware(next)(action);
			}
			return next(action);
		}
	}
}
export default createApiMiddleware()
