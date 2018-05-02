const fs = require('fs')

const attachRedisCommands = (client) => {

	client.defineCommand('hexAdd', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/hexAdd.lua", "utf8")
	})

	client.defineCommand('hexRem', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/hexRem.lua", "utf8")
	})

	client.defineCommand('hexSearch', {
		numberOfKeys: 4,
		lua: fs.readFileSync("./scripts/redis2/hexSearch.lua", "utf8")
	})

	client.defineCommand('hexExists', {
		numberOfKeys: 6,
		lua: fs.readFileSync("./scripts/redis2/hexExists.lua", "utf8")
	})

	//session actions
	client.defineCommand('confirmInit', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/session/confirmInit.lua", "utf8")
	})

	client.defineCommand('sendSsoCheck', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/session/sendSsoCheck.lua", "utf8")
	})

	client.defineCommand('verifySsoCheck', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/session/verifySsoCheck.lua", "utf8")
	})

	client.defineCommand('publishToRoom', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/room/publishToRoom.lua", "utf8")
	})

	client.defineCommand('publishToSession', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/session/publishToSession.lua", "utf8")
	})

	client.defineCommand('validateAuths', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/validateAuths.lua", "utf8")
	})

	client.defineCommand('keepAlive', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/session/keepAlive.lua", "utf8")
	})

	client.defineCommand('initSession', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/session/initSession.lua", "utf8")
	})

	client.defineCommand('updateSessionData', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/session/updateSessionData.lua", "utf8")
	})

	//Room queue actions
	client.defineCommand('prepareRoomEvent', {
		numberOfKeys: 5,
		lua: fs.readFileSync("./scripts/redis2/rooms/prepareRoomEvent.lua", "utf8")
	})

	client.defineCommand('getRoomBotInfo', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/rooms/getRoomBotInfo.lua", "utf8")
	})

	client.defineCommand('checkSessionState', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/session/checkSessionState.lua", "utf8")
	})

	client.defineCommand('checkRoomTick', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/rooms/checkRoomTick.lua", "utf8")
	})


	client.defineCommand('setGameRoomIntent', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/rooms/setGameRoomIntent.lua", "utf8")
	})

	client.defineCommand('getGameRooms', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/rooms/getSessionGameRooms.lua", "utf8")
	})

	client.defineCommand('filterMultipleGameRooms', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/rooms/filterMultipleGameRooms.lua", "utf8")
	})



	client.defineCommand('destroySession', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/session/destroySession.lua", "utf8")
	})

	client.defineCommand('verifyRoomEvent', {
		numberOfKeys: 3,
		lua: fs.readFileSync("./scripts/redis2/rooms/verifyRoomEvent.lua", "utf8")
	})
	client.defineCommand('getRandBotSessionFromRoom', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/rooms/getRandBotSessionFromRoom.lua", "utf8")
	})


	client.defineCommand('sendChatToRoom', {
		numberOfKeys: 5,
		lua: fs.readFileSync("./scripts/redis2/rooms/sendChatToRoom.lua", "utf8")
	})

	//System Reserved Rooms (type -1)
	client.defineCommand('setupSystemRoom', {
		numberOfKeys: 4,
		lua: fs.readFileSync("./scripts/redis2/rooms/system/setupSystemRoom.lua", "utf8")
	})
	client.defineCommand('subSystemRoom', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/rooms/system/subSystemRoom.lua", "utf8")
	})
	client.defineCommand('unsubSystemRoom', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/rooms/system/unsubSystemRoom.lua", "utf8")
	})
	client.defineCommand('destroySystemRoom', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/rooms/system/destroySystemRoom.lua", "utf8")
	})

	//Standard Rooms (type 0)
	client.defineCommand('setupStandardRoom', {
		numberOfKeys: 4,
		lua: fs.readFileSync("./scripts/redis2/rooms/standard/setupStandardRoom.lua", "utf8")
	})
	client.defineCommand('subStandardRoom', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/rooms/standard/subStandardRoom.lua", "utf8")
	})
	client.defineCommand('unsubStandardRoom', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/rooms/standard/unsubStandardRoom.lua", "utf8")
	})
	client.defineCommand('destroyStandardRoom', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/rooms/standard/destroyStandardRoom.lua", "utf8")
	})

	//Real time rooms (type 1)
	client.defineCommand('setupRealTimeGameRoom', {
		numberOfKeys: 5,
		lua: fs.readFileSync("./scripts/redis2/rooms/realtime/setupRealTimeGameRoom.lua", "utf8")
	})
	client.defineCommand('subRealTimeGameRoom', {
		numberOfKeys: 3,
		lua: fs.readFileSync("./scripts/redis2/rooms/realtime/subRealTimeGameRoom.lua", "utf8")
	})
	client.defineCommand('unsubRealTimeGameRoom', {
		numberOfKeys: 3,
		lua: fs.readFileSync("./scripts/redis2/rooms/realtime/unsubRealTimeGameRoom.lua", "utf8")
	})
	client.defineCommand('destroyRealTimeGameRoom', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/rooms/realtime/destroyRealTimeGameRoom.lua", "utf8")
	})

	//Turn based rooms (type 2)
	client.defineCommand('setupTurnBasedGameRoom', {
		numberOfKeys: 4,
		lua: fs.readFileSync("./scripts/redis2/rooms/turnbased/setupTurnBasedGameRoom.lua", "utf8")
	})
	client.defineCommand('subTurnBasedGameRoom', {
		numberOfKeys: 3,
		lua: fs.readFileSync("./scripts/redis2/rooms/turnbased/subTurnBasedGameRoom.lua", "utf8")
	})
	client.defineCommand('unsubTurnBasedGameRoom', {
		numberOfKeys: 3,
		lua: fs.readFileSync("./scripts/redis2/rooms/turnbased/unsubTurnBasedGameRoom.lua", "utf8")
	})
	client.defineCommand('destroyTurnBasedGameRoom', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/rooms/turnbased/destroyTurnBasedGameRoom.lua", "utf8")
	})

	//session
	client.defineCommand('checkReconnect', {
		numberOfKeys: 3,
		lua: fs.readFileSync("./scripts/redis2/room/validators/checkReconnect.lua", "utf8")
	})


	//simplified version
	client.defineCommand('createRoom', {
		numberOfKeys: 3,
		lua: fs.readFileSync("./scripts/redis2/room/createRoom.lua", "utf8")
	})
	client.defineCommand('destroyRoom', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/room/destroyRoom.lua", "utf8")
	})
	client.defineCommand('subscribeRoom', {
		numberOfKeys: 3,
		lua: fs.readFileSync("./scripts/redis2/room/subscribeRoom.lua", "utf8")
	})
	client.defineCommand('unSubscribeRoom', {
		numberOfKeys: 3,
		lua: fs.readFileSync("./scripts/redis2/room/unSubscribeRoom.lua", "utf8")
	})
	client.defineCommand('reserveOpenSeat', {
		numberOfKeys: 3,
		lua: fs.readFileSync("./scripts/redis2/room/updaters/reserveOpenSeat.lua", "utf8")
	})
	//API/HTTP server

	client.defineCommand('reserveGameRoom', {
		numberOfKeys: 4,
		lua: fs.readFileSync("./scripts/redis2/rooms/reserveGameRoom.lua", "utf8")
	})

	//new reserve room logic
	client.defineCommand('checkRoomSubscribeTypeReserves', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/room/validators/checkRoomSubscribeTypeReserves.lua", "utf8")
	})
	client.defineCommand('checkRoomReservation', {
		numberOfKeys: 3,
		lua: fs.readFileSync("./scripts/redis2/room/validators/checkRoomReservation.lua", "utf8")
	})

	//Updaters
	client.defineCommand('refreshRoomReserves', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/room/updaters/refreshRoomReserves.lua", "utf8")
	})

	client.defineCommand('syncRoomCounts', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/room/updaters/syncRoomCounts.lua", "utf8")
	})
	client.defineCommand('reserveNewRoomId', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/room/updaters/reserveNewRoomId.lua", "utf8")
	})

	//Collections
	client.defineCommand('idleRooms', {
		numberOfKeys: 0,
		lua: fs.readFileSync("./scripts/redis2/room/collections/idleRooms.lua", "utf8")
	})
	client.defineCommand('availableRoomsByPath', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/room/collections/availableRoomsByPath.lua", "utf8")
	})

	//Shared (often used functions)
	client.defineCommand('checkIdleRoom', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/room/validators/checkIdleRoom.lua", "utf8")
	})

	//session
	client.defineCommand('checkSessionIsBot', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/session/validators/checkSessionIsBot.lua", "utf8")
	})

	/** @function client.setMatchProp */
	client.defineCommand('setMatchProp', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/rooms/turnbased/match/setMatchProp.lua", "utf8")
	})

	/** @function client.setMatchOptInSession */
	client.defineCommand('setMatchOptInSession', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/rooms/turnbased/match/setMatchOptInSession.lua", "utf8")
	})

	/** @function client.setMatchOptOutSession */
	client.defineCommand('setMatchOptOutSession', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/rooms/turnbased/match/setMatchOptOutSession.lua", "utf8")
	})

	/** @function client.checkMatchActive */
	client.defineCommand("checkMatchActive", {
		numberOfKeys: 1,
		lua: fs.readFileSync("scripts/redis2/rooms/turnbased/match/checkMatchActive.lua", "utf8")
	})

	/** @function client.checkMatchOptIns */
	client.defineCommand("checkMatchOptIns", {
		numberOfKeys: 1,
		lua: fs.readFileSync("scripts/redis2/rooms/turnbased/match/checkMatchOptIns.lua", "utf8")
	})

	/** @function client.publishTurnBasedUpdate */
	client.defineCommand("publishTurnBasedUpdate", {
		numberOfKeys: 1,
		lua: fs.readFileSync("scripts/redis2/rooms/turnbased/publishRoomUpdate.lua", "utf8")
	})

	/** @function client.setNewMatch */
	client.defineCommand("setNewMatch", {
		numberOfKeys: 1,
		lua: fs.readFileSync("scripts/redis2/rooms/turnbased/match/setNewMatch.lua", "utf8")
	})

	/** @function client.setMatchTakeTurn */
	client.defineCommand("setMatchTakeTurn", {
		numberOfKeys: 1,
		lua: fs.readFileSync("scripts/redis2/rooms/turnbased/match/setNextTurn.lua", "utf8")
	})

	/* client side actions */

	/** @function client.publishRoomUpdate */
	client.defineCommand('publishRoomUpdate', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/rooms/realtime/publishRoomUpdate.lua", "utf8")
	})

	/** @function client.checkIsSubscribed */
	client.defineCommand('checkIsSubscribed', {
		numberOfKeys: 2,
		lua: fs.readFileSync("./scripts/redis2/session/validators/checkIsSubscribed.lua", "utf8")
	})

	/** @function client.checkRoomTypeMatch */
	client.defineCommand('checkRoomTypeMatch', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/room/validators/checkRoomTypeMatch.lua", "utf8")
	})

	/** @function client.getRoomInfo */
	client.defineCommand('getRoomInfo', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis2/room/getters/getRoomInfo.lua", "utf8")
	})

}
module.exports = attachRedisCommands
