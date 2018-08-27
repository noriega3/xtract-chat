import React, {Component} from 'react'
import PropTypes from 'prop-types'

import {
	NavLink,
} from 'react-router-dom'

import '../../styles/sidebar.css'

class SidebarMenu extends Component{
	constructor(props) {
		super(props)
		console.log(props.routes)
		this.handleOnToggle = this.handleOnToggle.bind(this);
	}
	handleOnToggle() {
		this.props.onToggle()
	}
	render(){
		return(
			<div className={(this.props.show ? "sidebar-active" : "hide-sidedrawer")}>
				<Sidebar routes={this.props.routes} className={(this.props.show) ? "mui--show" : "mui--hide"}/>
				{this.props.children}
				<div className={"overlay"} onClick={this.handleOnToggle} />
			</div>
		)
	}
}
SidebarMenu.propTypes = {
	show: PropTypes.bool,
	routes: PropTypes.array,
	children: PropTypes.any,
	onToggle: PropTypes.func,
}

export default SidebarMenu

class Sidebar extends Component{
	constructor(props) {
		super(props)
	}

	render(){
		return (
			<div id={"sidedrawer"} className={this.props.className}>
				<div id="sidedrawer-brand" className="mui--appbar-line-height">
					<span className="mui--text-title">Dashboard</span>
				</div>
				<div className="mui-divider" />
				<ul>
					{this.props.routes.map((route, index) =>
						<li	key={index}	className={""}>
						<NavLink activeStyle={{fontWeight: 'bold'}} to={route.path} exact={route.name === 'Home'}>{route.name}</NavLink>
					</li>)}
				</ul>
			</div>
		)
	}
}
