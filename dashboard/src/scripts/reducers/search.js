import * as search from '../actions/apiSearchActions'
import _ from 'lodash'

const initialState = {
	results: [],
	cached: [],
	searching: false,
	query: '',
	nextCursor: -1
}

export default (state=initialState, action) => {
	switch(action.type) {
		case search.SEARCH_REQUEST:

			console.log('request started', action)

			//hook into past results to stop another api call
			return {
				...state,
				searching: true,
				nextCursor: _.isEqual(state.query, action.meta.query) && action.meta.nextCursor ? action.meta.nextCursor : -1,
				query: action.meta.query,
				results: _.isEqual(state.query, action.meta.query) ? state.results : []
			}
		case search.SEARCH_SUCCESS:
			console.log('request succeess', action, action.payload)

			if(!state.searching) return state
			const lastNextCursor = state.nextCursor
			const recNextCursor = action.payload.nextCursor
			const isSameQuery = _.isEqual(action.payload.query, state.query)
			const isSameLastCursor = _.isEqual(recNextCursor, lastNextCursor)
			let newResults = _.clone(state.results)

			if(!isSameQuery) return state
			if(isSameLastCursor) return state

			//We're cheating with using unique on every call
			newResults = _.uniq([...newResults, ...action.payload.data])

			return {
				...state,
				searching: false,
				results: newResults,
				nextCursor: recNextCursor
			}
		case search.SEARCH_FAILURE:
			console.log('request failure')

			return {
				...state,
				searching: '',
				query: '',
				results: [],
				nextCursor: undefined,
			}
		default:
			return state
	}
}

export const searchQuery = (state) => state.query
export const searchResults = (state) => state.results
export const searchQuerying = (state) => state.searching
export const searchCursor = (state) => state.cursor
export const searchNextCursor = (state) => state.nextCursor
