import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Panel from 'muicss/lib/react/panel'
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer'
import RoomMessageModal from './RoomMessageModal'
import _ from 'lodash'

import { getRoomPlayers, getRoomHistory, getRoomBots, getRoomMessages } from '../../resources/roomListResource'
import { Column, Table } from 'react-virtualized';
import Modal from "../templates/Modal";

export class RoomMessages extends Component {
	constructor(props){
		super(props)
		this.state = {
			details: [],
			loading: true,
			modalOpen: false,
			modalData: ""
		}

		this.handleIncomingData = this.handleIncomingData.bind(this)
		this.handleRowClick = this.handleRowClick.bind(this)
		this.handleModalChange = this.handleModalChange.bind(this)
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
		if(nextState.modalOpen !== this.state.modalOpen){
			return true
		}
		return false
	}

	handleIncomingData(result){
		this.setState((prev) => ({details: result, loading:false}))
	}

	componentDidMount(){
		getRoomMessages(this.props.roomName, this.handleIncomingData)
	}

	handleRowClick(e){
		this.setState((prev) => ({...prev, modalOpen: true, modalData: e.rowData}))
	}

	handleModalChange(){
		this.setState((prev) => ({...prev, modalOpen: !prev.modalOpen}))
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
			<Panel>
				<AutoSizer disableHeight>
					{({width}) => (
						<Table
							width={width}
							height={500}
							headerHeight={30}
							rowHeight={30}
							onRowClick={this.handleRowClick}
							rowCount={details.length || 0}
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
									return rowData.response ? JSON.stringify(rowData.response, null ,2) : JSON.stringify(rowData, null, 2)
								}}
								flexGrow={1}
							/>
						</Table>
					)}
				</AutoSizer>

				<Modal show={this.state.modalOpen} onClose={this.handleModalChange}>
					<RoomMessageModal parsed={this.state.modalData} />
				</Modal>
		</Panel>)

	}
}

RoomMessages.defaultProps = {
	roomName: "",
}

RoomMessages.propTypes = {
	roomName: PropTypes.string.isRequired,
}

export default RoomMessages
