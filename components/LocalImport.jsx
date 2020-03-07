import React, { useState } from 'react'
import CSVReader from 'react-csv-reader'
import style from './index.module.scss'
import { loadTaxonomy, itemArgs, effectArgs } from '../../utils/taxonomy'
import { useQuery } from 'react-apollo'
import Scrollbar from '../Scrollbar'
import {
  LOAD_TAXONOMY_NODES,
  LOAD_TAXONOMY_NODES_HAS
} from '../../constants/Taxonomy'
import { UPSERT_GAME_ITEM_INVENTORY } from '../../constants/Items'
import CharacterMenu from '../CharacterMenu'
import { MessageLog, addLog } from '../MessageLog'
import { sleep } from '../../utils/time'

const LEGENDARY = 0
const NON_LEGENDARY = 1

////////////////////////////////////////////////////////////////////////////////
const MATCH_FAILED = -1
const MATCH_EMPTY = 0

const MATCH_FUZZY_MANY = 2

const MATCH_SOMETHING = 4 // used for greater-than
const MATCH_FUZZY = 4
const MATCH_DIRECT = 8

const MATCH_RESOLVED = 16 // used for greater-than

const MATCH_FUZZY_ONE = 32
const MATCH_DIRECT_ONE = 64

function findMatch(map, key, orig) {
  const match = { orig, found: undefined, value: undefined }
  if (!key) {
    // cell doesn't exist, not an error, just non-existing
    return { ...match, matched: MATCH_EMPTY }
  } else if (map.gameIds[key]) {
    // direct match
    return { ...match, matched: MATCH_DIRECT, found: map.gameIds[key] }
  } else if (map.dense[key]) {
    // direct match
    return { ...match, matched: MATCH_DIRECT, found: map.dense[key] }
  } else {
    // not good, let's try a few things
    // console.log("Fuzzy match for", orig)
    const many = filterMatch(orig, map.clean)
    // console.log("Fuzzy match many", many)
    if (many.length === 1) {
      return { ...match, matched: MATCH_FUZZY, found: map.clean[many[0]] }
    } else if (many.length > 1) {
      return {
        ...match,
        matched: MATCH_FUZZY_MANY,
        found: many
          .map(key => map.clean[key])
          .reduce((acc, obj) => {
            Object.keys(obj).forEach(key => {
              acc[key] = obj[key]
            })
            return acc
          }, {})
      }
    } else {
      return { ...match, matched: MATCH_FAILED }
    }
  }
}

////////////////////////////////////////////////////////////////////////////////
function filterMatchElem(words, option) {
  return words.reduce((acc, word) => acc && option.includes(word), true)
}
function filterMatch(input, options) {
  const words = input.split(/\s+/).map(i => i.toLowerCase())
  const found = Object.keys(options).filter(option => {
    return filterMatchElem(words, option)
  })
  return found
}

////////////////////////////////////////////////////////////////////////////////
// function longest(array) {
//   let long = ''
//   array.forEach(elem => {
//     if (elem) {
//       if (!long) {
//         long = elem
//       } else if (elem.length > long.length) {
//         long = elem
//       }
//     }
//   })
//   return long
// }

////////////////////////////////////////////////////////////////////////////////
const stripData = data => data.toLowerCase().replace(/[^a-z0-9]/g, '')
const cleanData = data => data.toLowerCase().replace(/[^a-z0-9\s]/g, '')
const readData = data => data.replace(/^✓/, '')

////////////////////////////////////////////////////////////////////////////////
function reduceEffect(obj, key) {
  if (obj[key].matched >= MATCH_SOMETHING) {
    reduceEffectFound(obj, key)
  }
}

function reduceEffectFound(obj, key) {
  const found = Object.keys(obj[key].found)
  if (found.length > 1 && obj.type) {
    found.forEach(id => {
      if (obj.type.includes(obj[key].found[id].branch)) {
        obj[key].value = obj[key].found[id]
        obj[key].matched =
          obj[key].matched === MATCH_DIRECT ? MATCH_DIRECT_ONE : MATCH_FUZZY_ONE
      }
    })
  } else {
    obj[key].value = obj[key].found[found[0]]
    obj[key].matched =
      obj[key].matched === MATCH_DIRECT ? MATCH_DIRECT_ONE : MATCH_FUZZY_ONE
  }
  if (!obj[key].value) {
    obj.good = 0
  }
}

////////////////////////////////////////////////////////////////////////////////
const ICONS = {
  [MATCH_DIRECT_ONE]: <></>,
  [MATCH_FAILED]: <i className="fas fa-times red f7 mr1" />,
  [MATCH_DIRECT]: <i className="fas fa-question yellow f7 mr1" />,
  [MATCH_FUZZY]: <i className="fas fa-dice-d20 yellow f7 mr1" />,
  [MATCH_FUZZY_ONE]: <i className="fas fa-arrow-right gray f7 mr1" />,
  [MATCH_FUZZY_MANY]: <i className="fas fa-radiation yellow f7 mr1" />,
  arrow: <i className="fas fa-dice-d20 green f7 mr1" />
}
function FormatCell({ value }) {
  let icon = <></>
  let label = value.orig
  let more = <></>
  switch (value.matched) {
    case MATCH_EMPTY:
      return <td></td>
    case MATCH_FUZZY_ONE:
      more = (
        <>
          {ICONS['arrow']}
          <div className="gray">{value.orig}</div>
        </>
      )
    // eslint-disable-next-line
    case MATCH_DIRECT_ONE:
      label = value.value.value || value.value.label
    // eslint-disable-next-line
    default:
      icon = ICONS[value.matched]
      break
    case MATCH_FUZZY_MANY:
      // const many = reduceMany(value.many)
      // {value.many.map(item => <div key={item}>{item}</div>)}
      more = (
        <>
          {ICONS[MATCH_FUZZY_MANY]}
          <div className="gray">{value.orig}</div>
        </>
      )
      icon = ICONS[MATCH_FUZZY_ONE]
      label = (
        <div>
          {Object.keys(value.found).map(key => {
            const item = value.found[key]
            return (
              <div key={key}>
                ({item.value}) {item.label}
              </div>
            )
          })}
        </div>
      )
  }
  return (
    <td>
      <div className="flex items-center f6">
        {more} {icon} {label}
      </div>
    </td>
  )
}

////////////////////////////////////////////////////////////////////////////////
function handleCsvLoad({ input, mapped, setStats, setData, setShowLog }) {
  if (input.length <= 1) {
    addLog('Not enough rows in data', setShowLog)
    return
  }
  const headers = input[0].map(k => k.toLowerCase())
  const stat = { good: 0, partial: 0, bad: 0, type: LEGENDARY }
  let parsed
  if (headers.includes('prefix')) {
    parsed = processLegendaryCsv({ stat, mapped, input, headers })
  } else {
    stat.type = NON_LEGENDARY
    parsed = processNonLegendaryCsv({ stat, mapped, input, headers })
  }
  setData(parsed)
  setStats(stat)
}

function processNonLegendaryCsv({ stat, mapped, input, headers }) {
  return []
}

function processLegendaryCsv({ input, headers, stat, mapped }) {
  return input.slice(1).reduce((acc, row, x) => {
    if (row.length !== headers.length) {
      return acc
    }
    // zip header and row together
    const result = headers.reduce(
      (o, k, i) => ({
        ...o,
        [k]: readData(row[i]),
        ['_' + k]: stripData(readData(row[i]))
      }),
      {}
    )

    if (result._prefix.length === 0) {
      return acc
    }

    // now match
    const o = {
      id: x,
      good: -1,
      prefix: findMatch(mapped.effects, result._prefix, result.prefix),
      major: findMatch(mapped.effects, result._major, result.major),
      minor: findMatch(mapped.effects, result._minor, result.minor),
      item: findMatch(mapped.items, result._type, result.type),
      type: undefined,
      notes: result.notes,
      level: result._level,
      sale: result._saleprice
    }

    if (o.item.matched >= MATCH_SOMETHING) {
      reduceEffect(o, 'item')
      o.type = o.item.value.meta.has
    }
    reduceEffect(o, 'prefix')
    reduceEffect(o, 'major')
    reduceEffect(o, 'minor')
    if (
      goodCell(o.prefix) &&
      goodCell(o.major) &&
      goodCell(o.minor) &&
      goodCell(o.item)
    ) {
      o.good = 1
      stat.good++
    } else {
      stat.bad++
    }
    return acc.concat(o)
  }, [])
}

const goodCell = obj =>
  obj.matched >= MATCH_RESOLVED || obj.matched === MATCH_EMPTY

////////////////////////////////////////////////////////////////////////////////
function handleCsvError({ error, setShowLog }) {
  console.log('ERRORS', error)
  addLog(`We had an error! ${error}`, setShowLog)
}

////////////////////////////////////////////////////////////////////////////////
function putSetAddFor(into, key, item, cleaner) {
  const skey = cleaner(key)
  if (!into[skey]) {
    into[skey] = {}
  }
  into[skey][item.id] = item
}

function setAddD(into, key, item) {
  if (!key) {
    return
  }
  putSetAddFor(into.dense, key, item, stripData)
  putSetAddFor(into.clean, key, item, cleanData)
}

////////////////////////////////////////////////////////////////////////////////
function mapTaxonomy({ taxonomy, mapped }) {
  taxonomy['gameIds'] = {}
  Object.keys(taxonomy.tree).forEach(branch => {
    let into
    if (branch.includes('Item')) {
      into = mapped.items
    } else {
      into = mapped.effects
    }
    Object.keys(taxonomy.tree[branch]).forEach(label => {
      const item = taxonomy.tree[branch][label]
      setAddD(into, item.label, item)
      setAddD(into, item.value, item)
      setAddD(into, item.meta.name, item)
      setAddD(into, item.meta.text, item)
      if (item.gameId) {
        putSetAddFor(into.gameIds, item.gameId, item, x => x.toLowerCase())
      }
    })
  })
}

////////////////////////////////////////////////////////////////////////////////
function LocalImport({ context }) {
  const [data, setData] = useState(undefined)
  const [stats, setStats] = useState(undefined)
  const [characterScope, setCharacterScope] = useState([])
  const [characterDict, setCharacterDict] = useState(null)
  const [showLog, setShowLog] = useState(0)

  const { wait, taxonomy } = loadTaxonomy(
    useQuery(LOAD_TAXONOMY_NODES_HAS, itemArgs(context)),
    useQuery(LOAD_TAXONOMY_NODES, effectArgs(context)),
    context
  )

  // / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / /
  // map the taxonomy to how we are doing the columns
  const mapped = {
    items: {
      dense: {},
      clean: {},
      gameIds: {}
    },
    effects: {
      dense: {},
      clean: {},
      gameIds: {}
    }
  }
  if (!wait && taxonomy) mapTaxonomy({ taxonomy, mapped })

  const activeChar =
    characterScope.length === 1 && characterDict[characterScope[0]]

  // / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / /
  return (
    <div className="ma0 pa0 pa4-l flex justify-center">
      <div className="fo-frame pa2 w-100">
        <Scrollbar className="scroll2 w-100">
          <div className="flex items-center justify-between">
            <CSVReader
              label="Select CSV from a Rogue Trader template"
              onFileLoaded={input =>
                handleCsvLoad({ input, setData, mapped, setStats, setShowLog })
              }
              onError={error => handleCsvError({ error, setShowLog })}
              inputStyle={{ color: 'red' }}
            />
            {data && stats ? (
              <div className="mv2 f7 flex items-center justify-center">
                {stats.bad > 0 ? (
                  <button
                    className="ml2"
                    onClick={() => {
                      saveBadRows(data, stats.type)
                    }}
                  >
                    Save Problems ({stats.bad})
                  </button>
                ) : null}
                {activeChar ? (
                  stats.good > 0 ? (
                    <button
                      className="ml2"
                      onClick={() => {
                        importGoodRows(
                          context.apollo,
                          data,
                          stats.type,
                          activeChar,
                          setShowLog
                        )
                      }}
                    >
                      Import Good
                      <i className="fas fa-check green f7 mh2" />({stats.good})
                    </button>
                  ) : null
                ) : null}
              </div>
            ) : (
              <div className="i mv1 b tc">
                <div>Select a file to preview.</div>
                <div>
                  Reference the{' '}
                  <a
                    rel="noopener noreferrer"
                    target="_blank"
                    href="https://docs.google.com/spreadsheets/d/1-zIX9YJGOMrPdm7-xPWsB29LjEYoEHegld4TOR44v8w/edit#gid=1988987951"
                  >
                    Rogue Trader Data Import Sheet
                  </a>{' '}
                  for more details!
                </div>
              </div>
            )}
            <div className="flex items-center">
              <div className="mr2">
                Import To:{' '}
                {activeChar ? activeChar.name : ' NONE-PLEASE SELECT'}
              </div>
              <CharacterMenu
                context={context}
                characterScope={[characterScope, setCharacterScope]}
                characterDict={[characterDict, setCharacterDict]}
                menuHeader={<div className="ph1 pv2">Active Character:</div>}
              />
            </div>
          </div>
          <div className="mv2 f7 flex justify-center">
            Legend:
            <div className="mh2">
              <i className="fas fa-check green f7" />
              =good row
            </div>
            <div className="mh2">
              <i className="fas fa-times red f7" />
              =problem: no match
            </div>
            <div className="mh2">
              <i className="fas fa-question yellow f7" />
              =problem: matched, but not valid
            </div>
            <div className="mh2">
              <i className="fas fa-dice-d20 green f7" />
              =fuzzy matched one - may not be right
            </div>
            <div className="mh2">
              <i className="fas fa-radiation yellow f7" />
              =fuzzy match many
            </div>
          </div>
          {data ? (
            stats && stats.type === LEGENDARY ? (
              <>
                <table className="w-100">
                  <thead>
                    <tr>
                      <th></th>
                      <th></th>
                      <th className="f7">
                        <label>prefix</label>
                      </th>
                      <th className="f7">
                        <label>item / type</label>
                      </th>
                      <th className="f7">
                        <label>major</label>
                      </th>
                      <th className="f7">
                        <label>minor</label>
                      </th>
                      <th className="f7">
                        <label>lvl</label>
                      </th>
                      <th className="f7">
                        <label>notes</label>
                      </th>
                      <th className="f7">
                        <label>sale</label>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map(row => {
                      return (
                        <tr key={row.id} className={style.row}>
                          <td className="gray f7 tr">{row.id + 1}:</td>
                          <td>
                            {row.good === 1 ? (
                              <i className="fas fa-check green f7" />
                            ) : null}
                          </td>
                          <FormatCell value={row.prefix} />
                          <FormatCell value={row.item} />
                          <FormatCell value={row.major} />
                          <FormatCell value={row.minor} />
                          <td className="f6">{row.level}</td>
                          <td className="f6">{row.notes}</td>
                          <td className="f6">{row.sale}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>
            ) : (
              <i>Non legendary</i>
            )
          ) : null}
        </Scrollbar>
      </div>
      <MessageLog show={showLog} setShow={setShowLog} />
    </div>
  )
}

function submitMutation(apollo, row, activeChar, afterSubmit) {
  let effects = itemAsArray(row).slice(1)

  const vars = {
    characterId: activeChar.id,
    taxonomyId: row.item.value.id,
    effects: effects.join('/'),
    meta: JSON.stringify({
      level: row.level,
      qty: 1,
      note: row.notes,
      estimate: { SWAG: row.sale }
    })
  }

  apollo
    .mutate({ mutation: UPSERT_GAME_ITEM_INVENTORY, variables: vars })
    .then(data => {
      afterSubmit()
    })
}

function itemAsArray(row) {
  let list = [row.item.value.value, row.prefix.value.value]
  if (row.major.value) {
    list = list.concat(row.major.value.value)
    if (row.minor.value) {
      list = list.concat(row.minor.value.value)
    }
  }
  return list
}

function formatItem(row) {
  let item = itemAsArray(row)
  return `${item.slice(1).join('/')} ${item[0]}`
}

async function importGoodRows(apollo, rows, type, activeChar, setShowLog) {
  const subrows = rows.filter(row => row.good === 1)
  for (let x = 0; x < subrows.length; x++) {
    const row = subrows[x]
    submitMutation(apollo, row, activeChar, () => {
      addLog(`added item: ${formatItem(row)}`, setShowLog, true)
    })
    await sleep(200)
  }
  addLog('done importing', setShowLog, true)
}

function csvCell(value) {
  if (!value) {
    return ''
  } else if (value.includes(',')) {
    return JSON.stringify(value).replace(/\\"/g, '""')
  } else {
    return value
  }
}

function formatBest(value) {
  if (value.raw) {
    return value.text
  } else {
    if (value.value && value.value.value) {
      return `✓${value.value.value}`
    } else {
      return value.orig
    }
  }
}

function saveBadRows(rows, type) {
  let csv = 'data:text/csv;charset=utf-8,'
  let toRow
  if (type === LEGENDARY) {
    csv += 'prefix,type,major,minor,level,notes,saleprice\n'
    toRow = row => {
      return [
        row.prefix,
        row.item,
        row.major,
        row.minor,
        row.level,
        { raw: true, text: row.notes },
        { raw: true, text: row.sale }
      ].map(formatBest)
    }
  } else {
    csv += 'name,nodes,saleprice\n'
    toRow = row => []
  }
  csv += rows
    .filter(row => row.good !== 1)
    .map(row =>
      toRow(row)
        .map(csvCell)
        .join(',')
    )
    .join('\n')
  window.open(encodeURI(csv))
}

export default LocalImport
