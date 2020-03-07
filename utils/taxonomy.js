import React from 'react'
import handleWait, { LoadingInline } from '../components/Handlers'

export const EFFECTS = [
  'Effect.Armor',
  'Effect.Melee',
  'Effect.Ranged',
  'Effect.Weapon'
]
const ITEMS = ['ItemDb.WEAP', 'ItemDb.ARMO']
// 'Effect.Armor',
// 'Effect.Weapon.Melee',
// 'Effect.Weapon.Ranged',
// 'Item.Armor.RA',
// 'Item.Armor.LA',
// 'Item.Armor.RL',
// 'Item.Armor.LL',
// 'Item.Armor.CH',
// 'Item.Weapon.Melee',
// 'Item.Weapon.Ranged',
// 'ItemAttrib.Armor.Position'

// silly how this has to be constructed, but...
//
// const { wait, taxonomy } = tQuery(useQuery(LOAD_ALL_TAXONOMY, tArgs(context)), context)
//
export function itemArgs(context) {
  return {
    variables: {
      systemId: context.gameSystem.id,
      branches: ITEMS,
      nodeIs: ['LC']
    },
    skip: !context.gameSystem.id
  }
}
export function effectArgs(context) {
  return {
    variables: {
      systemId: context.gameSystem.id,
      branches: EFFECTS
    },
    skip: !context.gameSystem.id
  }
}

export function loadTaxonomy(itemQuery, effectsQuery, context) {
  let wait = handleWait({ loading: itemQuery.loading, error: itemQuery.error })
  if (wait) return { wait }

  wait = handleWait({
    loading: effectsQuery.loading,
    error: effectsQuery.error
  })
  if (wait) return { wait }

  if (!itemQuery.data || !effectsQuery.data) {
    return { wait: <LoadingInline /> }
  }
  return {
    taxonomy: denormalizeTaxonomy(
      itemQuery.data.gameTaxonomyNodes.concat(
        effectsQuery.data.gameTaxonomyNodes
      ),
      context
    )
  }
}

////////////////////////////////////////////////////////////////////////////////
// NEXT: introduce filters based on info we have - remove options that don't work
function denormalizeTaxonomy(normal, context) {
  // const locale = context.locale || 'en-us'
  let tree = normal.reduce((acc, item) => processTaxonomyRow(item, acc), {})
  const sortedNodes = keyMap =>
    Object.keys(keyMap).reduce(
      (acc, key) => orderTaxonomyKeys(key, keyMap, acc),
      {}
    )
  const optCompare = (a, b) => {
    return a.cmp.localeCompare(b.cmp, 'en', {
      sensitivity: 'base',
      numeric: 'true'
    })
  }

  const ordered = sortedNodes(tree)
  ordered['ALL_ITEMS'] = ITEMS.reduce((acc, branch) => {
    Object.keys(tree[branch]).forEach(key => {
      // a little enrichment
      tree[branch][key].meta.is[branch] = true
      tree[branch][key].type = branch
      acc.push(tree[branch][key])
    })
    return acc
  }, []).sort(optCompare)

  let all = {}
  // this creates a subtree for each effect, slice by 'primary' and 'secondary'
  // and it also expands the 'all' dictionary for duplicates in different branches
  const effectTree = EFFECTS.reduce((acc, branch) => {
    const types = { primary: {}, other: {}, pos: {} }
    acc[branch] = types
    Object.keys(tree[branch]).forEach((key, index) => {
      splitEffect(branch, key, tree, types)
      if (!all[key]) {
        all[key] = {}
      }
      all[key][branch] = tree[branch][key]
    })
    return acc
  }, {})
  const effectOrdered = Object.keys(effectTree).reduce((acc, key) => {
    acc[key] = sortedNodes(effectTree[key])
    return acc
  }, {})

  // this merges them together into a unified list by key, but collides dups
  const mergedSorted = slice => {
    // merge keys into one list
    let merged = EFFECTS.reduce((accum, branch) => {
      // smashes them together, removing dups
      Object.assign(accum, effectTree[branch][slice])

      // and to help keep dups, identify which are
      return accum
    }, {})
    return Object.keys(merged)
      .reduce((accum, key) => {
        accum.push(merged[key])
        return accum
      }, [])
      .sort(optCompare)
  }
  effectOrdered['primary'] = mergedSorted('primary')
  effectOrdered['other'] = mergedSorted('other')
  effectOrdered['all'] = all

  return { tree, ordered, effects: effectOrdered }
}

////////////////////////////////////////////////////////////////////////////////
function processTaxonomyRow(row, tree) {
  const { branch, key, meta, ...more } = row
  if (!tree[branch]) {
    tree[branch] = {}
  }
  if (meta.name && meta.name.length > 0) {
    tree[branch][meta.name] = {
      value: key,
      label: meta.name,
      aliased: key,
      meta,
      cmp: meta.name.toLowerCase(),
      branch: branch,
      ...more
    }
  } else {
    tree[branch][key] = {
      value: key,
      label: key,
      meta,
      cmp: key.toLowerCase(),
      ...more
    }
  }
  if (
    meta.text &&
    meta.text.length > 0 &&
    meta.text !== meta.name &&
    meta.position > 1 // include infotext on all but prefix's
  ) {
    tree[branch][meta.text] = {
      value: key,
      label: meta.text,
      aliased: key,
      meta,
      cmp: meta.text.toLowerCase(),
      branch: branch,
      ...more
    }
  }
  return tree
}

////////////////////////////////////////////////////////////////////////////////
function orderTaxonomyKeys(key, tree, acc) {
  // if (key === 'pos') {
  //   return acc
  // }
  acc[key] = Object.keys(tree[key])
    .map(subkey => tree[key][subkey])
    .sort((a, b) => {
      return a.label.localeCompare(b.label, 'en', {
        sensitivity: 'base',
        numeric: 'true'
      })
    })
  return acc
}

////////////////////////////////////////////////////////////////////////////////
function splitEffect(branch, key, tree, types) {
  const node = tree[branch][key]
  if (node.meta.position) {
    const position = node.meta.position
    /*
    if (!types.pos[position]) {
      types.pos[position] = {}
    }
    types.pos[position][key] = node
    */
    if (position === 1) {
      types.primary[key] = node
    } else {
      types.other[key] = node
    }
  } else {
    console.log('Skipping effect with no legendary position!', node)
  }
}
