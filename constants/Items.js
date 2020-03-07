import gql from 'graphql-tag'

export const GAME_ITEM_TYPE_SEARCH = gql`
  query gameItemTypeSearch(
    $systemId: String!
    $branches: [String!]
    $keyMatching: String!
    $limit: Int
  ) {
    gameTaxonomyNodes(
      systemId: $systemId
      branches: $branches
      keyMatching: $keyMatching
      limit: $limit
    ) {
      id
      branch
      key
      meta
    }
  }
`
const gameItemVals = `
      id
      label
      meta
      characterId
      taxonomyId
      taxonomy {
        id
        branch
        key
        meta
      }
      tradeId
      trade {
        id
        closedAt
      }
`
export const GAME_ITEM_INV_SEARCH = gql`
  query gameItemInventory(
    $characters: [String!]
    $branches: [String!]
    $matching: String
  ) {
    gameItemInventory(
      characters: $characters
      branches: $branches
      matching: $matching
    ) {
      ${gameItemVals}
    }
  }
`

export const UPSERT_GAME_ITEM_INVENTORY = gql`
  mutation upsertGameItemInventory(
    $id: String
    $characterId: String
    $taxonomyId: String
    $label: String
    $unique: Boolean
    $effects: String
    $meta: String
  ) {
    upsertGameItemInventory(
      id: $id
      characterId: $characterId
      taxonomyId: $taxonomyId
      label: $label
      unique: $unique
      effects: $effects
      meta: $meta
    ) {
      ${gameItemVals}
    }
  }
`

export const DELETE_GAME_ITEM_INVENTORY = gql`
  mutation deleteGameItemInventory($id: String!) {
    deleteGameItemInventory(id: $id) {
      success
      reason
    }
  }
`

export const MOVE_GAME_ITEM_INVENTORY = gql`
  mutation moveGameItemInventory($recipientId: String!, $itemIds: [String!]) {
    moveGameItemInventory(recipientId: $recipientId, itemIds: $itemIds) {
      moved
      failed
    }
  }
`
