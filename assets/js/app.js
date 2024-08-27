class App {
    async init() {
        // create an instance of SQLDB, which is a wrapper around SQL.js
        this.DB = await createSQLDB();
        this.RDF = new RDF();

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

    async RDFAdd(s, p, o) {
        await this.RDF.tripleAdd(s, p, o);
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

        // init peer connection
        p2pInit.addEventListener('click', () => {
            p2pInit.disabled = true;
            p2p.createOffer();
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
        const SQLImportFile = document.querySelector('#sql-import');
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

        SQLImportFile.addEventListener('change', async () => {
            const data = await CSV.fetch({
                file: SQLImportFile.files[0]
            });
            if ('records' in data) {
                data.records.forEach((row) => {
                    this.SQLCreateItem(row[0]);
                });
            }
        });

        // RDF
        const rdfSubject = document.querySelector('#subject');
        const rdfPredicate = document.querySelector('#predicate');
        const rdfObject = document.querySelector('#object');
        const rdfSubjectEdit = document.querySelector('#edit-subject');
        const rdfPredicateEdit = document.querySelector('#edit-predicate');
        const rdfObjectEdit = document.querySelector('#edit-object');
        const rdfAdd = document.querySelector('#rdf-create');
        const rdfRead = document.querySelector('#rdf-read');
        const rdfResults = document.querySelector('#rdf-results');
        const rdfEdit = document.querySelector('#rdf-edit');

        rdfAdd.addEventListener('click', () => {
            const s = rdfSubject.value;
            const p = rdfPredicate.value;
            const o = rdfObject.value;
            this.RDFAdd(s, p, o);
        });

        rdfRead.addEventListener('click', () => {

            const s = rdfSubject.value.trim();
            const p = rdfPredicate.value.trim();
            const o = rdfObject.value.trim();

            rdfResults.innerHTML = `<tr>
                <th>Subject</th>
                <th>Predicate</th>
                <th>Object</th>
            </tr>`;
            const triples = this.RDF.triples(
                s.length > 0 ? s : undefined,
                p.length > 0 ? p : undefined,
                o.length > 0 ? o : undefined
            );
            triples.forEach((triple) => {
                const row = document.createElement('tr');
                for (let i = 0; i < 3; i++) {
                    const cell = document.createElement('td');
                    cell.textContent = triple[i].value;
                    row.appendChild(cell);
                }
                rdfResults.appendChild(row);
            });
        });

        rdfEdit.addEventListener('click', () => {
            const s = rdfSubjectEdit.value.trim();
            const p = rdfPredicateEdit.value.trim();
            const o = rdfObjectEdit.value.trim();
            if (s.length > 0 && p.length > 0) {
                this.RDF.setObject(s, p, o);
            }
        });
    }
}

window.app = new App();
window.app.init();