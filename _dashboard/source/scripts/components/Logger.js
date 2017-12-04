import React, { Component } from 'react'
import _ from 'lodash'
import Panel from 'muicss/lib/react/panel'
import Button from 'muicss/lib/react/button'
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer'

import { Column, Table, SortDirection } from 'react-virtualized';

function parseJson(str){
	return _.attempt(JSON.parse.bind(null, str));
}

export class Logger extends Component {
	constructor(props, context){
		super(props, context)

		const sortDirection = SortDirection.ASC

		this.state = {
			error: null,
			sortBy: 'timestamp',
			sortDirection,
		}

		this._sort = this._sort.bind(this)
	}

	componentDidMount(){
	}

	_sort ({ sortBy, sortDirection }) {
		const {
			sortBy: prevSortBy,
			sortDirection: prevSortDirection
		} = this.state

		// If list was sorted DESC by this column.
		// Rather than switch to ASC, return to "natural" order.
		if (prevSortDirection === SortDirection.DESC) {
			sortBy = null
			sortDirection = null
		}

		this.setState((prev) => ({...prev, sortBy, sortDirection }))
	}

	render(){

		const {sortBy, sortDirection} = this.state
		const {messages, sendMessageIntent} = this.props

		return (
		<div className="container">
			{this.state.error &&
			<Panel className="alert alert-danger">
				<a onClick={() => this.setState({ error: null })} className="pull-right">x</a>
				{this.state.error}
			</Panel>}
			<Panel>

					<AutoSizer disableHeight>
						{({width}) => (
							<Table
							width={width}
							height={500}
							headerHeight={30}
							rowHeight={50}
							onRowClick={this.handleRowClick}
							rowCount={messages.length || 0}
							sortBy={sortBy}
							sortDirection={sortDirection}
							sort={this._sort}
							rowGetter={({ index }) => messages[index]}>
								<Column
									width={200}
									label='Time'
									dataKey='timestamp'
								/>
								<Column
									width={70}
									label='type'
									dataKey='type'
								/>
								<Column
									width={500}
									label='Message'
									dataKey='message'
									flexGrow={1}
								/>
							</Table>
						)}
					</AutoSizer>
			</Panel>
			<div>{messages.length} Messages Received</div>
		</div>
		)
	}
}
export default Logger
