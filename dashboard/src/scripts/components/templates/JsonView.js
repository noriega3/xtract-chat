import React, {Component} from 'react';
import PropTypes from 'prop-types';
import _ from 'lodash'

import {formatToEditableObject, formatToExportedJson} from '../../utils'

import Parameter from './Parameter'
import _isEqual from 'lodash/isEqual'

class JsonView extends Component {
	constructor(props){
		super(props)
		this.state = {
			editableObjArr: formatToEditableObject(props.value),
		}
	}

	componentDidUpdate(prevProps){
		if(!_isEqual(this.props.value, prevProps.value) && this.props.value)
			this.setState({editableObjArr: formatToEditableObject(this.props.value)})
	}

	onValueChange (e) {
		//from redux immutable update patterns (https://redux.js.org/recipes/structuring-reducers/immutable-update-patterns#updating-an-item-in-an-array)
		const {index, field, type, value} = e
		let editableObjArr = _.cloneDeep(this.state.editableObjArr)
		if(!_.has(editableObjArr, index))
			editableObjArr = editableObjArr.concat([[field,type,value]])
		else {
			if(field) editableObjArr[index][0] = field
			if(type) editableObjArr[index][1] = type
			if(value) editableObjArr[index][2] = value
		}

		const nextValue = formatToExportedJson(editableObjArr)
		console.log(nextValue, ' from json')
		this.props.onChange(nextValue)
	}

	render() {
		console.log('editableObject', this.state)
		return (
			<React.Fragment>
				<div className="mui--text-caption">Data for: {this.props.parentField}</div>
				{_.map(this.state.editableObjArr, ([field,type,value],index) =>
					<Parameter
						key={`${this.props.field}-${index}`}
						label={`obj-${index}`}
						parentField={this.props.parentField}
						field={field}
						type={type}
						value={value}
						editable={this.props.editable}
						disabled={this.props.disabled}
						onSave={(e) => this.onValueChange(e)}
						level={index}>
					</Parameter>
				)}
			</React.Fragment>
		)
	}
}


JsonView.defaultProps = {
	data: [],
	isRoot: false,
	editable: false,
	disabled: false,
	rootElements: [],
	paramElements: [],
	onMessageChange: () => {},
	isWebClient: false
}

JsonView.propTypes = {

	parentField: PropTypes.string,
	field: PropTypes.string,
	type: PropTypes.any,
	value: PropTypes.any,
	onChange: PropTypes.func,

	onMessageChange: PropTypes.func,
	paramElements: PropTypes.array,
	rootElements: PropTypes.array,
	editable: PropTypes.bool,
	disabled: PropTypes.bool,
	isWebClient: PropTypes.bool
}

export default JsonView
