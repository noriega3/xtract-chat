module.exports = function(task, maxRetries){
	return task().delay(500).catch(e=>{
		if (!maxRetries) return this(task, maxRetries-1);
		throw e;
	});
}
