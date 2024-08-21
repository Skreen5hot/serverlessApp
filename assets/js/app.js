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
    async SQLCreateItem(value) {
        return await this.DB.insert('storedValues', {
            value
        });
    }

    async SQLUpdateItem(rowid, value) {
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
        const p2pAccept = document.querySelector('#p2p-accept');
        const p2psdp = document.querySelector('#p2p-sdp');
        const p2pControls = document.querySelector('#p2p-controls');
        const p2pTest = document.querySelector('#p2p-test');

        // init peer connection
        p2pInit.addEventListener('click', async () => {
            p2pInit.disabled = true;
            try {
                const offer = await p2p.createOffer();
                p2psdp.textContent = offer.sdp;
                // copy sdp to clipboard
                await this.copyToClipboard(offer.sdp);
                alert('Offer SDP copied to clipboard');
                const answerSDPInput = document.createElement('textarea');
                answerSDPInput.placeholder = 'Enter answer SDP';
                answerSDPInput.addEventListener('input', async () => {
                    await p2p.acceptAnswer(answerSDPInput.value);
                    p2pControls.removeChild(answerSDPInput);
                });
                p2pControls.appendChild(answerSDPInput);
            } catch (e) {
                alert(e);
            }
        });

        // accept peer connection
        p2pAccept.addEventListener('click', async () => {
            const answerSDPInput = document.createElement('textarea');
            answerSDPInput.placeholder = 'Enter SDP';
            answerSDPInput.addEventListener('input', async () => {
                const answer = await p2p.acceptOffer(answerSDPInput.value);
                p2psdp.textContent = answer.sdp;
                await this.copyToClipboard(answer.sdp);
                alert('Answer SDP copied to clipboard');
                p2pControls.removeChild(answerSDPInput);
            });
            p2pControls.appendChild(answerSDPInput);
        });

        p2pTest.addEventListener('click', () => {
            p2p.send('hello!');
        });


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