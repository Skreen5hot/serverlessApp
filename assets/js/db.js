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
    insert(tableName, value) {
        const keys = Object.keys(value);
        const values = Object.values(value).map((val) => {
            if (typeof val === 'string') {
                return `'${val}'`;
            }
            return val;
        });
        this.query(`INSERT INTO ${tableName}(${keys.join(', ')}) VALUES (${values.join(',')})`);
        const item = this.queryObjects(`SELECT rowid, ${keys.join(', ')} FROM ${tableName} ORDER BY rowid DESC LIMIT 1`);
        return item[0];
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
}

// returns an instance of SQLDB
async function createSQLDB() {
    config = {
        locateFile: filename => `./assets/third-party/js/sql-wasm.wasm`
    }
    const SQL = await initSqlJs(config)
    
    return new SQLDB(new SQL.Database());
}