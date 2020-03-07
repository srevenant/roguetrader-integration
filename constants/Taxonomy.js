import gql from 'graphql-tag'

export const LOAD_TAXONOMY_NODES_HAS = gql`
  query gameTaxonomyNodes(
    $systemId: String!
    $branches: [String!]
    $nodeIs: [String!]
  ) {
    gameTaxonomyNodes(
      systemId: $systemId
      branches: $branches
      nodeIs: $nodeIs
    ) {
      id
      branch
      key
      meta
      gameId
    }
  }
`

export const LOAD_TAXONOMY_NODES = gql`
  query gameTaxonomyNodes($systemId: String!, $branches: [String!]) {
    gameTaxonomyNodes(systemId: $systemId, branches: $branches) {
      id
      branch
      key
      meta
      gameId
    }
  }
`
