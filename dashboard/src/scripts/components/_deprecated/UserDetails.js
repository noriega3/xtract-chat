import React, { Component } from 'react'
import PropTypes from 'prop-types'

import Panel from 'muicss/lib/react/panel'
import Form from 'muicss/lib/react/form'
import Divider from 'muicss/lib/react/divider'
import Container from 'muicss/lib/react/container'
import Row from 'muicss/lib/react/row'
import Col from 'muicss/lib/react/col'
import Button from 'muicss/lib/react/button'
import _ from 'lodash'
import _isEqual from 'lodash/isEqual'
import { toast } from 'react-toastify'

import UserKeyTypeValue from '../templates/UserKeyTypeValue'
import {parseJsonMessage} from '../../utils'

/* Utility Function */
function _isJson(str) {
	return !_.isError(_.attempt(JSON.parse, str));
}

export class UserDetails extends Component{
	constructor(props){
		super(props)
		this.state = {
			rootElements: parseJsonMessage(props.data),
			isWebClient: props.isWebClient || false
		}
		this.onChange = this.onChange.bind(this)
	}

	formatIncomingData(){
		const formatted = parseJsonMessage(this.props.data)
		console.log('formatted',formatted)
		this.setState({rootElements: formatted})
	}

	onChange(i, value, tab, ev) {
		this.setState((prev) => ({...prev, onTab: value}))
	}
	componentDidUpdate(prevProps){
		if(!_.isEqual(prevProps.data, this.props.data)) {
			this.formatIncomingData()
		} //tODO: add a parameter for userId
	}

	render(){
		if(_.isEmpty(this.props.data)) return(<Panel>No Data for App</Panel>)
		console.log('root elements', this.state.rootElements)
		if(_.isEmpty(this.state.rootElements)) return(<Panel>Loading Data for App</Panel>)

		return(<React.Fragment>
			{_.map(this.state.rootElements, (ele, i) =>
				<Parameter key={'root-'+ele.i+ele.field} field={ele.field} value={ele.value} type={ele.type} editable={this.props.editable} onSave={this.props.onEditFieldValue}/>
			)}
		</React.Fragment>)
	}
}

UserDetails.defaultProps = {
	data: {},
	editable: false,
	onChange: () => {},
	onEditFieldValue: () => {}
}

UserDetails.propTypes = {
	data: PropTypes.object.isRequired,
	editable:PropTypes.bool,
	onChange: PropTypes.func,
	onEditFieldValue: PropTypes.func
}

export default UserDetails

/******************************************************************************************/

class Parameter extends Component {
	constructor(props){
		super(props)
		this.state = {
			showEditorPanel: props.showEditor || false,
			field: props.field || props.label,
			type: props.type || '',
			value: props.value || '',
			dirty: false,
			disabled: !props.editable
		}
	}

	componentDidUpdate(prevProps, prevState){
		if(!_isEqual(prevState.field, this.state.field) || !_isEqual(prevState.value, this.state.value))
			this.setState({dirty: this.isDirty()})
	}

	toggleEditorPanel(e){
		e.preventDefault()
		this.setState({showEditorPanel: !this.state.showEditorPanel})
	}

	isDirty(){
		if(_isEqual(this.state.value, this.props.value))
			if(_isEqual(this.state.field, this.props.field))
				return false
		return true
	}

	closeEditorPanel(e){
		e.preventDefault()
		this.setState({showEditorPanel: false, dirty: this.isDirty()})
	}

	saveEdit(e){
		e.preventDefault()
		if(!this.state.dirty){
			toast.error('No changes detected')
			return null
		}

		this.props.onSave({
			prev: {
				field: this.props.field,
				type: this.props.type,
				value: this.props.value
			},
			field: this.state.field,
			type: this.state.type,
			value: this.state.value
		})
	}

	revertEdit(e){
		e.preventDefault()
		this.setState({
			field: this.props.field,
			type: this.props.type,
			value: this.props.value,
			dirty: false
		})
	}

	deleteRow(e){
		e.preventDefault()

	}

	handleOnChange(newObjValues){
		this.setState({...newObjValues})
	}

	collapsedPanel(){
		if(this.state.showEditorPanel) return null

		const isNumber = this.state.type === 'number'
		const formatValue = () => {
			switch(this.state.type){
				case 'boolean':
					return !this.state.value ? "false" : "true"
				case 'json':
				case 'array':
				case 'object':
					return JSON.stringify(this.state.value) || this.state.value.toString()
				default:
					return this.state.value
			}
		}

		return(
			<div>
				<Row onClick={e => this.toggleEditorPanel(e)} className={'mui--show collapsed-view'}>
					<Col md={3} className="mui--text-body2">
						{this.state.dirty && <i className={"fa fa-save mui--text-danger"} title={"Unsaved Changes"} /> }
						{this.state.field} {!this.state.field && <i className={"fa fa-exclamation-triangle mui--text-danger"} title={"Field is empty!"} />}
					</Col>
					<Col md={3} className="mui--text-body1 mui--text-dark-secondary">
						{this.state.dirty && <i className={"fa fa-save mui--text-danger"} title={"Unsaved Changes"} /> }
						{(!formatValue() && !isNumber) ? <i className={"fa fa-exclamation-triangle mui--text-danger"} title={"Value is empty!"} /> : _.truncate(formatValue(), 1000)}
					</Col>
				</Row>
				<Row><Col><Divider/></Col></Row>
			</div>
		)
	}
	editorPanel(){
		if(!this.state.showEditorPanel) return null
		return(
			<Row className={`mui--show editor-view`}>
				<Col md={9}>
					<UserKeyTypeValue {...this.state} onChange={(e) => this.handleOnChange(e)} onDelete={this.props.onDelete} />
				</Col>
				<Col md={3}>
					<Button size="small" onClick={(e) => this.closeEditorPanel(e)} color={'primary'}><i	className="fa fa-compress"/></Button>
					<Button size="small" onClick={(e) => this.saveEdit(e)} color={'primary'} variant={'raised'}><i	className="fa fa-save"/></Button>
					<Button size="small" onClick={(e) => this.revertEdit(e)} color={'accent'} variant={'flat'}><i className="fa fa-undo"/></Button>
					<Button size="small" onClick={(e) => this.deleteRow(e)} color={'danger'} variant={'flat'}><i	className="fa fa-trash"/></Button>
				</Col>
			</Row>
		)
	}

	render() {
		return (
			<React.Fragment>
				{this.collapsedPanel()}
				{this.editorPanel()}
			</React.Fragment>
		)
	}
}

Parameter.propTypes = {
	label: PropTypes.string,
	showEditor: PropTypes.bool,
	type: PropTypes.string,
	value: PropTypes.any,
	editable: PropTypes.bool,
	onDelete: PropTypes.func,
	onSave: PropTypes.func,
	onChange: PropTypes.func
}
