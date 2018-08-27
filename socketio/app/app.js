const server	= require('http').createServer()
const io		= require('socket.io')(server)
const redis		= require('socket.io-redis');
io.adapter(redis({ host: 'pubsubredis', port: 6379 }));

const ClientManager = require('./ClientManager')
const ChatroomManager = require('./ChatroomManager')
const makeHandlers = require('./handlers')

const clientManager = ClientManager()
const chatroomManager = ChatroomManager()

io.on('connection', function (client) {
	let {
		handleRegister,
		handleJoin,
		handleLeave,
		handleMessage,
		handleGetChatrooms,
		handleGetAvailableUsers,
		handleDisconnect
	} = makeHandlers(client, clientManager, chatroomManager)

	console.log('client connected...', client.id)
	clientManager.addClient(client)
	client.emit('server:message', 'server online')

	client.on('register', handleRegister)

	client.on('join', handleJoin)

	client.on('leave', handleLeave)

	client.on('message', handleMessage)

	client.on('chatrooms', handleGetChatrooms)

	client.on('availableUsers', handleGetAvailableUsers)

	client.on('disconnect', function () {
		console.log('client disconnect...', client.id)
		handleDisconnect()
	})

	client.on('error', function (err) {
		console.log('received error client:', client.id)
		console.log(err)
	})
})

module.exports = server
