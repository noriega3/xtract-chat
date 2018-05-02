module.exports = function (obj) {
	let result = [];
	for (let key in obj) {
		if (obj.hasOwnProperty(key)) {
			result.push(key, obj[key]);
		}
	}
	return result;
}
