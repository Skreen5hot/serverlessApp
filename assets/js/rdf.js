class RDF {

    graph = $rdf.graph(); // RDFjs graph

    // adds given triple to graph
    tripleAdd(s, p, o) {
        this.graph.add(
            this.createNode(s),
            this.createNode(p),
            this.createNode(o)
        )
    }

    // createSubject(s) {
    //     const node = this.createNode(s);
    //     const existing = this.graph.statementsMatching(node, undefined, undefined);
    //     if (existing.length > 0) {
    //         return existing[0].subject;
    //     }
    //     return node;
    // }

    // createPredicate(p) {
    //     const node = this.createNode(p);
    //     const existing = this.graph.statementsMatching(undefined, node, undefined);
    //     if (existing.length > 0) {
    //         return existing[0].predicate;
    //     }
    //     return node;
    // }

    // string to node, returns either a sym or literal
    createNode(str) {
        return this.isURI(str) ? $rdf.sym(str) : $rdf.literal(str);
    }

    // returns an array triples [ [s, p, o], ...]
    triples(s, p, o) {
        const triples = [];
        const statements = this.graph.statementsMatching(
            typeof s === 'string' ? this.createNode(s) : undefined,
            typeof p === 'string' ? this.createNode(p) : undefined,
            typeof o === 'string' ? this.createNode(o) : undefined
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

    isURI(str) {
        return str.indexOf('http') === 0;
    }
}