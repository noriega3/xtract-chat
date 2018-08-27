import PropTypes from 'prop-types'
import React, {Component} from 'react'

import _isEmpty from 'lodash/isEmpty'
import _map from 'lodash/map'

import Panel from 'muicss/lib/react/panel'
import Button from 'muicss/lib/react/button'
import FacebookLogin from 'react-facebook-login';

import { connect } from 'react-redux'
import {
	disconnectFb,
	fbIdDetails,
} from '../actions/apiProfileActions'

import {
	profileErrors,
	userHasPassword,
	userAccountId,
	userFbId,
	apiBusy
} from '../reducers'

import Modal from '../components/templates/Modal'
import TogglePanel from '../components/templates/TogglePanel'
import UserFacebookDisconnectForm from '../components/user/UserFacebookDisconnectForm'
import {toast} from 'react-toastify'
import UserNewPasswordForm from '../components/user/UserNewPasswordForm'
import UserVerifyPasswordForm from '../components/user/UserVerifyPasswordForm'

class UserFacebook extends Component {

	constructor(props){
		super(props)
		console.log('user props imported', props)

		//use local state to store a modifiable 'dirty' version of the json to push when saving
		this.state = {
			modalOpen: false,
		}
	}

	componentDidMount(){
		this.props.fbIdDetails()

	}

	handleOnDisconnect(payload){
		this.props.disconnectFb(payload)
	}

	handleOnSubmit({facebookId}){
		this.setState({modalOpen: true})
	}

	handleOnModalClose(){
		this.setState({modalOpen: false})
	}

	renderDisconnectFacebook(){
		if(!this.props.fbId) return false
		return <UserFacebookDisconnectForm
			fbId={this.props.fbId}
			accountId={this.props.accountId}
			onSubmit={(e) => this.handleOnSubmit(e)}
			processing={this.props.processing}
		/>
	}

	onDisconnectSubmit(params){
		this.setState({modalOpen: false})
		this.props.disconnectFb({...params, fbId: this.props.fbId})
	}

	render() {
		//TODO: when implementing connect to logic, then move this validation somewhere else
		if(!this.props.fbId) return null
		return (
			<div>
				<TogglePanel title={"Facebook Options"}>
					{this.renderDisconnectFacebook()}
				</TogglePanel>
				<Modal
					show={this.state.modalOpen}
					onClose={(e) => this.handleOnModalClose(e)}
					showClose={false}
					closeSize={'large'}
					closeText={'Cancel'}>
					{this.props.userHasPassword
						? <UserVerifyPasswordForm
							legend={<div>
								<div className="mui--text-title">Verify Password</div>
								<div className="mui--text-caption">Enter your non-facebook account password to proceed</div>
							</div>}
							submitText={'Confirm Disconnect'}
							submitSize={'large'}
							onSubmit={(e) => this.onDisconnectSubmit(e)}
							onCancel={(e) => this.handleOnModalClose(e)}/>
						: <UserNewPasswordForm
							legend={<div>
								<div className="mui--text-title">New Password</div>
								<div className="mui--text-caption">Your disconnected facebook account will need a password.</div>
							</div>}
							submitText={'Confirm Disconnect'}
							submitSize={'large'}
							onSubmit={(e) => this.onDisconnectSubmit(e)}
							onCancel={(e) => this.handleOnModalClose(e)} />
					}
				</Modal>
			</div>
		)
	}
}

UserFacebook.defaultProps = {
	processing: false,
}
UserFacebook.propTypes = {
	accountId: PropTypes.string,
	fbId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
	processing: PropTypes.bool,
	userHasPassword: PropTypes.bool,
	disconnectFb: PropTypes.func,
}

const mapStateToProps = state => ({
	processing: apiBusy(state),
	accountId: userAccountId(state),
	userHasPassword: userHasPassword(state),
	fbId: userFbId(state),
})

const mapDispatchToProps = {
	fbIdDetails: fbIdDetails,
	disconnectFb: disconnectFb,
}
export default connect(mapStateToProps, mapDispatchToProps)(UserFacebook)
