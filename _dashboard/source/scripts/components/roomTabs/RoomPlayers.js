import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Panel from 'muicss/lib/react/panel'
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer'

import { getRoomPlayers, getRoomHistory, getRoomBots, getRoomMessages } from '../../resources/roomListResource'
import { Column, Table } from 'react-virtualized';


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
		this.setState((prev) => ({details: result, loading:false}))
	}

	componentDidMount(){

		getRoomPlayers(this.props.roomName, this.handleIncomingData)
	}

	render(){

		const {roomName} = this.props
		const {details, loading} = this.state

		if(loading){
			return(<Panel>Loading messages..</Panel>)
		}

		if(details.length <= 0){
			return(<Panel>No messages.. {roomName} </Panel>)
		}

		return(
			<Panel key={this.props.roomName}>
				<AutoSizer disableHeight>
					{({width}) => (
						<Table
							width={width}
							height={500}
							headerHeight={30}
							rowHeight={30}
							rowCount={details.length}
							rowGetter={({ index }) => details[index]}>
							<Column
								width={150}
								label='Phase'
								dataKey='phase'
							/>
							<Column
								width={500}
								height={150}
								label='Response'
								dataKey='response'
								cellDataGetter={({rowData}) => {
									return rowData.response ? JSON.stringify(rowData.response) : JSON.stringify(rowData)
								}}
								flexGrow={1}
							/>
						</Table>
					)}
				</AutoSizer>
		</Panel>)

	}
}

RoomPlayers.defaultProps = {
	roomName: "",
}

RoomPlayers.propTypes = {
	roomName: PropTypes.string.isRequired,
}

export default RoomPlayers
