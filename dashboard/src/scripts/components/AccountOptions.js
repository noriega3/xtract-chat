import React, {Component} from 'react'

import {
	Link,
} from 'react-router-dom'

class AccountOptions extends Component{
	render(){
		return(
			<div>
				<div>
					<Link to="/myaccount/datarequest" className={"mui-btn mui-btn--large mui-btn--primary"}>Download Your Data</Link>
				</div>
				<div>
					<Link to="/myaccount" className={"mui-btn mui-btn--small mui-btn--accent mui-btn--flat"}>View Your Information</Link>
				</div>
				<div>
					<Link to="/myaccount/delete" className={"mui-btn mui-btn--small mui-btn--danger mui-btn--flat"}>Delete Your Account</Link>
				</div>
			</div>
		)
	}
}
export default AccountOptions
