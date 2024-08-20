// wrapper around SQL.js
class SQLDB {
    constructor(SQL) {
        this.SQL = SQL;
    }

    // runs the given SQL query and returns the result (QueryExecResult)
    query(sql) {
        return this.SQL.exec(sql);
    }

    // runs the given SQL query and returns the result as objects
    queryObjects(sql) {
        return this.resultToObjects(this.query(sql));
    }

    // inserts a single row to tableName
    // value is an object representing the key->val pairs to be inserted
    // returns the created item as object
    // returned object always has a property rowid (autoincrement)
    async insert(tableName, value) {
        // add field persisted = 0 to stored value, new values should have this
        // so that once persist is called, we know which values should be persisted
        if (!('persisted' in value)) {
            value = Object.assign({
                persisted: 0
            }, value);
        }

        // prepare and store to in-memory SQL DB
        const keys = Object.keys(value);
        const values = Object.values(value).map((val) => {
            if (typeof val === 'string') {
                return this.quoteEscape(val);
            }
            return val;
        });
        this.query(`INSERT INTO ${tableName}(${keys.join(', ')}) VALUES (${values.join(',')})`);

        // persist data
        if (value.persisted === 0) {
            await this.persist(tableName);
        }

        // return just stored item (persisted field left out)
        const item = this.queryObjects(`SELECT rowid, ${keys.join(', ')} FROM ${tableName} ORDER BY rowid DESC LIMIT 1`);
        return item[0];
    }

    // update given table name
    // set values to given value (object) for given rowid
    // returns true if a row is modified, false otherwise
    // it returns true as long as given rowid exists, even if all values remained the same
    async update(tableName, rowid, value) {
        const keys = Object.keys(value);
        const setItems = keys.map((key) => {
            if (key === 'rowid') {return null;}
            const val = this.quoteEscape(value[key]);
            return `${key} = ${val}`;
        }).filter((item) => {return item !== null;})
        this.SQL.run(`
        UPDATE ${tableName}
        SET
            ${setItems.join(',\n')}
        WHERE
            rowid = ${rowid}
        `);

        const updated = this.SQL.getRowsModified() > 0;

        if (updated) {
            // update in persistent storage too
            const db = new Dexie('localData');
            await db.open();
            await db.table(tableName).update(rowid, value);
        }
        
        return updated;
    }

    // given QueryExecResult, return array of objects
    // ignores all but the first item in QueryExecResult
    // as it is intended to be used for a single query results
    resultToObjects(result) {
        const resFirst = result[0];
        return resFirst.values.map((res) => {
            return res.reduce((prev, val, index) => {
                const colName = resFirst.columns[index];
                prev[colName] = val;
                return prev;
            }, {});
        });
    }

    // persist all not persisted values to indexedDB
    async persist(tableName) {
        const tableSchema = this.queryObjects(`PRAGMA table_info(${tableName});`);

        const db = new Dexie('localSchemas');
        db.version(2).stores({
            tables: `
            tableName,
            schema
            `
        });

        // store/update schema
        await db.table('tables').put({
            tableName,
            schema: tableSchema
        }, tableName);

        const nonPersisted = this.queryObjects(`SELECT rowid, * FROM ${tableName} WHERE persisted = 0`);

        if (nonPersisted.length > 0) {
            const db = new Dexie('localData');

            // use first non-persisted item to extract the table schema
            const schema = Object.keys(nonPersisted[0]);
    
            const stores = {}
            stores[tableName] = schema.join(',\n');
            db.version(2).stores(stores);

            await db[tableName].bulkPut(nonPersisted.map((nonPersistedItem) => {
                return {
                    ...nonPersistedItem,
                    persisted: 1
                }
            }));
        }
    }

    // load persisted data from indexedDB to in-memory SQL DB
    async load() {
        const databases = await Dexie.getDatabaseNames();
        
        if (! databases.includes('localSchemas')) {
            // no stored schemas found, stop here
            return;
        }

        // create tables and restore data
        const dbSchemas = new Dexie('localSchemas');
        await dbSchemas.open();
        const dbData = new Dexie('localData');
        await dbData.open();

        const schemaTables = dbSchemas._storeNames;
        const dataTables = dbData._storeNames;

        for (let i = 0; i < schemaTables.length; i++) {
            const tableName = schemaTables[i];
            const table = dbSchemas.table(tableName);
            table.each((tblIndexedDB) => {
                this.createTable(tblIndexedDB.tableName, tblIndexedDB.schema);

                if (dataTables.includes(tblIndexedDB.tableName)) {
                    // we have stored data for this table, restore it
                    dbData.table(tblIndexedDB.tableName).each((row) => {
                        this.insert(tblIndexedDB.tableName, row);
                    });
                }
            });
        }
    }

    // table only created if it does not already exist
    // fields is an array of objects [ { name, type }, ... ]
    createTable(tableName, fields) {
        if (fields.length === 0) {return;}
        // add field "persisted" INT
        fields.push({name: 'persisted', type: 'INT'});
        this.query(`CREATE TABLE IF NOT EXISTS ${tableName}(${fields.reduce((prev, curr) => {return `${prev}, ${curr.name} ${curr.type}`;}, '').substring(2)})`);
    }

    escape(str) {
        if (typeof str === 'string') {
            return str.replaceAll("'", '\\' + "'")
        }
        return str;
    }

    quoteEscape(str) {
        if (typeof str === 'string') {
            return `'${this.escape(str)}'`;
        }
        return str;
    }
}

// returns an instance of SQLDB
async function createSQLDB() {
    config = {
        locateFile: filename => `./assets/third-party/js/sql-wasm.wasm`
    }
    const SQL = await initSqlJs(config)
    
    return new SQLDB(new SQL.Database());
}