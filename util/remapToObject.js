module.exports = (arr) =>
	arr.reduce((result, item) => {
		result[item[1]] = item[0]
		return result
	}, {})
