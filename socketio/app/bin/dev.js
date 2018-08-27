const debug = require('debug')('app')
const app = require('../app')
const PORT = 1234

app.listen(PORT, function() {
	console.log('server is online', PORT)
	debug(`Socket io server listening on port ${PORT}`)
})
