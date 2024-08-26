Serverless POC

Overview:
This is a serverless web application boilerplate application.
It has the following abilities:
- store/query data to/from an in-memory SQL database, which is persisted into indexedDB.
- store/query RDF triples, which are persisted into indexedDB
- basic P2P data exchange abilities (including the signaling server)
- run Python code (using Brython), in addition to entire Brython feature-set, it demonstrates how to access/process SQL/RDF data

Structure:
- index.html - contains DOM and loads required JS/Python external assets
- assets/js/app - main JS logic of your serverless app, holds instances of SQLDB (assets/js/db.js), RDF (assets/js/rdf.js) and P2P (assets/js/p2p.js). This is where you would place the app logic and event handlers. It allows you to easily create/read SQL/RDF data, and communicate with peers to exchange data
- assets/python/python.js - main Python logic of your serverless app, this is loaded by default, but you can include as many new python files here an include them in index.html. It demonstrates how to access data from SQL/RDF for further processing
- rtc_signaling - RTC signaling server in Node.js. It allows users to establish a peer-to-peer connction by exchanging SDP and ICE candidates between all connected peers. No user-data other than SDP/ICE candidates is ever sent to the signaling server.

Use cases:
This is meant to be used as a template to get you started with building serverless web applications which require persistent SQL/RDF storage, peer-to-peer data transfer, and executing Python code. If you need all or any of these, this boilerplate should get you started and save you time.

Getting started:
You would probably start by building out your DOM in index.html. Any external CSS could be stored to assets/css and included in page header.
Next step will probably be wiping out most of the code in assets/app.js, perhaps keeping only the "init" method. Bind your event listener is bindEvents method, where you can run any JS code, or if you prefer to use Python, you might want to handle events in assets/python/python.py.
Regardless which language you go with, you will at all times have easy access to SQL/RDF data storages. To see how data is accessed/created/processed, refer to current code in assets/js/app.js and assets/python/python.py.
You don't have to use app.js/python.py, you can even start by deleting both, and creating your own wrappers which can use any or all of assets/js/db.js, assets/js/rdf.js and/or assets/js/p2p.js. These three files contain all the functionality required to work with SQL/RDF data or establish peer-to-peer connections, simply create an instance of those you plan on using and call any of the methods that you need.

SQL:
Include assets/js/db.js, create an instance of SQLDB using createSQLDB helper function (which loads the required WASM binary and returns the instance for SQL DB manipulation).
eg: const sql = await createSQLDB();
Methods:
- query(sql: string): QueryExecResult - run SQL query and return QueryExecResult
- queryObjects(sql: string): Array<Record> - run SQL query and return results as array of objects
- createTable(table: string, fields: Array<{ name: string, type: 'INT' | 'TEXT' }>)
- insert(table: string, value: Record): Promise<Record> - insert a record into given table and return the created record as an object (promise), record will get a rowid which is the primary, auto-increment, key assigned to the Record by the DB
- update(table: string, rowid: number, value: Record) - update a DB row given table name/rowid and the new value (object). Value can include only the fields whose value needs to be updated, remaining fields remain unchanged
- persist(table: string): Promise<void> - persist given table to indexedDB
- load(): Promise<void> - load all persisted tables and data from indexedDB into in-memory SQL database
- escape(str: string): string - escape given string (escaping single quote chars)
- quoteEscape(str: string): string - escape given string and put single quotes around it

RDF:
Include assets/js/rdf.js and create instance of RDF.
Methods:
- tripleAdd(s: string, p: string, o: string, persistAfterAdd: boolean = true): Promise<void> - adds given statement to graph and persists the RDF data if persistAfterAdd = true
- triples(s: string|undefined, p: string|undefined, o: string|undefined): Array<Array<s: string, p: string, o: string>> - return all triples matching given filters, if no filters are given (s, p, and o are all undefined) it returns all triples.
- setObject(s: string, p: string, o: string): Promise<void> - set new object for given s+p and persit data
- persist(): Promise<void> - persist all data to indexedDB
- load(): Promise<void> - load all data from indexedDB

P2P:
Include assets/js/p2p.js and create instance of P2P.
Properties:
- signalingServerURL: string - URL of the signaling server
- userId - randomly generated user id, if you have user authentication in your app, it would be a good idea to set this to actual user id after creating an instance of P2P
Methods:
- createOffer(): Promise<RTCSessionDescriptionInit> - creates the offer to initialize RTC P2P connection
- acceptOffer(offer: string): Promise<RTCSessionDescriptionInit> - offer is a string containing the offer SDP,accepts given offer from remote peer and returns answer (RTCSessionDescriptionInit)
- acceptAnswer(answer: string): Promise<void> - answer is a string - SDP returned by acceptOffer, used by initiating peer to confirm the accepted answer
- send(msg: string | object): void - sends given data to connected remote peers. Data can be given as string in which case it's sent as such, or as an object in which case it's JSON-encoded and sent as JSON string ( and needs to be decoded on remote end if you need to have it as object)

RTC signaling server:
Installation:
cd rtc_ignaling
npm install

Configuration:
The only configuration needed is the port number, if you wish to use a port number other than the default port (3888), edit rtc_signaling/signalling.js line 1, changing the PORT constant to a port number you want to use.

Running:
node rtc_signaling/signalling.js

If it started successfully, you should see "listening on [PORT]".
Make sure to update signalingServerURL to your server URL:[PORT] on the P2P instance(s).