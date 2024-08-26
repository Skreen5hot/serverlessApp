from browser import document, window, console

def sql(ev):
    # access the SQL DB from python using global window.app (defined in JS)
    # any data processing can be done from here
    items = window.app.SQLItems()
    for item in items:
        console.log(item["value"].upper())

def rdf(ev):
    # access the RDF graph from python using global window.app (defined in JS)
    # any data processing can be done from here
    items = window.app.RDF.triples()
    for triple in items:
        s = triple[0].value
        p = triple[1].value
        o = triple[2].value
        stringFormat = "s: %s, p: %s, o: %s" % (s, p, o)
        console.log(stringFormat)

def rdf_query(ev):
    # query RDF graph from python
    s = document["subject"].value
    p = document["predicate"].value
    o = document["object"].value
    items = window.app.RDF.triples(s, p, o)
    for triple in items:
        s = triple[0].value
        p = triple[1].value
        o = triple[2].value
        stringFormat = "s: %s, p: %s, o: %s" % (s, p, o)
        console.log(stringFormat)

document["python_sql"].bind("click", sql)
document["python_rdf"].bind("click", rdf)
document["python_rdf_query"].bind("click", rdf_query)