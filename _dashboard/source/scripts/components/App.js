import React from 'react'
import Rooms from '../pages/Rooms'
import Server from '../pages/Server'
import Users from '../pages/Users'
import NotFound from '../pages/NotFound'
import Appbar from 'muicss/lib/react/appbar';
import Button from 'muicss/lib/react/button';
import Container from 'muicss/lib/react/container';

import {
	BrowserRouter as Router,
	browserHistory,
	Route,
	Link,
	Switch,
	Redirect
} from 'react-router-dom'

const s1 = {
	verticalAlign: 'middle'
}
const s2 = {
	textAlign: 'right'
}

const App = () => (
	<Router>
		<div>
			<Appbar className={"mui--z1"}>
				<Container>
					<table width="100%">
						<tbody style={s1}>
							<tr className="mui--appbar-height">
								<td className="mui--text-title">{'v2 Dashboard'}</td>
								<td className="mui--text-right">
									<ul className="mui-list--inline mui--text-body2">
										<li><Link to ="/">Users</Link></li>
										<li><Link to ="/rooms">Rooms</Link></li>
										<li><Link to ="/server">Server</Link></li>
									</ul>

								</td>
							</tr>
						</tbody>
					</table>
				</Container>
			</Appbar>
			<Container>
				<Switch>
					<Route path="/server" component={Server}/>
					<Route path="/rooms" component={Rooms}/>
					<Route exact path="/" component={Users}/>
					<Route path="*" component={NotFound} status={404}/>
				</Switch>
			</Container>
		</div>
	</Router>
)

export default App
