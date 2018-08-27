import PropTypes from 'prop-types'
import React, { Component } from 'react'
import { connect } from 'react-redux'
import Divider from 'muicss/lib/react/divider'

import _ from 'lodash'
import _isEqual from 'lodash/isEqual'
import Panel	from 'muicss/lib/react/panel'
import Button	from 'muicss/lib/react/button'
import Col from 'muicss/lib/react/col'
import Row from 'muicss/lib/react/row'

import UserKeyTypeValue from '../templates/UserKeyTypeValue'
import {toast} from 'react-toastify'
import {formatValue, formatValuePreview} from '../../utils'

class Parameter extends Component {
	constructor(props){
		super(props)
		this.state = {
			showEditorPanel: props.showEditor || props.editMode || false,
			field: props.field,
			type: props.type,
			value: props.value,
			disabled: !props.editable,
			editable: props.editable
		}
		this.state.dirty = this.isDirty(props)
	}

	componentDidUpdate(prevProps, prevState){
		if(!_isEqual(prevState.field, this.state.field) || !_isEqual(prevState.value, this.state.value) || !_isEqual(prevState.type, this.state.type))
			this.setState({dirty: this.isDirty()})
		else if(this.state.dirty && _isEqual(this.isDirty(), false) )
			this.setState({dirty: false})
	}

	toggleEditorPanel(e){
		e.preventDefault()
		this.setState({showEditorPanel: !this.state.showEditorPanel})
	}

	isDirty(){
		if(_isEqual(this.state.value, this.props.value))
			if(_isEqual(this.state.type, this.props.type))
				if(_isEqual(this.state.field, this.props.field))
					return false
		return true
	}

	closeEditorPanel(e){
		_.has(e, 'preventDefault') && e.preventDefault()
		if(!this.props.root && this.state.dirty){
			this.saveEdit()
		}
		this.setState({showEditorPanel: false})
	}

	saveEdit(e){
		_.has(e, 'preventDefault') && e.preventDefault()
		if(!this.state.dirty){
			toast.error('No changes detected')
			return null
		}

		this.props.onSave({
			index: this.props.index,
			prev: {
				field: this.props.field,
				type: this.props.type,
				value: this.props.value
			},
			field: this.state.field,
			type: this.state.type,
			value: formatValue({type: this.state.type, value: this.state.value})
		})
		this.setState({showEditorPanel: false})
	}

	revertEdit(e){
		e.preventDefault()
		this.setState({
			index: this.props.index,
			field: this.props.field,
			type: this.props.type,
			value: this.props.value,
			dirty: false,
			showEditorPanel: false
		})
	}

	deleteRow(e){
		e.preventDefault()
		this.props.onDelete({
			index: this.props.index,
			field: this.state.field,
			type: this.state.type,
			value: this.state.value
		})
	}

	handleOnChange(newObjValues){
		console.log('param change', newObjValues)
		this.setState({...newObjValues})
	}

	collapsedPanel(){
		if(this.state.showEditorPanel) return null

		const isNumber = this.state.type === 'number' || this.state.type === 'userId'
		return(
			<div>
				<Row onClick={e => this.toggleEditorPanel(e)} className={'mui--show collapsed-view'}>
					<Col md={6} className="mui--text-body2">
						{this.state.dirty && <i className={"fa fa-save mui--text-danger"} title={"Unsaved Changes"} /> }
						{this.state.field} {!this.state.field && <i className={"fa fa-exclamation-triangle mui--text-danger"} title={"Field is empty!"} />}
					</Col>
					<Col md={6} className="mui--text-body1 mui--text-dark-secondary">
						{this.state.dirty && <i className={"fa fa-save mui--text-danger"} title={"Unsaved Changes"} /> }
						{(!formatValue(this.state) && !isNumber) ? <i className={"fa fa-exclamation-triangle mui--text-danger"} title={"Value is empty!"} /> : formatValuePreview(this.state)}
					</Col>
				</Row>
				<Row><Col><Divider/></Col></Row>
			</div>
		)
	}

	editorPanel(){
		if(!this.state.showEditorPanel) return null
		const buttonCollapse = () => !this.props.isNew ? <Button size="small" onClick={(e) => this.closeEditorPanel(e)} color={'primary'}><i	className="fa fa-compress"/></Button> : null
		const buttonSave = () => this.props.editable && this.props.onSave ? <Button size="small" onClick={(e) => this.saveEdit(e)} color={'primary'} variant={'raised'} disabled={!this.state.dirty}><i	className="fa fa-save"/></Button> : null
		const buttonDelete = () => this.props.editable && this.props.onDelete ? <Button size="small" onClick={(e) => this.deleteRow(e)} color={'danger'} variant={'flat'}><i className="fa fa-trash"/></Button> : null
		const buttonRevert = () => !this.props.isNew && this.props.editable ? <Button size="small" onClick={(e) => this.revertEdit(e)} color={'accent'} variant={'flat'} disabled={!this.state.dirty}><i className="fa fa-undo"/></Button> : null

		return(
			<Row className={`mui--show editor-view user-parameter mui-panel`}>
				<Col md={11}>
					{this.state.dirty && <i className={"fa fa-save mui--text-danger"} title={"Unsaved Changes"} /> }
					<UserKeyTypeValue {...this.state}
						onChange={(e) => this.handleOnChange(e)}
						onDelete={this.props.onDelete}
					/>
				</Col>
				<Col md={1}>
					<div>
						<span className={"mui--pull-right"}>{buttonCollapse()}</span>
						<span className={"mui--pull-right"}>{buttonSave()}</span>
						<span className={"mui--pull-right"}>{buttonRevert()}</span>
						<span className={"mui--pull-right"}>{buttonDelete()}</span>
						<div className="mui--clearfix" />
					</div>
				</Col>
			</Row>
		)
	}

	render() {
		return (
			<div>
				{this.collapsedPanel.bind(this)()}
				{this.editorPanel.bind(this)()}
			</div>
		);
	}
}
Parameter.defaultProps = {
	root: false,
	editable: false,
}
Parameter.propTypes = {
	index: PropTypes.any,
	parentField: PropTypes.string,
	field: PropTypes.string,
	type: PropTypes.string,
	value: PropTypes.any,

	label: PropTypes.string,
	editMode: PropTypes.bool,
	isNew: PropTypes.bool,
	showEditor: PropTypes.bool,
	editable: PropTypes.bool,
	root: PropTypes.bool,

	onDelete: PropTypes.func,
	onSave: PropTypes.func,
	onChange: PropTypes.func
}
export default Parameter
