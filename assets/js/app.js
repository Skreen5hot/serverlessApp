class App {
    async init() {
        // create an instance of SQLDB, which is a wrapper around SQL.js
        this.DB = await createSQLDB();

        // crete SQL table storedValues
        this.DB.query(`CREATE TABLE storedValues(value text);`);

        // bind UI events
        this.bindEvenets();
    }

    // add an item to in-memory SQL DB
    SQLCreateItem(value) {
        return this.DB.insert('storedValues', {
            value
        });
    }

    SQLItems() {
        return this.DB.queryObjects('SELECT rowid, * FROM storedValues');
    }

    bindEvenets() {
        // store to SQL DB
        const SQLCreateBtn = document.querySelector('#sql-create');
        const SQLCreateValue = document.querySelector('#sql-value');
        const SQLCreateNotify = document.querySelector('#sql-create-notify');
        const SQLReadBtn = document.querySelector('#sql-read');
        const SQLResults = document.querySelector('#sql-results');
        SQLCreateBtn.addEventListener('click', () => {
            const item = this.SQLCreateItem(SQLCreateValue.value);
            SQLCreateValue.value = '';
            SQLCreateNotify.textContent = `Created item, item id ${item.rowid}`;
            setTimeout(() => {
                SQLCreateNotify.textContent = '';
            }, 2000);
        });

        // read SQL DB
        SQLReadBtn.addEventListener('click', () => {
            const items = this.SQLItems();
            SQLResults.innerHTML = '';
            items.forEach((item) => {
                const itemElement = document.createElement('div');
                itemElement.textContent = item.rowid + ', ' + item.value;
                SQLResults.appendChild(itemElement);
            });
        });
    }
}

const app = new App();

app.init();