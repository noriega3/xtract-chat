const Promise 	= require('bluebird') //http://bluebirdjs.com/docs/api-reference.html

module.exports = (promises) => {
	return Promise.all(promises.map(promise => Promise.resolve(promise).reflect()))
		.then(function(results) {
			const err = results.find(e=>e.isRejected());
			if (err) {
				throw err.reason;
			} else {
				return results.map(e=>e.value);
			}
		});
}
