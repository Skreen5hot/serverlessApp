class RDF {

    graph = $rdf.graph(); // RDFjs graph

    constructor() {
        this.load();
    }

    // adds given triple to graph
    async tripleAdd(s, p, o, persistAfterAdd = true) {
        this.graph.add(
            this.createNode(s),
            this.createNode(p),
            this.createNode(o)
        );
        if (persistAfterAdd) {
            await this.persist();
        }
    }

    // string to node, returns either a sym or literal
    createNode(str) {
        return this.isURI(str) ? $rdf.sym(str) : $rdf.literal(str);
    }

    // returns an array triples [ [s, p, o], ...]
    triples(s, p, o) {
        const triples = [];
        const statements = this.graph.statementsMatching(
            typeof s === 'string' && s.trim().length > 0 ? this.createNode(s) : undefined,
            typeof p === 'string' && p.trim().length ? this.createNode(p) : undefined,
            typeof o === 'string' && o.trim().length ? this.createNode(o) : undefined
        );
        statements.forEach((statement) => {
            triples.push([
                statement.subject,
                statement.predicate,
                statement.object
            ]);
        });

        return triples;
    }

    async setObject(s, p, newO) {
        const sNode = typeof s === 'string' ? this.createNode(s) : undefined;
        const pNode = typeof p === 'string' ? this.createNode(p) : undefined;
        const statements = this.graph.statementsMatching(
            sNode,
            pNode,
            undefined
        );

        if (statements.length === 0) {
            throw new Error('Cant update object for given S+P, no triple found');
        }

        this.graph.removeMany(sNode, pNode);
        this.graph.add(sNode, pNode, this.createNode(newO));
        await this.persist();
    }

    isURI(str) {
        return str.indexOf('http') === 0;
    }

    async truncate() {
        const triples = this.triples();
        triples.forEach((triple) => {
            this.graph.removeMatches(
                triple.subject,
                triple.predicate,
                triple.object
            );
        });
        await this.persist();
    }

    // persist data to indexed DB
    async persist() {
        const db = new Dexie('rdf');
        db.version(2).stores({
            triples: 'id, s, p, o'
        });
        await db.open();
        // delete all triples previously stored
        const triplesTable = db.table('triples');
        await triplesTable.clear();

        const triples = this.triples().map((triple, id) => {
            return {
                id,
                s: triple[0].value,
                p: triple[1].value,
                o: triple[2].value
            }
        });

        await triplesTable.bulkAdd(triples);
    }

    async load() {
        const databases = await Dexie.getDatabaseNames();
        
        if (! databases.includes('rdf')) {
            // no stored rdf data, stop here
            return;
        }

        const db = new Dexie('rdf');
        await db.open();

        db.table('triples').each((triple) => {
            this.tripleAdd(triple.s, triple.p, triple.o, false);
        });
    }
}