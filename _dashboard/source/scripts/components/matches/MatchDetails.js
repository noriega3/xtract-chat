import React, { Component } from 'react'
import _ from 'lodash'
import Panel from 'muicss/lib/react/panel'
import Button from 'muicss/lib/react/button'
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer'

import { Column, Table, SortDirection } from 'react-virtualized';

function parseJson(str){
	return _.attempt(JSON.parse.bind(null, str));
}

export class MatchDetails extends Component {
	constructor(props, context){
		super(props, context)

		this.state = {
			matchId: null,
			error: null,
		}

	}

	componentDidMount(){

	}

	render(){

		const {roomName} = this.props

		return (
		<div className="container">
			{this.state.error &&
			<Panel className="alert alert-danger">
				<a onClick={() => this.setState({ error: null })} className="pull-right">x</a>
				{this.state.error}
			</Panel>}
			<Panel>
				something
			</Panel>
		</div>
		)
	}
}
export default MatchDetails
