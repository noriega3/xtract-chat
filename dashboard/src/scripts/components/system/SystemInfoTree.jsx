import React, { Component } from 'react'
import PropTypes from 'prop-types'
import _ from 'lodash'
import ReactTable from 'react-table'
import 'react-table/react-table.css'
import treeTableHOC from 'react-table/lib/hoc/treeTable'
const TreeTable = treeTableHOC(ReactTable)

export class SystemInfoTree extends Component {
	render() {

		const {data, expanded} = this.props

		if(!data) return null

		let columns = [
			{
				accessor: 'response',
			}
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
					key={this.props.id}
					data={[data]}
					columns={columns}
					showPagination={false}
					showPaginationTop={false}
					collapseOnDataChange={false}
					sortable={false}
					multiSort={false}
					filterable={false}
					showPaginationBottom={false}
					pageSize={1}
					className="-striped -highlight"
					SubComponent={(row) => {

						if(!_.isObject(row.original)){
							return null
						}

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
								value: _.isObject(row.original[key]) ? <SystemInfoTree id={key} expanded={key} data={row.original[key]}/> : row.original[key].toString(),
							}
						});
						return (
								<ReactTable
									key={this.props.id+'tbl'}
									data={rowData}
									columns={tblColumns}
									pageSize={rowData.length}
									sortable={false}
									multiSort={false}
									filterable={false}
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

SystemInfoTree.defaultProps ={
	data: {}
}

SystemInfoTree.propTypes = {
	id: PropTypes.string,
	data: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
	expanded: PropTypes.string
}


export default SystemInfoTree
