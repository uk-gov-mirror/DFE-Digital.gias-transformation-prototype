//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()
const giasData = require('./data/gias_prototype.json')
const predecessorsData = require('./data/predecessors.json')
const governanceData = require('./data/governance.json')

// ---------------------------------------------------------------------------
// DOWNLOAD
// ---------------------------------------------------------------------------

router.post('/download/start', function (req, res) {
  res.redirect('/downloading')
})


// ---------------------------------------------------------------------------
// SEARCH
// ---------------------------------------------------------------------------

const RESULTS_PER_PAGE = 20

// Build a set of closed establishment IDs that have been matched as predecessors.
// (Retained only for the establishment History tab; no longer used to filter search.)
const matchedPredecessorIds = new Set()
Object.values(predecessorsData).forEach(function (preds) {
  preds.forEach(function (p) {
    matchedPredecessorIds.add(p.id)
  })
})

// Search runs against the full dataset (open and closed). Whether closed
// records appear is controlled at request time by the "Show open providers
// only" toggle and the Status filter — not by pre-splitting the data.
const allData = giasData

// Full value lists for the autocomplete filter facets (computed once).
// These power the Local authority and Diocese "type to filter" inputs.
const allLocalAuthorities = Array.from(new Set(
  giasData.map(function (x) { return x.local_authority }).filter(Boolean)
)).sort()

const allDioceses = Array.from(new Set(
  giasData.map(function (x) { return x.diocese }).filter(Boolean)
)).sort()

// Index page
router.get('/index', function (req, res) {
  res.render('index')
})

// Autocomplete API endpoint
router.get('/api/schools', function (req, res) {
  var q = (req.query.q || '').toLowerCase()

  if (q.length < 2) {
    return res.json([])
  }

  var results = allData.filter(function (item) {
    return (
      (item.name && item.name.toLowerCase().indexOf(q) !== -1) ||
      (item.id && item.id.toLowerCase().indexOf(q) !== -1) ||
      (item.local_authority && item.local_authority.toLowerCase().indexOf(q) !== -1) ||
      (item.part_of && item.part_of.group_name && item.part_of.group_name.toLowerCase().indexOf(q) !== -1) ||
      (item.part_of && item.part_of.group_uid && item.part_of.group_uid.toLowerCase().indexOf(q) !== -1)
    )
  })

  res.json(results.slice(0, 20).map(function (item) {
    var identifier = item.id_type + ': ' + item.id
    var la = item.local_authority ? ' — ' + item.local_authority : ''
    return item.name + ' (' + identifier + ')' + la
  }))
})

// Results page
router.get('/results', function (req, res) {
  var q = (req.query.q || '').trim()
  var exactId = (req.query.id || '').trim()
  var currentPage = parseInt(req.query.page) || 1

  // Active filters
  var activeTypes = [].concat(req.query.type || []).filter(function (v) { return v !== '_unchecked' })
  var activeStatuses = [].concat(req.query.status || []).filter(function (v) { return v !== '_unchecked' })
  var activeLAs = [].concat(req.query.local_authority || []).filter(function (v) { return v !== '_unchecked' })
  var activeSen = [].concat(req.query.sen_provision || []).filter(function (v) { return v !== '_unchecked' })
  var activePhases = [].concat(req.query.phase || []).filter(function (v) { return v !== '_unchecked' })
  var activeGenders = [].concat(req.query.gender || []).filter(function (v) { return v !== '_unchecked' })
  var activeReligions = [].concat(req.query.religious_character || []).filter(function (v) { return v !== '_unchecked' })
  var activeDioceses = [].concat(req.query.diocese || []).filter(function (v) { return v !== '_unchecked' })
  var activeSection41 = [].concat(req.query.section_41 || []).filter(function (v) { return v !== '_unchecked' })

  // Record kind: 'provider' (URN) or 'group' (UID / Group UID). Drives the
  // "Education providers only" / "Provider groups only" quick-search links.
  var kind = (req.query.kind === 'provider' || req.query.kind === 'group') ? req.query.kind : null

  // Sort order: 'az' (default) or 'za'
  var sortOrder = (req.query.sort === 'za') ? 'za' : 'az'

  // "Show open providers only" toggle. When on, results are constrained to
  // open records and this overrides the Status filter (the toggle wins).
  //
  // The GOV.UK checkbox posts 'open-only' when ticked, or '_unchecked' when the
  // form is submitted with it unticked. On a fresh page load with no query at
  // all, it defaults to on (matching the ticked-by-default design).
  var openOnlyRaw = [].concat(req.query['open-only'] || [])
  var formSubmitted = Object.keys(req.query).length > 0
  var openOnly
  if (!formSubmitted) {
    openOnly = true // default state on a fresh search
  } else {
    openOnly = openOnlyRaw.indexOf('open-only') !== -1
  }

  // Base search against active data only
  var searchResults = []

  if (exactId) {
  searchResults = allData.filter(function (item) {
    return item.id === exactId
  })
} else if (q === '*' || q.length === 0) {
  searchResults = allData
} else if (q.length > 0) {
    var qLower = q.toLowerCase()
    searchResults = allData.filter(function (item) {
      return (
        (item.name && item.name.toLowerCase().indexOf(qLower) !== -1) ||
        (item.id && item.id.toLowerCase().indexOf(qLower) !== -1) ||
        (item.local_authority && item.local_authority.toLowerCase().indexOf(qLower) !== -1) ||
        (item.part_of && item.part_of.group_name && item.part_of.group_name.toLowerCase().indexOf(qLower) !== -1) ||
        (item.part_of && item.part_of.group_uid && item.part_of.group_uid.toLowerCase().indexOf(q) !== -1)
      )
    })
  }

  // Calculate counts from full search results (before filtering)
  var typeCounts = {}
  var statusCounts = {}
  var laCounts = {}
  var senCounts = { 'true': 0, 'false': 0 }
  var phaseCounts = {}
  var genderCounts = {}
  var religionCounts = {}
  var dioceseCounts = {}
  var section41Counts = {}

  searchResults.forEach(function (item) {
    if (item.type) typeCounts[item.type] = (typeCounts[item.type] || 0) + 1
    if (item.status) statusCounts[item.status] = (statusCounts[item.status] || 0) + 1
    if (item.local_authority) laCounts[item.local_authority] = (laCounts[item.local_authority] || 0) + 1
    var senKey = item.sen_provision ? 'true' : 'false'
    senCounts[senKey]++
    if (item.phase) phaseCounts[item.phase] = (phaseCounts[item.phase] || 0) + 1
    if (item.gender) genderCounts[item.gender] = (genderCounts[item.gender] || 0) + 1
    if (item.religious_character) religionCounts[item.religious_character] = (religionCounts[item.religious_character] || 0) + 1
    if (item.diocese) dioceseCounts[item.diocese] = (dioceseCounts[item.diocese] || 0) + 1
    if (item.section_41) section41Counts[item.section_41] = (section41Counts[item.section_41] || 0) + 1
  })

  // Apply filters
  var filteredResults = searchResults.filter(function (item) {
    // Record kind: provider = URN, group = UID / Group UID.
    if (kind === 'provider' && item.id_type !== 'URN') return false
    if (kind === 'group' && item.id_type !== 'UID' && item.id_type !== 'Group UID') return false
    // "Show open providers only" wins over the Status filter when on.
    if (openOnly) {
      if (item.status === 'Closed') return false
    } else if (activeStatuses.length > 0 && activeStatuses.indexOf(item.status) === -1) {
      return false
    }
    if (activeTypes.length > 0 && activeTypes.indexOf(item.type) === -1) return false
    if (activeLAs.length > 0 && activeLAs.indexOf(item.local_authority) === -1) return false
    if (activeSen.length > 0 && activeSen.indexOf(String(item.sen_provision)) === -1) return false
    if (activePhases.length > 0 && activePhases.indexOf(item.phase) === -1) return false
    if (activeGenders.length > 0 && activeGenders.indexOf(item.gender) === -1) return false
    if (activeReligions.length > 0 && activeReligions.indexOf(item.religious_character) === -1) return false
    if (activeDioceses.length > 0 && activeDioceses.indexOf(item.diocese) === -1) return false
    if (activeSection41.length > 0 && activeSection41.indexOf(item.section_41) === -1) return false
    return true
  })

  // Sort by name (A–Z or Z–A)
  filteredResults.sort(function (a, b) {
    var nameA = a.name.replace(/^[^a-zA-Z0-9]+/, '')
    var nameB = b.name.replace(/^[^a-zA-Z0-9]+/, '')
    var cmp = nameA.localeCompare(nameB)
    return sortOrder === 'za' ? -cmp : cmp
  })

  var totalResults = filteredResults.length
  var totalPages = Math.ceil(totalResults / RESULTS_PER_PAGE) || 1

  if (currentPage < 1) currentPage = 1
  if (currentPage > totalPages) currentPage = totalPages

  var startIndex = (currentPage - 1) * RESULTS_PER_PAGE
  var pageResults = filteredResults.slice(startIndex, startIndex + RESULTS_PER_PAGE)

  // Add member counts for groups
  pageResults = pageResults.map(function (item) {
    if (item.id_type === 'UID' || item.id_type === 'Group UID') {
      var memberCount = giasData.filter(function (school) {
        return school.part_of && school.part_of.group_uid === item.id
      }).length
      return Object.assign({}, item, { memberCount: memberCount })
    }
    return item
  })

  // Pagination items
  var paginationItems = []
  if (totalPages > 1) {
    for (var i = 1; i <= totalPages; i++) {
      var showPage = (
        i === 1 ||
        i === totalPages ||
        i === currentPage ||
        i === currentPage - 1 ||
        i === currentPage + 1
      )
      if (showPage) {
        paginationItems.push({
          number: i,
          current: i === currentPage,
          href: buildPageUrl(req, i)
        })
      } else if (
        paginationItems.length > 0 &&
        !paginationItems[paginationItems.length - 1].ellipsis
      ) {
        paginationItems.push({ ellipsis: true })
      }
    }
  }

  // Build filter option lists
  var typeOptions = Object.keys(typeCounts).sort().map(function (type) {
    return {
      value: type,
      text: type + ' (' + typeCounts[type] + ')',
      checked: activeTypes.indexOf(type) !== -1
    }
  })

  var statusOptions = Object.keys(statusCounts).sort().map(function (status) {
    return {
      value: status,
      text: status + ' (' + statusCounts[status] + ')',
      checked: activeStatuses.indexOf(status) !== -1
    }
  })

  var laOptions = Object.keys(laCounts).sort().map(function (la) {
    return {
      value: la,
      text: la + ' (' + laCounts[la] + ')',
      checked: activeLAs.indexOf(la) !== -1
    }
  })

  var senOptions = [
    {
      value: 'true',
      text: 'Yes (' + senCounts['true'] + ')',
      checked: activeSen.indexOf('true') !== -1
    },
    {
      value: 'false',
      text: 'No (' + senCounts['false'] + ')',
      checked: activeSen.indexOf('false') !== -1
    }
  ]

  function buildOptions (counts, active) {
    return Object.keys(counts).sort().map(function (key) {
      return {
        value: key,
        text: key + ' (' + counts[key] + ')',
        checked: active.indexOf(key) !== -1
      }
    })
  }

  var phaseOptions = buildOptions(phaseCounts, activePhases)
  var genderOptions = buildOptions(genderCounts, activeGenders)
  var religionOptions = buildOptions(religionCounts, activeReligions)
  var dioceseOptions = buildOptions(dioceseCounts, activeDioceses)
  var section41Options = buildOptions(section41Counts, activeSection41)

  // Build selected filter tags
  var selectedCategories = []

  if (activeTypes.length > 0) {
    selectedCategories.push({
      heading: { text: 'Type' },
      items: activeTypes.map(function (val) {
        return { text: val, href: buildRemoveFilterUrl(req, 'type', val) }
      })
    })
  }

  if (activeStatuses.length > 0) {
    selectedCategories.push({
      heading: { text: 'Status' },
      items: activeStatuses.map(function (val) {
        return { text: val, href: buildRemoveFilterUrl(req, 'status', val) }
      })
    })
  }

  if (activeLAs.length > 0) {
    selectedCategories.push({
      heading: { text: 'Local authority' },
      items: activeLAs.map(function (val) {
        return { text: val, href: buildRemoveFilterUrl(req, 'local_authority', val) }
      })
    })
  }

  if (activeSen.length > 0) {
    selectedCategories.push({
      heading: { text: 'SEN provision' },
      items: activeSen.map(function (val) {
        return { text: val === 'true' ? 'Yes' : 'No', href: buildRemoveFilterUrl(req, 'sen_provision', val) }
      })
    })
  }

  function tagCategory (label, key, active) {
    if (active.length > 0) {
      selectedCategories.push({
        heading: { text: label },
        items: active.map(function (val) {
          return { text: val, href: buildRemoveFilterUrl(req, key, val) }
        })
      })
    }
  }

  tagCategory('Phase of education', 'phase', activePhases)
  tagCategory('Gender', 'gender', activeGenders)
  tagCategory('Religious character', 'religious_character', activeReligions)
  tagCategory('Diocese', 'diocese', activeDioceses)
  tagCategory('Section 41 approved', 'section_41', activeSection41)

  var hasActiveFilters = selectedCategories.length > 0

  res.render('results', {
    results: pageResults,
    query: q || exactId,
    totalResults: totalResults,
    currentPage: currentPage,
    totalPages: totalPages,
    paginationItems: paginationItems,
    prevHref: currentPage > 1 ? buildPageUrl(req, currentPage - 1) : null,
    nextHref: currentPage < totalPages ? buildPageUrl(req, currentPage + 1) : null,
    typeOptions: typeOptions,
    statusOptions: statusOptions,
    laOptions: laOptions,
    senOptions: senOptions,
    phaseOptions: phaseOptions,
    genderOptions: genderOptions,
    religionOptions: religionOptions,
    dioceseOptions: dioceseOptions,
    section41Options: section41Options,
    allLocalAuthorities: allLocalAuthorities,
    allDioceses: allDioceses,
    activeLAs: activeLAs,
    activeDioceses: activeDioceses,
    sortOrder: sortOrder,
    openOnly: openOnly,
    kind: kind,
    selectedCategories: selectedCategories,
    hasActiveFilters: hasActiveFilters,
    clearFiltersHref: buildClearFiltersUrl(req),
    searchQ: q,
    searchId: exactId,
    currentUrl: req.originalUrl
  })
})


// Individual school/group detail page
router.get('/establishment/:id', function (req, res) {
  // Search all data including closed establishments
  var id = req.params.id
  var item = giasData.find(function (item) {
    return item.id === id
  })

  if (!item) {
    return res.status(404).render('404')
  }

  // If it's a group, find all member schools
  var members = []
  if (item.id_type === 'UID' || item.id_type === 'Group UID') {
    members = giasData.filter(function (school) {
      return school.part_of && school.part_of.group_uid === id
    })
  }

  // Find any predecessor establishments
  var predecessors = predecessorsData[id] || []

  // Governance record (governors for providers; trustees + members for groups)
  var governance = governanceData[id] || null

  res.render('establishment', {
    item: item,
    members: members,
    predecessors: predecessors,
    governance: governance,
    backLink: req.query.from || '/results'
  })
})

// View all establishments
router.get('/all', function (req, res) {
  res.redirect('/results?q=*')
})


function buildPageUrl (req, page) {
  var params = Object.assign({}, req.query, { page: page })
  var qs = Object.keys(params).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k])
  }).join('&')
  return '/results?' + qs
}


function buildRemoveFilterUrl (req, filterKey, filterValue) {
  var params = Object.assign({}, req.query)
  var values = [].concat(params[filterKey] || []).filter(function (v) {
    return v !== filterValue && v !== '_unchecked'
  })
  if (values.length > 0) {
    params[filterKey] = values
  } else {
    delete params[filterKey]
  }
  delete params.page
  var qs = Object.keys(params).map(function (k) {
    return [].concat(params[k]).filter(function (v) {
      return v !== '_unchecked'
    }).map(function (v) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(v)
    }).join('&')
  }).filter(Boolean).join('&')
  return '/results?' + qs
}


function buildClearFiltersUrl (req) {
  var params = {}
  if (req.query.q) params.q = req.query.q
  if (req.query.id) params.id = req.query.id
  var qs = Object.keys(params).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k])
  }).join('&')
  return '/results?' + qs
}


