//ssr
import React from 'react'
import ReactDOM from 'react-dom/server';
import { getDataFromTree } from "react-apollo"


const express = require('express');
// const path = require('path');
const graphqlHTTP = require('express-graphql');

const GraphQlSchema = require('./graphql/schema').schema

require('dotenv').config()

const app = express();

import { readFile } from 'fs'

import { ApolloProvider } from 'react-apollo';
import { ApolloClient } from 'apollo-client';
import fetch from 'node-fetch';
import { HttpLink } from 'apollo-link-http';
import { StaticRouter } from 'react-router';
import { InMemoryCache } from "apollo-cache-inmemory";


function formatError(error) {
	console.log("graphQl error : ", error.message)
	console.log("graphQl error stack: ", error.stack)
	return {
		message: error.message,
		locations: error.locations,
		stack: error.stack ? error.stack.split('\n') : [],
		path: error.path,
		zied: "oui"
	}
}

app.use(function (req, res, next) {
	console.log("requested : ", req.originalUrl)
	next();
})

app.use('/graphql', 
	function (err, req, res, next) {
		if (err.code === 'invalid_token') return next();
		return next(err);
	},
	graphqlHTTP((req, res, graphQLParams) => {
		// console.log('trying if request is authorized (user:', req.user)
		return {
			schema: GraphQlSchema,
			graphiql: true,
			formatError,
			context: {
				user: req.user,
				sessionID: req.sessionID
			}
		}
	}
	));

function logErrors(err, req, res, next) {
	console.error("Uncaught error : ", err.message, err.stack);
	next(err);
}

app.use(logErrors)
//ssr react
function Html({ content, state }) {
	return (
		<html>
			<body>
				<div id="root" class="pageRoot" dangerouslySetInnerHTML={{ __html: content }} />
				<script dangerouslySetInnerHTML={{
					__html: `window.__APOLLO_STATE__=${JSON.stringify(state).replace(/</g, '\\u003c')};`,
				}} />
			</body>
		</html>
	);
}

import { Query } from "react-apollo";
import gql from "graphql-tag";

app.use((req, res) => {
	console.log("getting ", req.originalUrl, " : ", req.url)
	const cache = new InMemoryCache()
	const client = new ApolloClient({
		ssrMode: true,
		// Remember that this is the interface the SSR server will use to connect to the
		// API server, so we need to ensure it isn't firewalled, etc
		link: new HttpLink({
			uri: 'http://localhost:4000/graphql',
			fetch,
		}),
		//resolvers: {},
		cache

	});

	console.log("current resolvers : ", client.getResolvers())

	const context = {};

	const SimpleDivs = () =>
		(<div>
			in simple cases
			<div>
				rendering is ok
			</div>
		</div>
		)



	const WithQuery = () => {
		const ALL_PEOPLE = gql`
		query AllPeople {
			people {
			  id
			  name
			}
		  }
		`
		console.log("with query....")
		return (
			<Query query={ALL_PEOPLE}>
				{({ loading, data: { people } }) =>
					loading
						? <p>Loading…</p>
						: (
							<ul>
								{people.map(person => <li key={person.id}>{person.name}</li>)}
							</ul>
						)
				}
			</Query>
		)
	}
	// The client-side App will instead use <BrowserRouter>
	const App = (
		<ApolloProvider client={client}>
			<StaticRouter location={req.url} context={context}>
				<WithQuery />
			</StaticRouter>
		</ApolloProvider>
	);

	console.log("### getDataFromTree ### to be called")
	// rendering code
	getDataFromTree(App).then(() => {
		// We are ready to render for real
		console.log("### getDataFromTree ### executed")
		const content = ReactDOM.renderToString(App);
		const initialState = client.extract();

		const html = <Html content={content} state={initialState} />;

		res.status(200);
		res.send(`<!doctype html>\n${ReactDOM.renderToStaticMarkup(html)}`);
		res.end();
	});
});

const port = process.env.PORT || 4000;
app.listen(port);