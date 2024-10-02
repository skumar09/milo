#!/bin/bash

EXIT_STATUS=0
URLS="${INPUT_URLS:-}"

# Retrieve the user who triggered the workflow
TRIGGERED_BY="${TRIGGERED_BY:-unknown}"
echo "This workflow was manually triggered by: $TRIGGERED_BY"

if [ -z "$URLS" ]; then
  echo "No URLs provided. Exiting."
  exit 1
fi

# Log the Playwright command that will run
echo "Running Accessibility Tests on URLs: $URLS"
echo "Run Command: npx playwright test --config=nala/configs/a11y.config.js"

# Install dependencies
npm ci
npx playwright install --with-deps

# Run Playwright tests specifically for accessibility using a custom config
npx playwright test --config=.nala/configs/a11y.config.js || EXIT_STATUS=$?

# Check if tests passed or failed
if [ $EXIT_STATUS -ne 0 ]; then
  echo "Some tests failed. Exiting with error."
  exit $EXIT_STATUS
else
  echo "All accessibility tests passed successfully."
fi
