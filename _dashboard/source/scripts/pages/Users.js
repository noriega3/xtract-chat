import React, {Component} from 'react'
import ErrorBoundary from '../components/ErrorBoundary'
import AutoComplete from '../components/AutoComplete'
import UserDetails from '../components/UserDetails'
import Panel from 'muicss/lib/react/panel'
import _ from 'lodash'
import {getNames, getUserDetails} from '../resources/usersListResource'

const LABEL_SEARCH = "Search For Users"
const PLACEHOLDER_SEARCH = "Search For Users"

class Users extends Component {

	constructor(){
		super()
		this.state = {
			userId: "",
			data: []
		}

		this.onSelect = this.onSelect.bind(this)
		this.handleListResult = this.handleListResult.bind(this)
		this.handleInputChange = this.handleInputChange.bind(this)
	}

	onSelect(selectedName, dataObj, alldata, index){
		console.log('on select', alldata, index)
		if(_.has(dataObj, 'userId')){
			this.setState((prev) => ({userId: dataObj.userId, data: prev.data}))
		}
	}
	handleInputChange(searchTerm){
		console.log('input change')
		this.setState((prev) => ({userId: "",  data:prev.data}))
	}
	handleListResult(result){
		this.setState((prev) => {
			return ({userId: prev.userId, data: result})
		})
	}

	render() {
		return (
			<div>
				<h1>Users</h1>
				<AutoComplete
					searchOnMount={"lian@gmail.com"}

					data 		= {this.state.data}
					label 		= { LABEL_SEARCH }
					placeholder = { PLACEHOLDER_SEARCH }
					autoFocus 	= {true}
					fieldName 	= "accountId"

					searchFunc 		= {getNames}
					onData			= {this.handleListResult}
					onInputChange	= {this.handleInputChange}
					onSelect		= {this.onSelect}
				/>
				{
					this.state.userId.length > 0 ?
						(<UserDetails
							key={this.state.userId}
							searchFunc={getUserDetails}
							//onData={this.handleDetailsResult}
							userId={this.state.userId}
						/>) : (<Panel>No User Selected</Panel>)
				}
			</div>
		);
	}
}
export default Users
