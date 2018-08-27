import React, { Component } from 'react'
import PropTypes from 'prop-types'

import Panel from 'muicss/lib/react/panel'
import _ from 'lodash'
import Parameter from '../templates/Parameter'
import {parseJsonMessage} from '../../utils'

export class UserDetails extends Component{
	constructor(props){
		super(props)
		this.state = {
			rootElements: parseJsonMessage(props.data)
		}
	}

	formatIncomingData(){
		const formatted = parseJsonMessage(this.props.data)
		console.log('formatted',formatted)
		this.setState({rootElements: formatted})
	}

	componentDidUpdate(prevProps){
		if(!_.isEqual(prevProps.data, this.props.data)) {
			this.formatIncomingData()
		} //tODO: add a parameter for userId
	}

	handleOnChange(e){
		console.log('on change for details', e)
		this.props.onChange(e)
	}

	render(){
		if(_.isEmpty(this.props.data)) return(<Panel>No Data for App</Panel>)

		return(<React.Fragment>
			{_.map(this.state.rootElements, (ele, i) =>
				<Parameter
					key={'root-summary-'+i}
					root={true}
					field={ele.field}
					type={ele.type}
					value={ele.value}
					editable={this.props.editable}
					onSave={(e) => this.handleOnChange(e)}
				/>
			)}
		</React.Fragment>)
	}
}

UserDetails.defaultProps = {
	data: {},
	editable: false,
	onChange: () => {}
}

UserDetails.propTypes = {
	data: PropTypes.object.isRequired,
	editable:PropTypes.bool,
	onChange: PropTypes.func,
}

export default UserDetails
