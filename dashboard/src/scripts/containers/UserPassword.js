import PropTypes from 'prop-types'
import React, {Component} from 'react'

import _isEmpty from 'lodash/isEmpty'
import _map from 'lodash/map'

import Panel from 'muicss/lib/react/panel'
import Button from 'muicss/lib/react/button'

import { connect } from 'react-redux'
import {
	updatePassword
} from '../actions/apiProfileActions'

import {
	userHasPassword,
	profileErrors,
	apiBusy
} from '../reducers'

import TogglePanel from '../components/templates/TogglePanel'
import UserChangePasswordForm from '../components/user/UserChangePasswordForm'
import {toast} from 'react-toastify'

class UserPassword extends Component {

	constructor(props){
		super(props)
		console.log('user props imported', props)

		//use local state to store a modifiable 'dirty' version of the json to push when saving
		this.state = {}
	}

	componentDidMount(){

	}

	handleOnSubmit(payload){
		this.props.updatePassword(payload)
	}
	callback(res) {

		console.log('Done!!!!', res);
	}
	render() {
		return (
			<TogglePanel title={this.props.userHasPassword ? 'Change Password' : 'Password Options'} hideOnMount={true}>
				<UserChangePasswordForm
					showLegend={false}
					hasCurrent={this.props.userHasPassword}
					onSubmit={(e) => this.handleOnSubmit(e)}
					processing={this.props.processing}
				/>
			</TogglePanel>
		)
	}
}

UserPassword.defaultProps = {
	processing: false
}
UserPassword.propTypes = {
	errors: PropTypes.array,
	userHasPassword: PropTypes.bool,
	updatePassword: PropTypes.func.isRequired,
	processing: PropTypes.bool,
}

const mapStateToProps = state => ({
	userHasPassword: userHasPassword(state),
	processing: apiBusy(state)
})

const mapDispatchToProps = {
	updatePassword: updatePassword
}
export default connect(mapStateToProps, mapDispatchToProps)(UserPassword)
