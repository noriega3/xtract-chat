const enable = true
module.exports = function(str = Date.now()){
	if(enable)
		console.log(`============================================================\n
		(${str}) [MEMORY USAGE]: ${(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100}
		\n============================================================`)
}
