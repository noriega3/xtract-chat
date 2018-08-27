import PropTypes from 'prop-types'
import React, {Component} from 'react'
import { connect } from 'react-redux'
import {toast} from 'react-toastify'

import _isEqual from 'lodash/isEqual'
import moment from 'moment'

import Panel from 'muicss/lib/react/panel'
import {
	summary as fetchSummary,
	appData as fetchAppData,
	setAppData,
	setSummary,
} from '../actions/apiUsersActions'

import {isRoleStaff} from '../reducers'

import UserDetails from '../components/user/UserDetails'
import UserAppsList from '../components/user/UserAppsList'
import UserAppData from '../components/user/UserAppData'

import {
	editUserId,
	editUserSummary,
	editUserAppsList,
	editUserAppData,
	editUserAppSelect,
	editUserLastFetch,
	editUserSaveState
} from '../reducers'

class User extends Component {
	constructor(props){
		super(props);

		this.toastId = null
	}

	onSelectApp(appName){
		this.props.fetchAppData(this.props.userId, appName)
	}

	onSaveSummaryField(data){
		console.log('onSaveSummaryData', data)
		this.props.setSummary(this.props.userId, data)
	}

	onSaveAppDataField(data){
		console.log('onSaveAppData', data)
		this.props.setAppData(this.props.userId, this.props.selectedApp, data)
	}

	componentDidMount(){
		if(!_isEqual(this.props.match.params.id, -1))
			this.props.fetchSummary(this.props.match.params.id)
	}

	componentDidUpdate(prevProps){
		if(!_isEqual(prevProps.saveState, this.props.saveState)){
			switch(this.props.saveState){
				case 'OK':
					this.toastId && toast.update(this.toastId, {
						render: 'Saved!',
						type: toast.TYPE.SUCCESS,
						autoClose: 5000,
						closeButton: null // The closeButton defined on ToastContainer will be used
					});
					break
				case 'BUSY':
					this.toastId = toast("Saving..", {autoClose: false, closeButton: false})
					break
				case 'FAIL':
					this.toastId && toast.update(this.toastId, {
						render: 'Error Saving..!',
						type: toast.TYPE.ERROR,
						autoClose: 5000,
						closeButton: null // The closeButton defined on ToastContainer will be used
					});
					break
			}
		}
	}

	render() {
		console.log(typeof this.props.match.params.id,this.props.match.params.id)
		console.log(typeof this.props.userId,this.props.userId)
		if(_isEqual(this.props.match.params.id, -1)) return null
		if(_isEqual(this.props.userId, -1)) return null
			return (
				<div>
					<Panel>
						<UserDetails
							data={this.props.summary}
							onChange={(e) => this.onSaveSummaryField(e)}
							editable={this.props.isRoleStaff}
						/>
					</Panel>
					<Panel>
						<UserAppsList
							data={this.props.apps}
							value={this.props.selectedApp}
							onSelect={(e) => this.onSelectApp(e)}
							editable={this.props.isRoleStaff}
						/>
						<UserAppData
							data={this.props.appData}
							onChange={(e) => this.onSaveAppDataField(e)}
							editable={this.props.isRoleStaff}
						/>
					</Panel>
					<div className="mui--text-right mui--text-caption">Last Updated: {moment(this.props.lastFetch).format('MMMM Do YYYY, h:mm:ss a')}</div>
				</div>
		)
	}
}

User.defaultProps = {
	userId: -1,
	auth: {},
	appData: {},
	apps: {},
	isRoleStaff: false,
	match: { params: {id: -1}}
}
User.propTypes = {
	userId: PropTypes.string.isRequired,
	summary: PropTypes.object,
	selectedApp: PropTypes.string,
	appData: PropTypes.object,
	apps: PropTypes.object,
	auth: PropTypes.any,
	fetchSummary: PropTypes.func,
	fetchAppData: PropTypes.func,
	isRoleStaff: PropTypes.bool,
	match: PropTypes.object,
	setSummary: PropTypes.func,
	setAppData: PropTypes.func,
	saveState: PropTypes.string,
}

const mapStateToProps = state => ({
	userId: editUserId(state),
	summary: editUserSummary(state),
	apps: editUserAppsList(state),
	selectedApp: editUserAppSelect(state),
	lastFetch: editUserLastFetch(state),
	appData: editUserAppData(state),
	isRoleStaff: isRoleStaff(state),
	saveState: editUserSaveState(state),
	auth: state.auth
})

const mapDispatchToProps = {
	fetchSummary: fetchSummary,
	fetchAppData: fetchAppData,
	setSummary,
	setAppData,
}
export default connect(mapStateToProps, mapDispatchToProps)(User)
