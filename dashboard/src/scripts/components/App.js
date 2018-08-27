import PropTypes from 'prop-types'
import React, {Component} from 'react'
import { toast } from 'react-toastify'
import { connect } from 'react-redux'
import _ from 'lodash';
import _isEmpty from 'lodash/isEmpty'

import Appbar from 'muicss/lib/react/appbar'
import Container from 'muicss/lib/react/container'
import Button from "muicss/lib/react/button";
import Panel from 'muicss/lib/react/panel'

import LoadingBar from 'react-redux-loading-bar'

import Home from '../containers/Home'
import Profile from "../containers/Profile";
import ProfileDownload from "../containers/ProfileDownload";
import UserPassword from "../containers/UserPassword";
import UsersSearch from '../containers/UsersSearch'
import User from '../containers/User'
import Admin from '../containers/Admin'
import UserWebSocket from '../containers/UserWebSocket'

import RequestDelete from '../pages/RequestDelete'
import Logout from '../containers/Logout'

import Server from '../pages/Server.jsx'
import WebClient from '../pages/WebClient.jsx'
import Rooms from '../pages/Rooms.jsx'
import NotFound from '../pages/NotFound'
import MessageGenerator from "../pages/MessageGenerator";
import SidebarMenu from "./SidebarMenu";

import {echo} from '../actions/apiEchoActions';

import {
	withRouter,
	Route,
	NavLink,
	Switch
} from 'react-router-dom'


import * as reducers from '../reducers'
import _get from 'lodash/get'
import ErrorBoundary from './ErrorBoundary'

const routes = [
	{
		path: "/",
		name: 'Home',
		component(props){return <Home {...props} />},
		exact: true,
		sidebar: true,
		appbar: true
	},
	{
		path: "/myaccount/delete",
		name: 'Request Account Deletion',
		component(props){return <RequestDelete {...props} />},
		exact: true,
		sidebar: false,
		appbar: false
	},
	{
		path: "/myaccount",
		name: 'My Account',
		component(props){return <Profile {...props} />},
		exact: true,
		sidebar: true,
		appbar: false
	},
	{
		path: "/myaccount/changepassword",
		name: 'Change Password',
		component(props){return <UserPassword {...props} />},
		sidebar: true
	},
	{
		path: "/myaccount/datarequest",
		name: 'Request Data',
		component(props){return <ProfileDownload {...props} />},
		sidebar: true
	},
	{
		path: "/users",
		name: 'User Search',
		component(props){return <UsersSearch {...props} />},
		permissions: ['s'],
		exact: true,
		sidebar: true,
		appbar: true
	},
	{
		path: "/users/profile/:id",
		name: 'View User',
		component(props){ return <User {...props}/>},
		permissions: ['s'],
		sidebar: false,
		appbar: false
	},
	{
		path: "/messagegenerator",
		name: 'Message Generator',
		component(props){return <MessageGenerator {...props} />},
		sidebar: true,
		permissions: ['a'],
	},
	{
		path: "/webclient",
		name: 'Simulator',
		component(props){return <WebClient {...props} />},
		sidebar: true,
		permissions: ['a'],
	},
	{
		path: "/admin",
		name: 'Admin',
		component(props){return <Admin {...props} />},
		sidebar: true,
		appbar: true,
		permissions: ['s'],
	},
	{
		path: "/server",
		name: 'Server',
		component(props){return <Server {...props} />},
		sidebar: true,
		appbar: true,
		permissions: ['s'],
	},
	{
		path: "/rooms",
		name: 'Rooms',
		component(props){return <Rooms {...props} />},
		sidebar: true,
		appbar: true,
		permissions: ['a'],
	},
	{
		path: "/logout",
		name: 'Logout',
		component(props){return <Logout {...props} />},
		exact: true,
		sidebar: true,
		appbar: true
	},
	{
		path: "*",
		component(props){return <NotFound {...props} />},
		status: 404
	},
]

class App extends Component{
	constructor(props) {
		super(props)
		this.state = {
			pRoutes: this.filterPermissions(routes)
		}
		this.showInputErrors 	= this.showInputErrors.bind(this)
		this.toggleSidebar 		= this.toggleSidebar.bind(this)
		this.ping 				= _.debounce(this.ping.bind(this), 15000)
	}

	componentDidUpdate(prevProps){
		if(!_.isEqual(prevProps.serverMessage, this.props.serverMessage)){
			this.ping()
		}
		if(!_.isEqual(prevProps.profileErrors, this.props.profileErrors) && !_.isEmpty(this.props.profileErrors)){
			this.showInputErrors()
		}
	}

	showInputErrors(){
		_.map(this.props.profileErrors, ({msg}) => {
			toast.error(msg)
		})
	}

	ping(){
		this.props.echo(Date.now())
	}

	filterPermissions(selectedRoutes){
		return _.filter(selectedRoutes, (r) => {
			if(r.permissions){
				if(this.props.isRoleAdmin) return true
				return ((_.indexOf(r.permissions, 's') >=0) && this.props.isRoleStaff)
			}
			return true
		})
	}

	setupAppbarRoutes(){
		return _.filter(this.state.pRoutes, {'appbar': true})
	}

	setupSidebarRoutes(){
		return _.filter(this.state.pRoutes, {'sidebar': true})
	}

	toggleSidebar() {
		this.setState({sidebar: !this.state.sidebar})
	}

	render(){
		const {pRoutes} = this.state
		return(<div>
				<SidebarMenu routes={this.setupSidebarRoutes()} show={this.state.sidebar} onToggle={this.toggleSidebar}>
					<Appbar id={"appbar"}>
						<table width="100%">
							<tbody>
							<tr className={"mui--appbar-height"}>
								<td width="60%">
									<ul className="mui-list--inline">
										<li id={"appbar-sidenav-icon"}>
											<Button variant="fab" color="primary" size="small" onClick={this.toggleSidebar} className={"mui--no-user-select mui--overflow-hidden"}><i className={"fa fa-bars"} /></Button>
										</li>
										<li className={"mui--align-middle"}>
											{pRoutes.map((route, index) => (<Route key={index} path={route.path} exact={route.exact} render={()=><div className={"mui--text-title"}>{route.name}</div>} />))}
										</li>
									</ul>
								</td>
								<td width="40%">
									<ul className="mui-list--inline mui--text-right mui--hidden-sm mui--hidden-xs">
										{this.setupAppbarRoutes().map((route, index) => <li	key={index}	className={index > 0 ? "mui--divider-left" : ""}>
											<NavLink activeStyle={{fontWeight: 'bold'}} to={route.path} exact={route.exact}>{route.name}</NavLink>
										</li>)}
									</ul>
								</td>
							</tr>
							</tbody>
						</table>
					</Appbar>
					<ErrorBoundary>
						<UserWebSocket />
					</ErrorBoundary>
					<div id={"content-wrapper"}>
						{!_isEmpty(this.props.serverMessage) ? <Panel>{this.props.serverMessage}</Panel> : null}
						{!_isEmpty(this.props.errors) ? <Panel className="mui--bg-danger mui--text-light-secondary"><i className={"fa fa-exclamation-triangle"} title={"Server Error. Please try again later."} /> {_get(this, 'props.errors.error', _get(this, 'props.errors.global_error.statusText', 'An unknown error occurred, please try again later.'))}</Panel> : ''}
						<ErrorBoundary>
							<Switch>
								{pRoutes.map((route, index) => (
									<Route
										key={index}
										path={route.path}
										exact={route.exact}
										render={route.component}
									/>
								))}
							</Switch>
						</ErrorBoundary>
					</div>
					<footer id={"footer"}>
						<Container fluid={true}>
							<br />
							Footer
						</Container>
					</footer>
				</SidebarMenu>
		</div>)
	}
}

App.defaultProps = {
	errors: {},
	isRoleAdmin: false,
	isRoleStaff: false,
}

App.propTypes = {
	echo: PropTypes.func,
	isRoleAdmin: PropTypes.bool,
	isRoleStaff: PropTypes.bool,
	errors: PropTypes.object,
	profileErrors: PropTypes.array
}
const mapStateToProps = (state) => ({
	serverMessage: reducers.serverMessage(state),
	profileErrors: reducers.profileErrors(state),
	isRoleAdmin: reducers.isRoleAdmin(state),
	isRoleStaff: reducers.isRoleStaff(state),
	errors: reducers.authErrors(state)
})

const mapDispatchToProps = {
	echo
}


export default connect(mapStateToProps, mapDispatchToProps)(App)
