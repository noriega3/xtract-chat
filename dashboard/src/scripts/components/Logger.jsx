import React, { Component } from 'react'
import _ from 'lodash'
import Panel from 'muicss/lib/react/panel'
import Button from 'muicss/lib/react/button'
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer'
import styles from './cellmeasurer.css';
import moment from 'moment'

import { Column, Table, SortDirection, CellMeasurerCache, CellMeasurer } from 'react-virtualized';

export class Logger extends Component {
	constructor(props, context){
		super(props, context)

		const sortDirection = SortDirection.ASC

		this.state = {
			error: null,
			sortBy: 'timestamp',
			sortDirection,
		}

		this._cache = new CellMeasurerCache({
			minHeight: 35,
			fixedWidth: true
		});

		this._sort = this._sort.bind(this)
		this.cellRenderer = this.cellRenderer.bind(this)
	}

	componentWillReceiveProps(nextProps) {
		this._cache.clearAll();
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
								deferredMeasurementCache={this._cache}
								style={{alignItems:'baseline'}}
								width={width}
								height={500}
								headerHeight={30}
								overscanRowCount={2}
								rowClassName={styles.tableRow}

								rowHeight={this._cache.rowHeight}
								onRowClick={this.handleRowClick}
								rowCount={messages.length || 0}
								sortBy={sortBy}
								sortDirection={sortDirection}
								sort={this._sort}
								rowGetter={({ index }) => messages[index]}>
								<Column
									width={80}
									label='Time'
									dataKey='timestamp'
									className={styles.tableColumn}
									flexGrow={1}
									style={{
										top: 0,
										textAlign: 'normal'
									}}
									cellDataGetter={({dataKey, rowData}) => {
										return moment(rowData[dataKey], "YYYY-MM-DD hh:mm:ss a").format('LTS')
									}}
								/>
								<Column
									width={75}
									label='type'
									dataKey='type'
									className={styles.tableColumn}

								/>
								<Column
									width={width-300}
									label='Message'
									dataKey='message'
									cellRenderer={this.cellRenderer}
								/>
							</Table>
						)}
					</AutoSizer>
				</Panel>
				<div>{messages.length} Messages Received</div>
			</div>
		)
	}

	cellRenderer ({ columnIndex, dataKey, parent, rowIndex, style }) {
		const {sortBy, sortDirection} = this.state
		const {messages, sendMessageIntent} = this.props


		return (
			<CellMeasurer
				cache={this._cache}
				columnIndex={0}
				key={dataKey}
				parent={parent}
				rowIndex={rowIndex}>
				<div
					className={styles.tableColumn}
					style={{
						overflowWrap: 'break-word',
						whiteSpace: 'normal'
				}}
				>{messages[rowIndex].message}
				</div>
			</CellMeasurer>
		);
	}
}
export default Logger
