import React, { Component } from 'react'
import _ from 'lodash'
import ReactTable from 'react-table'
import 'react-table/react-table.css'
import ToggleTextArea from '../../components/templates/ToggleTextArea'

import treeTableHOC from 'react-table/lib/hoc/treeTable';
const TreeTable = treeTableHOC(ReactTable)

export class ConnectionLog extends Component {
	render() {
		const {messages, expanded} = this.props
		let columns = [
			{
				id: 'ClientTime',
				Header: 'Client Time',
				width: 128,
				accessor: (d) =>{
					return d.clientTime
				},
				defaultSortDesc: true
			},
			{
				id: 'ServerTime',
				Header: 'Server Time',
				width: 128,
				accessor: (d) =>{
					return d.parsed.serverTime
				}
			},
			{
				id: 'phase',
				Header: 'Phase',
				maxWidth: 100,
				accessor: (d) =>{
					return d.parsed.phase
				}
			},
			{
				Header: 'Response',
				id: 'response',
				accessor: d => d.message
			},
		]
		if(expanded){
			columns = [
				{
					id: expanded,
					accessor: (d) => {
						return 'object('+_.size(d)+')'
					}
				}
			]
		}
		// now use the new TreeTable component
		return (
			<div>
				<TreeTable
					data={messages}
					columns={columns}
					showPagination={false}
					showPaginationTop={false}
					showPaginationBottom={false}
					pageSize={messages.length}
					sorted={[{ // the sorting model for the table
						id: 'serverTime',
						desc: true
					}]}
					SubComponent={(row) => {
						// a SubComponent just for the final detail
						const tblColumns = [
							{
								Header: 'Property',
								accessor: 'property',
								width: 200,
								Cell: (ci) => {
									return `${ci.value}:`
								},
								style:
									{
										backgroundColor: '#DDD',
										textAlign: 'right',
										fontWeight: 'bold'
									}
							},
							{Header: 'Value', accessor: 'value'},
						]
						const rowData = Object.keys(row.original).map((property) => {
							let value = _.get(row, ['original',property], "")
							if(_.isObject(value)){
								value = <ConnectionLog key={property} expanded={property} messages={[value]}/>
							}
							if(_.isEqual('message', property)){
								value = <ToggleTextArea label={"Full Message"} value={value} disabled={true} />
							}

							return { property, value }
						})

						return (
								<ReactTable
									data={rowData}
									columns={tblColumns}
									pageSize={rowData.length}
									showPagination={false}
									showPaginationTop={false}
									showPaginationBottom={false}
								/>
						);
					}}

				/>
			</div>
		)
	}

}
export default ConnectionLog
