return shared.getSubscriptionsBySessionId([sessionId])
	.then((existingSubs) => {

		const subList = helper._flatten(existingSubs)
		if (subList.length > 0) {
			return Promise.filter(roomList, ([type, room]) => !subList || !subList.includes(room))
				.then((filteredList) => [sessionId, filteredList])
		} else {
			return [sessionId, roomList]
		}
	})
