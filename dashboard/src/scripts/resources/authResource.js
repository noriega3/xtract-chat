import _ from 'lodash'
let NAMES

export function login(input,cb){
	const requestOptions = {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password })
	};

	return fetch(`${process.env.REST_URI}user/${input}`)
		.then((resp) => resp.json())
		.then((resp) => {
			if(index > -1){
				NAMES[index] = resp
			}
		return cb(resp)
		})
}

export function logout(input,cb){
	const requestOptions = {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password })
	};

	return fetch(`${process.env.REST_URI}user/${input}`)
		.then((resp) => resp.json())
		.then((resp) => {
			if(index > -1){
				NAMES[index] = resp
			}
			return cb(resp)
		})
}

export function _delete(input,cb){
	const requestOptions = {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password })
	};

	return fetch(`${process.env.REST_URI}user/${input}`)
		.then((resp) => resp.json())
		.then((resp) => {
			if(index > -1){
				NAMES[index] = resp
			}
			return cb(resp)
		})
}
