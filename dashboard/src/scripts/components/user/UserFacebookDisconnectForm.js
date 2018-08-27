import React, { Component } from 'react'
import PropTypes from 'prop-types'

import Panel from 'muicss/lib/react/panel'
import Form from 'muicss/lib/react/form'
import Input from 'muicss/lib/react/input'
import Button from 'muicss/lib/react/button'
import _ from 'lodash'
import _isEmpty from 'lodash/isEmpty'
import _isEqual from 'lodash/isEqual'

export class UserFacebookDisconnectForm extends Component{
	constructor(props){
		super(props)
		this.state = {
			disabled: false,
			nextPassword: undefined, nextPasswordConfirm: undefined
		}
	}

	componentDidUpdate(prevProps){
		if(!_isEqual(prevProps.processing, this.props.processing) && !this.props.processing){
			this.setState({disabled: false})
		}
	}

	handleValidationError(){
		if(_isEmpty(this.state.validationError)) return null
		return <Panel className="mui--text-danger">{this.state.validationError}</Panel>
	}
	onNextPassConfirmChange(){

	}
	onNextPassChange(){

	}
	submitDisabled(){

	}

	onSubmit(e){
		e.preventDefault()
		this.props.onSubmit({facebookId: this.props.fbId})
	}

	renderFacebookDisconnect(){
		if(!this.props.fbId) return null
		return (
			<React.Fragment>
				<div className="mui--text-dark-secondary">
					Connected as {this.props.accountId}
				</div>
				<Button color={"danger"} disabled={this.state.disabled} onClick={(e) => this.onSubmit(e)}>Disconnect</Button>
			</React.Fragment>
		)
	}

	render(){
		return(
			<React.Fragment>
				{this.handleValidationError()}
				{this.renderFacebookDisconnect()}
			</React.Fragment>
		)
	}
}

UserFacebookDisconnectForm.defaultProps = {
	processing: false,
	requirePass: true,
	onSubmit: () => {}
}

UserFacebookDisconnectForm.propTypes = {
	accountId: PropTypes.string,
	fbId:PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
	processing:PropTypes.bool,
	requirePass:PropTypes.bool,
	onConnect: PropTypes.func,
	onDisconnect: PropTypes.func,
}

export default UserFacebookDisconnectForm
