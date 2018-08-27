import PropTypes from 'prop-types'
import React, {Component} from 'react'
import { connect } from 'react-redux'
import moment from 'moment'
import Panel from 'muicss/lib/react/panel'
import {
	summary as fetchSummary,
	appData as fetchAppData
} from '../actions/apiProfileActions'

import {isRoleStaff} from '../reducers'

import UserDetails from '../components/user/UserDetails'
import UserAppsList from '../components/user/UserAppsList'
import UserAppData from '../components/user/UserAppData'

import {
	profileSummary,
	profileAppsList,
	profileAppData,
	profileAppSelect,
	profileLastFetch,
	userId
} from '../reducers'

class Profile extends Component {

	constructor(props){
		super(props)
		this.state = {}
	}

	onSelectApp(appName){
		this.props.fetchAppData(appName)
	}

	componentDidMount(){
		this.props.fetchSummary()
	}

	render() {
		return (
			<div>
				<Panel>
					<UserDetails
						data={this.props.summary}
						editable={false}
					/>
				</Panel>
				<Panel>
					<UserAppsList
						data={this.props.apps}
						value={this.props.selectedApp}
						onSelect={(e) => this.onSelectApp(e)}
						editable={false}
					/>
					<UserAppData
						data={this.props.appData}
						editable={false}
					/>
				</Panel>
				<div className="mui--text-right mui--text-caption">Last Updated: {moment(this.props.lastFetch).format('MMMM Do YYYY, h:mm:ss a')}</div>
			</div>
		)
	}
}

Profile.defaultProps = {
	auth: {},
	appData: {},
	apps: {},
	isRoleStaff: false
}
Profile.propTypes = {
	userId: PropTypes.string.isRequired,
	summary: PropTypes.object,
	selectedApp: PropTypes.string,
	appData: PropTypes.object,
	apps: PropTypes.object,
	auth: PropTypes.any,
	fetchSummary: PropTypes.func,
	fetchAppData: PropTypes.func,
	isRoleStaff: PropTypes.bool,
}

const mapStateToProps = state => ({
	userId: userId(state),
	summary: profileSummary(state),
	apps: profileAppsList(state),
	selectedApp: profileAppSelect(state),
	lastFetch: profileLastFetch(state),
	appData: profileAppData(state),
	isRoleStaff: isRoleStaff(state),
	auth: state.auth
})

const mapDispatchToProps = {
	fetchSummary: fetchSummary,
	fetchAppData: fetchAppData,
}
export default connect(mapStateToProps, mapDispatchToProps)(Profile)
