import PropTypes from 'prop-types'
import React, {Component} from 'react'

import _isEmpty from 'lodash/isEmpty'
import _map from 'lodash/map'

import Panel from 'muicss/lib/react/panel'
import Button from 'muicss/lib/react/button'

import { connect } from 'react-redux'
import {
	registerWithEmail
} from '../actions/apiProfileActions'

import {
	profileErrors,
	apiBusy
} from '../reducers'

import TogglePanel from '../components/templates/TogglePanel'
import {toast} from 'react-toastify'
import UserRegisterForm from '../components/user/UserRegisterForm'

class UserGuest extends Component {

	constructor(props){
		super(props)
		console.log('user props imported', props)

		//use local state to store a modifiable 'dirty' version of the json to push when saving
		this.state = {}
	}

	componentDidMount(){

	}

	handleOnSubmit(payload){
		this.props.registerWithEmail(payload)
	}

	render() {
		return (
			<div>
				<TogglePanel title={"Register"}>
					<UserRegisterForm
						onSubmit={(e) => this.handleOnSubmit(e)}
						processing={this.props.processing}
					/>
				</TogglePanel>
			</div>
		)
	}
}

UserGuest.defaultProps = {
	errors: [],
	processing: false
}
UserGuest.propTypes = {
	updatePassword: PropTypes.func,
	processing: PropTypes.bool
}

const mapStateToProps = state => ({
	processing: apiBusy(state)
})

const mapDispatchToProps = {
	registerWithEmail: registerWithEmail,
}
export default connect(mapStateToProps, mapDispatchToProps)(UserGuest)
