import React, { Component } from 'react'
import _ from 'lodash'
import Panel from 'muicss/lib/react/panel'
import Button from 'muicss/lib/react/button'
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer'
import PropTypes from 'prop-types'

import { Column, Table, SortDirection } from 'react-virtualized';

export class MatchDetails extends Component {
	render(){

		const {roomName, details} = this.props
		const {matchId, messageId, optIns, matchState, players, turnSeatIndex, turnExpiration, turnStartTime} = details


		let playerData = []

		_.forEach(players, function (n, key) {
			_.forEach(optIns, function (n2, key2) {
				if(n.sessionId === n2.sessionId){
					n.optIn = n2.optIn && n.seatIndex === n2.seat
				}
			})
			playerData.push(n)
		})

		playerData = _.orderBy(playerData, ['seatIndex'], ['asc'])
		const MATCH_STATES = ['NEW_MATCH', 'OPT_IN', 'ACTIVE', 'COMPLETE']
		return (
		<div className="container" key={messageId}>
			<Panel>
				<Panel>
					<div>Room Name: {roomName}</div>
					<div>Update # {messageId}</div>
				</Panel>
				<Panel>
					<div>Match: {matchId}</div>
					<div>State: {matchState}</div>
					{matchState === "ACTIVE" && (<div>Seat Turn: {turnSeatIndex}</div>)}
					<div>Start: {turnExpiration}</div>
					<div>End / Recheck: {turnStartTime}</div>

					<Panel>
						<div>Match State</div>
						{MATCH_STATES.map((state) => <Button key={matchId+"-"+state} color={"primary"} disabled={matchState !== state}>{state}</Button>)}
					</Panel>
					{optIns && optIns.length > 0 &&
						<Panel>
							<div>Turn State</div>
							{playerData.map((player,i) => player.optIn && <Button key={player.sessionId} color={"primary"} disabled={player.seatIndex !== turnSeatIndex}>Seat {player.seatIndex}</Button>)}
						</Panel>
					}
				</Panel>
				<Panel>
					<div>Subscribers</div>
					{playerData.map((player,i) => {
						return (<Panel key={player.sessionId}>
							<div>Seat # {player.seatIndex}</div>
							<div>{player.username}</div>
							<div>Score: {player.score}</div>
							<div>{player.bot && ("Bot User")}</div>
						</Panel>)
					})}
				</Panel>
			</Panel>
		</div>
		)
	}
}

MatchDetails.defaultProps = {
	details: {}
}

MatchDetails.propTypes = {
	details: PropTypes.object.isRequired,
	roomName: PropTypes.string.isRequired
}

export default MatchDetails
