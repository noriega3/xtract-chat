import React, {Component} from 'react'
import _ from 'lodash'
import {sendConnect, sendClose, sendReconnect, sendMessage, sendConfirmInit} from '../actions/wsSimulatorActions'
import {connect} from 'react-redux'
import Dropdown from 'muicss/lib/react/dropdown'
import DropdownItem from 'muicss/lib/react/dropdown-item'

//component
class Chat extends Component {
	constructor(props){
		super(props)
		this.state = {
			selectedRoom: "Select A Room"
		}
	}
	onSelect(ev) {
		ev.preventDefault()  // prevent form submission
	}
	render() {
		const {subscriptions} = this.props
		const {selectedRoom} = this.state
		return (
			<div>
				<Dropdown color="primary" label={selectedRoom} onSelect={(e) => this.onSelect(e)}>
					{_.map(subscriptions, (room, i) =>
						<DropdownItem key={i} value={room} label={room} />
					)}
				</Dropdown>
			</div>
		);
	}
}

//dropdown item component wrap
class RoomOption extends Component {
	
}

//TODO: separate
//container
const FilterChatMessages = connect(

)(Chat)

//Code to associate redux 'state' to props of above component
const mapStateToProps = state => {
	return ({
		subscriptions: state.webClient.subscriptions
	})
}

export default connect(mapStateToProps)(Chat)
