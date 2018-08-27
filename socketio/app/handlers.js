function makeHandleEvent(client, clientManager, chatroomManager) {
    function ensureExists(getter, rejectionMessage) {
        return new Promise(function (resolve, reject) {
            const res = getter()
            return res
                ? resolve(res)
                : reject(rejectionMessage)
        })
    }

    function ensureUserSelected(clientId) {
        return ensureExists(
            () => clientManager.getUserByClientId(clientId),
            'select user first!'
    )
    }

    function ensureValidChatroom(roomName) {
        return ensureExists(
            () => chatroomManager.getChatroomByName(roomName),
            `invalid room name: ${roomName}`
    )
    }

    function ensureValidChatroomAndUserSelected(roomName) {
        return Promise.all([
            ensureValidChatroom(roomName),
            ensureUserSelected(client.id)
        ])
            .then(([room, user]) => Promise.resolve({ room, user }))
    }

    function handleEvent(roomName, createEntry) {
        return ensureValidChatroomAndUserSelected(roomName)
            .then(function ({ room, user }) {
                // append event to chat history
                const entry = { sessionId: client.id, user, ...createEntry() }
                room.addEntry(entry)

                // notify other clients in chatroom
                room.broadcastMessage({ room: roomName, ...entry })
                return room
            })
    }

    return handleEvent
}

module.exports = function (client, clientManager, chatroomManager) {
    const handleEvent = makeHandleEvent(client, clientManager, chatroomManager)

    function handleRegister(user, callback=()=>{}) {
        //todo: ping pubsub server for a valid session
        /*if (!clientManager.isUserAvailable(userName))
            return callback('user is not available')*/

        //const user = clientManager.getUserByName(userName)
        clientManager.registerClient(client, user)

        return callback(null, user)
    }

    function handleJoin(roomName, callback=()=>{}) {
        const createEntry = () => ({ event: `joined ${roomName}` })

        handleEvent(roomName, createEntry)
            .then(function (room) {
                // add member to chatroom
                room.addUser(client)

                // send chat history to client
                callback(null, {
                    event: 'subscribed',
                    room: roomName,
                    history: room.getChatHistory(),
                })
            })
            .catch(callback)
    }

    function handleLeave(roomName, callback=()=>{}) {
        const createEntry = () => ({ event: `left ${roomName}` })

        handleEvent(roomName, createEntry)
            .then(function (room) {
                // remove member from chatroom
                room.removeUser(client)

                callback(null, {
                    event: 'unsubscribed',
                    room: roomName,
                })
            })
            .catch(callback)
    }

    function handleMessage({  room: roomName, message } = {}, callback=()=>{}) {
        //Note: the room parameter is just the name when coming from a message
        const createEntry = () => ({ message })

        handleEvent(roomName, createEntry)
            .then(() => callback(null, 'OK'))
            .catch(callback)
    }

    function handleGetChatrooms(_, callback=()=>{}) {
        return callback(null, chatroomManager.serializeChatrooms())
    }

    function handleGetAvailableUsers(_, callback=()=>{}) {
        return callback(null, clientManager.getAvailableUsers())
    }

    function handleDisconnect() {

        client.disconnect()

        // remove user profile
        clientManager.removeClient(client)
        // remove member from all chatrooms
        chatroomManager.removeClient(client)
    }

    return {
        handleRegister,
        handleJoin,
        handleLeave,
        handleMessage,
        handleGetChatrooms,
        handleGetAvailableUsers,
        handleDisconnect
    }
}