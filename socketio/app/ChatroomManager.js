const Chatroom = require('./rooms/Chatroom')
const chatroomTemplates = require('./config/chatrooms')

module.exports = function () {
    // mapping of all available chatrooms
    const chatrooms = new Map(
        chatroomTemplates.map(c => [
            c.name,
            c.custom ? c.custom(Chatroom(c)) : Chatroom(c)
        ])
)

    function removeClient(client) {
        chatrooms.forEach(c => c.removeUser(client))
    }

    function getChatroomByName(roomName) {
        return chatrooms.get(roomName)
    }

    function serializeChatrooms() {
        return Array.from(chatrooms.values()).map(c => c.serialize())
    }

    return {
        removeClient,
        getChatroomByName,
        serializeChatrooms
    }
}