module.exports = function ({ name }) {
    const members = new Map()
    let chatHistory = []

    function broadcastMessage(message) {
        //TODO: fix formatting of message sent
        members.forEach(m => m.emit('server:message', {room: name, event: 'message', message: message}))
    }

    function addEntry(entry) {
        chatHistory = chatHistory.concat(entry)
    }

    function getChatHistory() {
        return chatHistory.slice()
    }

    function addUser(client) {
        members.set(client.id, client)
        console.log('members iss now: ', members)
    }

    function removeUser(client) {
        members.delete(client.id)
    }

    function serialize() {
        console.log('chat name is ', name)
        return {
            name,
            numMembers: members.size
        }
    }

    return {
        broadcastMessage,
        addEntry,
        getChatHistory,
        addUser,
        removeUser,
        serialize
    }
}