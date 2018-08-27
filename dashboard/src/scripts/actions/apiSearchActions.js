import { RSAA } from 'redux-api-middleware';
import { withAuth } from '../reducers'

export const SEARCH_REQUEST = '@@users/SEARCH_REQUEST'
export const SEARCH_SUCCESS = '@@users/SEARCH_SUCCESS'
export const SEARCH_FAILURE = '@@users/SEARCH_FAILURE'

export const searchUsers = (payload) => {
	console.log(payload, 'SEARCH sent')

	return ({
		[RSAA]: {
			endpoint: `/api/v2/admin/search/users`,
			method: 'POST',
			body: JSON.stringify(payload),
			headers: withAuth({'Content-Type': 'application/json'}),
			types: [
				{
					type: SEARCH_REQUEST,
					meta: {
						query: payload.term,
						cursor: payload.cursor
					}
				},
				SEARCH_SUCCESS,
				SEARCH_FAILURE
			]
		}
	})
}
