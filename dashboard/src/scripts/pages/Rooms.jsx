import React, {Component} from 'react'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import AutoComplete from '../components/AutoComplete.jsx'
import RoomDetails from '../components/RoomDetails.jsx'
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
		this.onResultSelect = this.onResultSelect.bind(this)
		this.handleListResult = this.handleListResult.bind(this)
		this.handleInputChange = this.handleInputChange.bind(this)
	}

	onResultSelect(selectedName, selectedObject, tabIndex){
		this.setState((prev) => ({roomName: selectedName, data:prev.data}))
	}
	handleInputChange(searchTerm){
		this.setState((prev) => ({roomName: "", data:prev.data}))
	}
	handleListResult(result){
		this.setState((prev) => {
			return ({roomName: prev.roomName, data: result})
		})
	}

	render() {
		return (
			<div>
				<h1>Rooms</h1>
				<AutoComplete
					searchOnMount={""}

					data        = {this.state.data}
					label       = {LABEL_SEARCH}
					placeholder = {PLACEHOLDER_SEARCH}
					autoFocus   = {true}
					fieldName   = "roomName"
					idle={false}
					searchFunc      = {getNames}
					onData          = {this.handleListResult}
					onInputChange   = {this.handleInputChange}
					onResultSelect  = {this.onResultSelect}
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
