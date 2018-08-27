import React, {Component} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import Container from 'muicss/lib/react/container';
import Row from 'muicss/lib/react/row';
import Col from 'muicss/lib/react/col';
import JsonTree from '../templates/JsonTree'

//component
class ConnectionDetails extends Component {
	constructor(props){
		super(props)
		this.state = {
			selectedRoom: "Select A Room"
		}
	}
	onSelect(ev) {
		ev.preventDefault()  // prevent form submission
	}
	render() {
		const {client, userSummary} = this.props
		console.log(client)
		const {selectedRoom} = this.state
		return (
			<Container fluid={true}>
				<Row>
					<Col xs="6">
						<div>Pubsub</div>
						<JsonTree data={client}/>
					</Col>
					<Col xs="6">
						<div>Users</div>
						<JsonTree data={userSummary}/>
					</Col>
				</Row>
			</Container>
		);
	}
}

//Code to associate redux 'state' to props of above component
const mapStateToProps = state => {
	return ({
		userId: state.webClient.userId,
		client: _.omitBy(state.webClient, (value) => _.isArrayLikeObject(value) || _.isObject(value)),
		userSummary: state.users.data,
	})
}

//Code to send to access and send to websocket (web simulator)
const mapDispatchToProps = {

}
export default connect(mapStateToProps, mapDispatchToProps)(ConnectionDetails)
