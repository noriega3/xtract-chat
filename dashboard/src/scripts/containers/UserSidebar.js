import PropTypes from 'prop-types'
import React, {Component} from 'react'

import _get from 'lodash/get'
import _isEqual from 'lodash/isEqual'
import _isEmpty from 'lodash/isEmpty'
import _map from 'lodash/map'

import Panel from 'muicss/lib/react/panel'

import { connect } from 'react-redux'

import {
	updatePassword
} from '../actions/apiProfileActions'

import {
	userAccountType,
	userFbId,
	apiBusy
} from '../reducers'

import UserPassword from '../containers/UserPassword'
import UserFacebook from '../containers/UserFacebook'
import UserGuest from '../containers/UserGuest'

import {toast} from 'react-toastify'

class UserSidebar extends Component {

	constructor(props){
		super(props)
		//use local state to store a modifiable 'dirty' version of the json to push when saving
		this.state = {}
	}

	componentDidMount(){

	}

	renderUserPassword(){
		if(!_isEqual(_get(this, 'props.userAccountType'), 'email')) return false
		return <UserPassword />
	}

	renderUserFacebook(){
		if(!_isEqual(_get(this, 'props.userAccountType'), 'email')) return false
		return <UserFacebook />
	}

	renderUserGuest(){
		if(!_isEqual(_get(this, 'props.userAccountType'), 'guest')) return false
		return <UserGuest />
	}

	render() {
		return (
				<React.Fragment>
					{this.renderUserPassword() || this.renderUserGuest()}
					{this.renderUserFacebook()}
				</React.Fragment>
		)
	}
}

UserSidebar.defaultProps = {
	processing: false
}
UserSidebar.propTypes = {
	updatePassword: PropTypes.func,
	processing: PropTypes.bool
}

const mapStateToProps = state => ({
	userAccountType: userAccountType(state),
	processing: apiBusy(state)
})

const mapDispatchToProps = {}
export default connect(mapStateToProps, mapDispatchToProps)(UserSidebar)
