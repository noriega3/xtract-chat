module.exports = function(roomName, params = {}){
	const socket = this.getSocket()
	const message = {
		intent: "unsubscribe",
		room:roomName,
		params: params
	}
	const jsonMsg = JSON.stringify(message)
	socket.write(`__JSON__START__${jsonMsg}__JSON__END__`)
}
