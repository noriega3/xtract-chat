import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Panel from 'muicss/lib/react/panel'
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer'

import { getRoomPlayers, getRoomHistory, getRoomBots, getRoomMessages } from '../../resources/roomListResource'
import { Column, Table } from 'react-virtualized';
import Container from 'muicss/lib/react/container';
import Row from 'muicss/lib/react/row';
import Col from 'muicss/lib/react/col';


export class RoomPlayers extends Component {
	constructor(props){
		super(props)
		this.state = {
			details: [],
			loading: true
		}

		this.handleIncomingData = this.handleIncomingData.bind(this)
	}

	shouldComponentUpdate(nextProps, nextState){
		if(nextProps.roomName !== this.props.roomName){
			return true
		}
		if(nextState.details !== this.state.details){
			return true
		}
		if(nextState.loading !== this.state.loading){
			return true
		}
		return false
	}

	handleIncomingData(result){
		console.log('data', result)
		this.setState({details: result, loading:false})
	}

	componentDidMount(){

		getRoomPlayers(this.props.roomName, this.handleIncomingData)
	}

	render(){

		const {roomName} = this.props
		const {details, loading} = this.state

		if(loading){
			return(<Panel>Loading players..</Panel>)
		}

		if(details.length <= 0){
			return(<Panel>No players.. {roomName} </Panel>)
		}

		const players = details.map((detail) => {
			return (
				<Col md="4" key={detail.sessionId}>
					<Panel>
						<div>{detail.username}</div>
						<div>Score: {detail.score}</div>
						<div>Bot: {detail.bot}</div>
						<div>UserId: {detail.userId}</div>
					</Panel>
				</Col>)
		})

		return(<Container fluid={true} key={this.props.roomName}>
				<Row>
					{players}
				</Row>
			</Container>)
	}
}

RoomPlayers.defaultProps = {
	roomName: "",
}

RoomPlayers.propTypes = {
	roomName: PropTypes.string.isRequired,
}

export default RoomPlayers
