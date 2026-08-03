//
// For guidance on how to add JavaScript see:
// https://prototype-kit.service.gov.uk/docs/adding-css-javascript-and-images
//

window.GOVUKPrototypeKit.documentReady(() => {

  // ---------------------------------------------------------------------------
  // Download page: hide the "version" question when "Updates only" is selected
  // ---------------------------------------------------------------------------

  const scopeRadios = document.querySelectorAll('input[name="download-scope"]')
  const versionQuestion = document.getElementById('download-version-question')

  if (scopeRadios.length && versionQuestion) {

    const updateVersionVisibility = () => {
      const selected = document.querySelector('input[name="download-scope"]:checked')
      const isUpdatesOnly = selected && selected.value === 'updates'

      if (isUpdatesOnly) {
        // Hide the question and clear any selected version radio
        versionQuestion.hidden = true
        versionQuestion
          .querySelectorAll('input[name="download-version"]:checked')
          .forEach((radio) => { radio.checked = false })
      } else {
        versionQuestion.hidden = false
      }
    }

    // React to the user changing the first question
    scopeRadios.forEach((radio) => {
      radio.addEventListener('change', updateVersionVisibility)
    })

    // Set the correct state on initial load
    updateVersionVisibility()
  }

})
