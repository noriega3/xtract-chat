import React, { Component } from 'react'

export class JoinRoom extends Component {
	render() {
		return (
			<div>
				Joining room.. {this.props.room}
			</div>
		)
	}
}
export default connect()(JoinRoom)
