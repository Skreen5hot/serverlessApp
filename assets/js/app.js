class App {
    async init() {
        // create an instance of SQLDB, which is a wrapper around SQL.js
        this.DB = await createSQLDB();

        await this.DB.load();

        // crete SQL table storedValues
        this.DB.createTable('storedValues', [
            {name: 'value', type: 'TEXT'}
        ]);

        // bind UI events
        this.bindEvenets();
    }

    // add an item to in-memory SQL DB
    async SQLCreateItem(value, notifyPeers = true) {
        if (notifyPeers) {
            // notify connected peers
            p2p.send({
                action: 'SQLCreate',
                value
            });
        }
        
        return await this.DB.insert('storedValues', {
            value
        });
    }

    async SQLUpdateItem(rowid, value, notifyPeers = true) {
        if (notifyPeers) {
            // notify connected peers
            p2p.send({
                action: 'SQLUpdate',
                rowid,
                value
            });
        }
                
        return this.DB.update('storedValues', rowid, {value});
    }

    SQLItems() {
        return this.DB.queryObjects('SELECT rowid, * FROM storedValues');
    }

    async copyToClipboard(text) {
        const type = 'text/plain';
        const blob = new Blob([text], { type });
        const data = [new ClipboardItem({ [type]: blob })];
        await navigator.clipboard.write(data);
    }

    bindEvenets() {

        // P2P
        const p2pInit = document.querySelector('#p2p-init');
        const p2pTest = document.querySelector('#p2p-test');

        // init peer connection
        p2pInit.addEventListener('click', () => {
            p2pInit.disabled = true;
            p2p.createOffer();
        });

        p2pTest.addEventListener('click', () => {
            p2p.send('hello!');
        });

        // received a message/action from peer, execute action
        p2p.onmessage = (msg) => {
            if (msg.action === 'SQLCreate') {
                this.SQLCreateItem(msg.value, false);
            } else if (msg.action === 'SQLUpdate') {
                this.SQLUpdateItem(msg.rowid, msg.value, false);
            } else {
                console.log('unrecognized p2p message', msg);
            }
        }

        // SQL-related

        // store to SQL DB
        const SQLCreateBtn = document.querySelector('#sql-create');
        const SQLCreateValue = document.querySelector('#sql-value');
        const SQLCreateNotify = document.querySelector('#sql-create-notify');
        const SQLReadBtn = document.querySelector('#sql-read');
        const SQLResults = document.querySelector('#sql-results');
        const SQLEditID = document.querySelector('#sql-edit-id');
        const SQLEditValue = document.querySelector('#sql-edit-value');
        const SQLEditButton = document.querySelector('#sql-edit-button');
        const SQLEditNotify = document.querySelector('#sql-edit-notify');
        SQLCreateBtn.addEventListener('click', async () => {
            const item = await this.SQLCreateItem(SQLCreateValue.value);
            SQLCreateValue.value = '';
            SQLCreateNotify.textContent = `Created item, item id ${item.rowid}`;
            setTimeout(() => {
                SQLCreateNotify.textContent = '';
            }, 1500);
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

        // update SQL row
        SQLEditButton.addEventListener('click', async () => {
            if (await this.SQLUpdateItem(parseInt(SQLEditID.value), SQLEditValue.value)) {
                SQLEditNotify.textContent = 'Row updated';
            } else {
                SQLEditNotify.textContent = 'No rows updated';
            }
            setTimeout(() => {
                SQLEditNotify.textContent = '';
            }, 1500);
        });
    }
}

const app = new App();

app.init();