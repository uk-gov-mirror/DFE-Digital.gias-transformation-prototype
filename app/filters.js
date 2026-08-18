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
  if (date === 'now' || !date) {
    return moment().format('D MMMM YYYY')
  }
  // GIAS dates are day-first: 'DD-MM-YYYY' or 'DD/MM/YYYY'. Also accept ISO
  // ('YYYY-MM-DD') for any other sources. strict parsing avoids misreads.
  const d = moment(date, ['DD-MM-YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', moment.ISO_8601], true)
  return d.isValid() ? d.format('D MMMM YYYY') : date
})