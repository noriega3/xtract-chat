module.exports = function(message){
	const client = this
	const socket = this.getSocket()
	if(client._state === "disconnecting") return
	const jsonMsg = JSON.stringify(message)
	console.log('sending message', jsonMsg)
	socket.write(`__JSON__START__${jsonMsg}__JSON__END__`)
}
