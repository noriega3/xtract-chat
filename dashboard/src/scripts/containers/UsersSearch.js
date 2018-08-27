import React, {Component} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'

import Panel from 'muicss/lib/react/panel'

import AutoComplete from '../components/AutoComplete.jsx'

import {searchQuery, searchResults, searchQuerying, searchNextCursor} from '../reducers'
import {searchUsers} from '../actions/apiSearchActions'
import {getUserId} from '../actions/apiUsersActions'
import {Redirect} from 'react-router-dom'

class UsersSearch extends Component {

	constructor(props){
		super(props)
		this.state = {}
	}

	onResultSelect(userId, accountId){
		this.props.history.push(`/users/profile/${userId}`)
	}


	render() {
		return (
			<Panel>
				<AutoComplete
					label				= {'Search For Users'}
					autoFocus			= {true}
					query				= {this.props.query}
					results				= {this.props.results}
					nextCursor			= {this.props.nextCursor}
					searching			= {this.props.searching}
					searchFunc			= {this.props.searchUsers}
					onResultSelect		= {this.onResultSelect.bind(this)}
				/>
			</Panel>
		);
	}
}

const mapStateToProps = state => ({
	query: searchQuery(state),
	results: searchResults(state),
	searching: searchQuerying(state),
	nextCursor: searchNextCursor(state),
	auth: state.auth
})

const mapDispatchToProps = {
	searchUsers
}
export default connect(mapStateToProps, mapDispatchToProps)(UsersSearch)
