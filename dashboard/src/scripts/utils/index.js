import _ from 'lodash'
import {escape, replace} from 'lodash/string'

export function _isJson(str) {
	return !_.isError(_.attempt(JSON.parse, str));
}

export function formatValuePreview ({type, value}) {
	switch(type){
		case 'number':
		case 'userId':
			return value && _.toNumber(value)
		case 'array':
		case 'object':
		case 'json':
			return _.truncate(JSON.stringify(value) || _.toString(value), 1000)
		default:
			if(_.isEmpty(value)) return console.error(`Value is empty! Val: ${value} | Type: ${type} | Field: ${name}`)
			return !_.isEmpty(value) && _.truncate(_.toString(value), 1000)

	}
}

export function formatValue ({type, value}) {
	switch(type){
		case 'number':
		case 'userId':
			return value && _.toNumber(value)
		case 'boolean':
			return _.isEqual(value, "true")
		case 'array':
		case 'object':
			return value
		case 'json':
			return value
		default:
			if(_.isEmpty(value)) return console.error(`Value is empty! Val: ${value} | Type: ${type} | Field: ${name}`)
			return !_.isEmpty(value) && _.toString(value)
	}
}

export function getTypeByKey(field){
	switch(field){
		case '_userId':
		case 'userId':
			return 'userId'
		case 'sessionId':
		case '_sessionId':
		case 'sid':
			return 'sessionId'
		case 'room':
		case 'roomName':
		case '_room':
		case '_roomName':
			return 'roomlist'
		default:
			return false
	}
}

export function getValueType(value){
	let typeVal = typeof value
	switch(typeVal){
		case 'number':
		case 'boolean':
		case 'object':
		case 'array':
			return typeVal
		case 'string':
			if(_isJson(value) && _.startsWith(value,'{') && _.endsWith(value,'}'))
				return 'json'
			else if(_isJson(value) && _.startsWith(value,'[') && _.endsWith(value,']'))
				return 'json'
			else
				return _.isEqual(value, 'true') ? 'boolean' : typeVal

		default:
			return 'string'
	}
}

export function formatToEditableObject(data){
	console.log('is object json', _.isEqual(typeof data, 'string') && _isJson(data))
	let obj = _.isEqual(typeof data, 'string') && _isJson(data) ? JSON.parse(data) : data
	if(!_.isObject(obj)) throw new Error('data received is not an object')
	let editableObj = []
	let type

	_.each(obj, (value, key) => {
		type = getTypeByKey(key) ? getTypeByKey(key) : getValueType(value)
		editableObj.push([key,type,value])
	})
	return editableObj
}

export function formatToExportedObject(editableObjArr){
	return _.reduce(editableObjArr, (nextObj, [key,type,value]) => {
		console.log(key, value, 'extracted', editableObjArr)
		console.log('exported to obj', formatValue(type,value))
		nextObj[key] = value
		return nextObj
	}, {}) //remap to key: value
}

export function formatToExportedJson(editableObjArr){
	return JSON.stringify(formatToExportedObject(editableObjArr))
}

export function parseJsonMessage(data){
	let obj = _.isEqual(typeof data, 'string') && _isJson(data) ? JSON.parse(data) : data
	let formatted = []
	const fieldObject = (subKey = '', subVal) => {
		let type = getTypeByKey(subKey) ? getTypeByKey(subKey) : getValueType(subVal)

		formatted.push({
			path: subKey,
			field: subKey,
			type,
			value: subVal
		})
		return formatted
	}

	_.each(obj, (value, key) => {
		fieldObject(key,value)
	})

	return formatted
}

export function escapeSearchText(str){
	let escaped = replace(str, /[^A-Z0-9.@\-_:' ]+/gi, "")
	escaped = replace(escaped, /[.]+/ig, "\\.")
	escaped = replace(escaped, /[-]+/ig, "\\-")
	escaped = escape(escaped).trim()

	return escaped
}
