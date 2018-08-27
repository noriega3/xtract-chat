import _ from 'lodash'
const ALL_NAMES = generateData()
let ROOMS

function isJSON(str) {
	return !_.isError(_.attempt(JSON.parse, str));
}

function parseJson(str){
	return _.attempt(JSON.parse.bind(null, str));
}

function generateData() {
	return fetch(`${process.env.ADMIN_API_URL}rooms`)
		.then((resp) => resp.json()) // Transform the data into json
		.then((resp) => {
			ROOMS = _.values(resp)
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
			return cb(ROOMS.filter(apiName => {
				return _.isObject(apiName) && (apiName.roomName.match(regexQueries))
			}))
		})
	})
}


export function getRoomDetails(input,cb){
	const index =_.findIndex(ROOMS,['roomName', input])
	if(index > -1 && ROOMS[index].updated && ROOMS[index].updated > Date.now()){
		console.log('using cached index', index)
		return cb(ROOMS[index])
	}

	return fetch(`${process.env.ADMIN_API_URL}room/${input}`)
		.then((resp) => resp.json())
		.then((resp) => {

			if(isJSON(resp.validRoomEvents)){
				resp.validRoomEvents = parseJson(resp.validRoomEvents)
			}

			console.log('new data for room', resp)
			if(index > -1){
				ROOMS[index] = resp
			}
			return cb(resp)
		})
}

export function getRoomPlayers(input,cb){
	return fetch(`${process.env.ADMIN_API_URL}room/${input}/players?withInfo=true`)
		.then((resp) => resp.json())
		.then((resp) => cb(resp))
}

export function getRoomHistory(input,cb){
	return fetch(`${process.env.ADMIN_API_URL}admin/room/${input}/history`)
		.then((resp) => resp.json())
		.then((resp) => cb(resp))
}

export function getRoomBots(input,cb){
	return fetch(`${process.env.ADMIN_API_URL}room/${input}/bots?withInfo=true`)
		.then((resp) => resp.json())
		.then((resp) => cb(resp))
}

export function getRoomMessages(input,cb){
	return fetch(`${process.env.ADMIN_API_URL}room/${input}/messages`)
		.then((resp) => resp.json())
		.then((resp) =>
			_.toArray(_.mapValues(resp, function(obj){
				return parseJson(obj)
			}))
		)
		.then((resp) => cb(resp))
}
