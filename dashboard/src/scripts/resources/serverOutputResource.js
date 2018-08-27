//import {isObject, map, range, uniq} from 'lodash'
import _ from 'lodash';

/**
 * List of all names
 */
const ALL_NAMES = generateData();
function generateData() {
	return fetch(`${process.env.ADMIN_API_URL}users`)
		.then((resp) => resp.json()) // Transform the data into json
		.then((resp) => _.values(resp)) // Transform the data into json
}

/**
 * Use this function to filter the results you want to return to the client.
 * Any edits to this file should only be made in the body of this function
 * unless you have some really good reason to make other changes
 * @param  {String[]} input     user input
 * @return {String[]}           Filtered names
 */
function filterNames(...input) { //simulate a table to match param

}

/**
 * Mock server to return list of names
 * @param  {String}   input user input
 * @param  {Function} cb    callback
 */
export function getNames(input, cb) {

	console.log('getting names')

	return _.attempt(() => {

		return ALL_NAMES.then((names) => {

			let queries = "^"
			let words = input.trim().split(" ")
			for (let word of words) {
				//create the regex to search by forward ref (positive lookahead + undetermined # char amount before text and after matching text)
				queries += `(?=.*(${word}))`
			}
			queries += ".*"
			const regexQueries = new RegExp(queries, 'ig') //case insensitive  and global
			return cb(names.filter(apiName => {
				return _.isObject(apiName) && (apiName.accountId.match(regexQueries))
			}))
		})
	})
};
