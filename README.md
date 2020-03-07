# importer code

This repo containts the relevant bits of the roguetrader.com data importer.

Files:

* components/LocalImport.jsx -- the main component for the UI, which brings in other bits
* utils/taxonomy.js -- a utility library that denormalizes the taxonomy data into memory structures
* constants/Taxonomy.js -- the GraphQL documents for the queries used with taxonomy
* constants/Items.js -- the GraphQL documents for item queries
* validation.js -- code which uses an authentication validation to generate access keys
