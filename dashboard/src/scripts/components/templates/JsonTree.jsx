import React, { Component } from 'react'
import PropTypes from 'prop-types'
import _ from 'lodash';
export class JsonTree extends Component {

	constructor(props){
		super(props)
		this.state = {}
	}

	render(){
		return(
			<div>
				<span>{JSON.stringify(this.props.data, null, 2)}</span>
			</div>
		)
	}
}

JsonTree.defaultProps = {
	data: "",
}

JsonTree.propTypes = {
	data: PropTypes.isRequired,
}

export default JsonTree


