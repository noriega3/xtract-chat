module.exports = function(roomName, params = {}){
	const client = this
	const socket = this.getSocket()
	if(client._state === "disconnecting") return

	params.room = roomName
	const message = {
		intent: "subscribe",
		roomName:roomName,
		params: params
	}

	const jsonMsg = JSON.stringify(message)
	console.log('going to send', jsonMsg)
	socket.write(`__JSON__START__${jsonMsg}__JSON__END__`)
}
