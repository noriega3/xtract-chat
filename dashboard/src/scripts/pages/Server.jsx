import DropdownItem from 'muicss/lib/react/dropdown-item'
import Dropdown from 'muicss/lib/react/dropdown'
import Panel from 'muicss/lib/react/panel'
import React, {Component, Fragment} from 'react'

import ServerInfo from "../components/system/ServerInfo.jsx"
import {WS_REQ_CONNECT} from '../middleware/websocket'
import {connect} from 'react-redux'
import {sendConnect} from '../actions/wsDashboardActions'

class Server extends Component {
	constructor(props){
		super(props)
		this.state = {
			tabIndex: 'status'
		}
	}

	componentDidMount(){
		//TODO: add a way to hook into onOpen to attach pm2 connnect and status
		this.props.sendConnect()
	}

	onTabChange(tabIndex){
		this.setState({tabIndex})
	}

	tabContent(){

		switch(this.state.tabIndex) {
			case 'status':
					return (<ServerInfo {...this.props} />)
			case 'config':
					return(<Panel> No Config Panel Set</Panel>)
				default:
					return <div>Invalid Tab</div>
		}
	}

	render() {
		return (
			<div>
					<Dropdown color="primary" label="Options" onSelect={this.onTabChange.bind(this)}>
						<DropdownItem value={'status'}>Status</DropdownItem>
						<DropdownItem value={'config'}>Config</DropdownItem>
					</Dropdown>
				<Fragment>{this.tabContent()}</Fragment>
			</div>
		)
	}
}
const mapDispatchToProps = {
		sendConnect
}

export default connect(null, mapDispatchToProps)(Server)
