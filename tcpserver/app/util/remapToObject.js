module.exports = (arr) => {
	if (!Array.isArray(arr)) return []
	return arr.reduce((result, item) => {
		result[item[1]] = item[0]
		return result
	}, {})
}
