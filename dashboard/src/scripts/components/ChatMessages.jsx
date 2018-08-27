import React, { Component } from 'react'
import PropTypes from 'prop-types'

import Panel from 'muicss/lib/react/panel'

export default class Posts extends Component {
	render() {
		return (
			<div>
				{this.props.messages.map((message, i) => <Panel key={i}>{message.message}</Panel>)}
			</div>
		)
	}
}

Posts.propTypes = {
	message: PropTypes.array.isRequired
}
