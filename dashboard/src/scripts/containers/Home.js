import React, {Component} from 'react'
import PropTypes  from 'prop-types'
import { connect } from 'react-redux'

import Container from 'muicss/lib/react/container'
import Col from 'muicss/lib/react/col'
import Row from 'muicss/lib/react/row'

import {echo} from '../actions/apiEchoActions'
import {serverMessage, isRoleAdmin} from '../reducers'

import TogglePanel from '../components/templates/TogglePanel'
import UserSidebar from '../containers/UserSidebar'
import AdminToolbar from '../containers/AdminToolbar'
import AccountOptions from '../components/AccountOptions'

export class Home extends Component {
	administrationTools(){
		if(this.props.isAdmin)
			return (
				<Col md={4} sm={12}>
					<TogglePanel title={"Administration Tools"}>
						<AdminToolbar />
					</TogglePanel>
				</Col>
			)
	}
	render() {
		return (
				<Container fluid={false}>
					{this.props.message && <Row><Col>{this.props.message}</Col></Row>}
					<Row>
						<Col>Home</Col>
					</Row>
					<Row>
						<Col>Description</Col>
					</Row>
					<Row>
						{this.administrationTools()}
						<Col lg={6} md={6}>
							<TogglePanel title={"Account Options"}>
								<AccountOptions />
							</TogglePanel>
						</Col>
						<Col lg={6} md={6}>
							<UserSidebar />
						</Col>
					</Row>
				</Container>
		);
	}
}
Home.propTypes = {
	isAdmin: PropTypes.bool,
	message: PropTypes.string,
	fetchMessage: PropTypes.func
}

const mapStateToProps = state => ({
	isAdmin: isRoleAdmin(state),
	message: serverMessage(state),

})


const mapDispatchToProps = {
	fetchMessage: echo
}
export default connect(mapStateToProps, mapDispatchToProps)(Home)
