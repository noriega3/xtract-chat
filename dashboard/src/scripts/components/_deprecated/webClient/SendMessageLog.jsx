import React, { Component } from 'react'
import _ from 'lodash'
import ReactTable from 'react-table'
import 'react-table/react-table.css'
import ToggleTextArea from '../../components/templates/ToggleTextArea'
import treeTableHOC from 'react-table/lib/hoc/treeTable';
const TreeTable = treeTableHOC(ReactTable)

export class SendMessageLog extends Component {
	render() {
		const {messages, expanded} = this.props

		//filter out fields
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
				id: 'intent',
				Header: 'intent',
				maxWidth: 100,
				accessor: (d) => _.get(d,'parsed.intent', '-')
			},
			{
				Header: 'Request Sent',
				id: 'request',
				accessor: d => _.get(d,'message', '-')
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
						const rowData = Object.keys(row.original).map((key) => {
							return {
								property: key,
								value: _.isObject(row.original[key]) ? <SendMessageLog key={key} expanded={key} messages={[row.original[key]]}/> : row.original[key].toString(),
							}
						});

						if(row.original.message){
							rowData.push({
								property: 'fullMessage',
								value: <ToggleTextArea label={"Full Message"} value={row.original.message} disabled={true} />
							})
						}
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
export default SendMessageLog
