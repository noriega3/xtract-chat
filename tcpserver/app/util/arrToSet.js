module.exports = (arr) => {
	if (!Array.isArray(arr)){ return null }

	let result = []
	let length = arr.length
	for (let i = 0; i < length; i+=2) {
		let item = arr[i]
		let next = arr[i+1]
		result.push([item, next])
	}
	return result
}
