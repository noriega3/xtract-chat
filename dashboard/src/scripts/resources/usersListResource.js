import _ from 'lodash'
const ALL_NAMES = generateData()
let NAMES

function isJSON(str) {
	return !_.isError(_.attempt(JSON.parse, str));
}

function parseJson(str){
	return _.attempt(JSON.parse.bind(null, str));
}

function generateData() {
	return fetch(`${process.env.ADMIN_API_URL}users`)
		.then((resp) => resp.json()) // Transform the data into json
		.then((resp) => {
		    NAMES = _.values(resp)
		    return _.values(resp)
		}) // Transform the data into json
}

export function getNames(input, cb) {
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
}

export function getUserDetails(input,cb){

	const index =_.findIndex(NAMES,['userId', input])
	if(index > -1 && NAMES[index].lastSaveTime && NAMES[index].lastSaveTime > Date.now()){
		console.log('using cached index', index)
		return cb(NAMES[index])
	}

	return fetch(`${process.env.ADMIN_API_URL}user/${input}`)
		.then((resp) => resp.json())
		.then((resp) => {
			if(index > -1){
				NAMES[index] = resp
			}
		    return cb(resp)
		})
}
