const debug = require('debug')('app:socketio')
const io = require('socket.io-client')

module.exports = function () {
  let socket = io.connect(process.env.IO_URL || 'http://localhost:1234')

  socket.on('connect_error', function (err) {
    debug('received socket connect error:')
    debug(err)
  })

  socket.on('error', function (err) {
    debug('received socket error:')
    debug(err)
  })

  function registerHandler(onMessageReceived) {
    socket.on('message', onMessageReceived)
  }

  function unregisterHandler() {
    socket.off('message')
  }

  function register(name, cb) {
    socket.emit('register', name, cb)
  }

  function join(room, cb) {
    socket.emit('join', room, cb)
  }

  function leave(room, cb) {
    socket.emit('leave', room, cb)
  }

  function message(room, msg, cb) {
    socket.emit('message', { room, message: msg }, cb)
  }

  function getChatrooms(cb) {
    socket.emit('chatrooms', null, cb)
  }

  function getAvailableUsers(cb) {
    socket.emit('availableUsers', null, cb)
  }

  function disconnect(cb) {
    socket.off('message')
    socket.disconnect(cb)
    socket = undefined
  }

  return {
    register,
    join,
    leave,
    message,
    getChatrooms,
    getAvailableUsers,
    registerHandler,
    unregisterHandler,
    disconnect
  }
}
