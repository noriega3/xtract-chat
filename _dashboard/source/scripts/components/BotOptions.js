import React, { Component } from 'react'
import PropTypes from 'prop-types';

const styles = {
	root: {
		display: 'flex',
		flexWrap: 'wrap',
	},
	title: {
		cursor: 'pointer',
	},
	buttons:{
		margin: 12
	},
	toggle: {
		marginBottom: 16,
	},
};

class BotOptions extends Component {
	constructor(props) {
		super(props)
	}

	render() {
		const {userId} = this.props
		return(
			<div>
				<h1>{userId}</h1>
				<ul>
					<li>Force Disconnect</li>
					<li>View Log</li>
				</ul>
			</div>
		)
	}
}


BotOptions.propTypes = {

}

export default BotOptions
