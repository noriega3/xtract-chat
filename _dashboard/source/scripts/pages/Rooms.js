import React, {Component} from 'react'
import ErrorBoundary from '../components/ErrorBoundary'
import AutoComplete from '../components/AutoComplete'
import RoomDetails from '../components/RoomDetails'
import Panel from 'muicss/lib/react/panel'
import _ from 'lodash'
import { getNames, getRoomDetails } from '../resources/roomListResource'

const LABEL_SEARCH = "Search For Rooms"
const PLACEHOLDER_SEARCH = "Search For Rooms"

class Rooms extends Component {

	constructor(){
		super()
		this.state = {
			roomName: "",
			data: []
		}
		this.onSelect = this.onSelect.bind(this)
		this.handleRoomListResult = this.handleRoomListResult.bind(this)
		this.handleInputChange = this.handleInputChange.bind(this)
	}

	onSelect(selectedName, obj){
		this.setState((prev) => ({roomName: selectedName, data:prev.data}))
	}
	handleInputChange(searchTerm){
		this.setState((prev) => ({roomName: "", data:prev.data}))
	}
	handleRoomListResult(result){
		this.setState((prev) => {
			return ({roomName: prev.roomName, data: result})
		})
	}

	render() {
		return (
			<div>
				<h1>Rooms</h1>
				<AutoComplete
					searchOnMount={"source"}
					searchFunc={getNames}
					onData={this.handleRoomListResult}
					onInputChange={this.handleInputChange}
					data = {this.state.data}
					label={LABEL_SEARCH}
					placeholder={PLACEHOLDER_SEARCH}
					autoFocus={true}
					fieldName="roomName"
					onSelect={this.onSelect}
				/>

				{
					this.state.roomName.length > 0 ?
						(<RoomDetails
							searchFunc={getRoomDetails}
							//onData={this.handleDetailsResult}
							roomName={this.state.roomName}
						/>) : (<Panel>No Room Selected</Panel>)
				}
			</div>
		);
	}
}
export default Rooms
