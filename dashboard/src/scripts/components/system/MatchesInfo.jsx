import React, {Component, Fragment} from 'react'
import _ from 'lodash'

import MatchDetails from "../../components/matches/matchDetails.jsx"
import MatchList from "../../components/matches/matchList.jsx"

import Panel from 'muicss/lib/react/panel'
import Container from 'muicss/lib/react/container'
import Col from 'muicss/lib/react/col'

class MatchesInfo extends Component{
	constructor(props){
		super(props)

		this.state = {
			matchSelected: false
		}
		this.handleGetMatchDetails = this.handleGetMatchDetails.bind(this)
	}
	componentDidMount(){
		console.log(this.props)
		this.handleGetMatchDetails()
	}
	handleGetMatchDetails(matchSelected) {
		this.setState({matchSelected})
		this.props.sendMessageIntent('matchdetails', {roomName: matchSelected})
	}
	render(){
		const {matches, matchSelected, matchDetails} = this.props.socket
		return(<Fragment>
			<Container fluid={true}>
				<Col md={4}>

					<div className="mui--text-subhead">Select a Room</div>
					<MatchList data={matches} selected={matchSelected}  onSelect={this.handleGetMatchDetails}/>
				</Col>
				<Col md={8}>
					<div className="mui--text-subhead">Match Details</div>
					<MatchDetails key={matchSelected} roomName={matchSelected} details={matchDetails}/>
				</Col>
			</Container>
		</Fragment>)
	}
}

export default MatchesInfo
