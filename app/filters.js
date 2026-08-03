//
// For guidance on how to create filters see:
// https://prototype-kit.service.gov.uk/docs/filters
//

const govukPrototypeKit = require('govuk-prototype-kit')
const addFilter = govukPrototypeKit.views.addFilter

// Add your filters here

// Updates the date with the current date
const moment = require('moment')

addFilter('govukDate', function (date) {
  const d = (date === 'now' || !date) ? moment() : moment(date)
  return d.format('D MMMM YYYY')
})