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

class ServerConfig extends Component {
	constructor(props) {
		super(props)
	}

	render() {
		return(
			<div>
				<h1>Server config</h1>
				<ul>
					<li>some key : some value</li>
					<li>some key: some value</li>
				</ul>
			</div>
		)
	}
}


ServerConfig.propTypes = {

}

export default ServerConfig
