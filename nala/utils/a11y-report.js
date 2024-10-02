/* eslint-disable no-nested-ternary */

import path from 'node:path';
import { promises as fs } from 'fs';

export default async function generateA11yReport(report, outputDir) {
  const time = new Date();
  const reportName = `nala-a11y-report-${time.toISOString().replace(/[:.]/g, '-')}.html`;
  const reportPath = path.resolve(outputDir, reportName);

  console.log('A11Y-REPORT / reportPath: ', reportPath);
  // Check if the report contains violations
  if (!report || report.length === 0) {
    console.error('No accessibility violations to report.');
    return;
  }

  const testRunType = process.env.GITHUB_ACTIONS === 'true'
    ? 'GitHub Env Run'
    : process.env.CIRCLECI ? 'CircleCI Env Run' : 'Local Run';

  // const localBranch = process.env.LOCAL_BRANCH || 'N/A';

  let htmlContent = `
  <html>
  <head>
    <title>Nala Accessibility Report</title>
    <style>
      body { 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
        margin: 20px; 
        background-color: #f9f9f9; 
        color: #333;
      }
      h1, h2, h3 { 
        color: #333; 
      }
      h1 {
        font-size: 2em;
        text-align: left;
        margin-bottom: 20px;
      }
      h2, h3 {
        font-size: 1.2em;
        margin-bottom: 5px;
        font-weight: 500;
      }
      h2, h3 {
        text-align: left;
      }
      table { 
        width: 100%; 
        border-collapse: collapse; 
        margin: 20px 0; 
        background-color: #fff; 
        border: 1px solid #ddd; 
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      }
      th, td { 
        padding: 12px; 
        text-align: left; 
        border-bottom: 1px solid #eee;
        vertical-align: center; 
        font-size: 0.9em;
      }
      th { 
        background-color: #f5f5f5; 
        font-weight: bold;
      }
      td a { 
        color: #007bff; 
        text-decoration: none; 
      }
      td a:hover { 
        text-decoration: underline; 
      }
      tr:hover { 
        background-color: #f9f9f9; 
      }
      .severity-critical { 
        color: red; 
        font-weight: bold; 
        padding: 4px 8px; 
        border-radius: 4px; 
        background-color: #ffe6e6;
        text-align: center;
      }
      .severity-serious { 
        color: orange; 
        font-weight: bold; 
        padding: 4px 8px; 
        border-radius: 4px; 
        background-color: #fff2e6;
        text-align: center; 
      }
      .severity-moderate {
        color: #e6c600;
        font-weight: bold;
        text-align: center;
      }
      .section-header {
        margin-top: 30px;
        background-color: #f0f0f0;
        padding: 10px;
        border-left: 4px solid #007bff;
        border-bottom: 1px solid #ddd;
        font-size: 1.0em;
      }
      .node-summary {
        font-size: 0.85em;
        color: #555;
        margin-bottom: 8px;
      }
      .collapsible {
        cursor: pointer;
        background-color: #f1f1f1;
        padding: 10px;
        border: none;
        text-align: left;
        outline: none;
        font-size: 14px;
        margin-bottom: 5px;
      }
      .collapsible.active, .collapsible:hover {
        background-color: #ddd;
      }
      .content {
        padding: 0 18px;
        display: none;
        overflow: hidden;
        background-color: #f9f9f9;
      }
      /* Filter Buttons */
      .filter-btn {
        margin: 10px;
        padding: 10px;
        border: none;
        background-color: #007bff;
        color: white;
        cursor: pointer;
        font-size: 14px;
      }
      .filter-btn:hover {
        background-color: #0056b3;
      }
      .hidden {
        display: none;
      }
      .button-container {
        text-align: left;
        margin-bottom: 20px; /* Add space below buttons */
      }
      td.scrollable {
        max-width: 300px; /* Set a fixed width to control column size */
        max-height: 100px; /* Set a height to control the size of the content area */
        overflow: auto; /* Add scrolling functionality */
        white-space: pre-wrap; /* Preserve whitespace formatting */
        word-wrap: break-word; /* Break long words if necessary */
        font-size: 0.85em;
        background-color: #f9f9f9;
      }
              
    </style>
  </head>
  <body>
    <h1>Nala Accessibility Report</h1>
    <h2>Total Violations: ${report.length}</h2>
    <h3>Test Run: ${testRunType}</h3>

    <!-- Filter Buttons -->
    <div class="button-container">
      <button class="filter-btn" onclick="filterBySeverity('critical')">Show Critical</button>
      <button class="filter-btn" onclick="filterBySeverity('serious')">Show Serious</button>
      <button class="filter-btn" onclick="filterBySeverity('')">Show All</button>
    </div>`;

  report.forEach((result, resultIndex) => {
    htmlContent += `
      <div class="section-header">
        <h3>#${resultIndex + 1}.</h3>
        <h3>Test Name: ${result.testName || 'N/A'}</h3>
        <h3>Test Page: <a href="${result.url}" target="_blank">${result.url}</a></h3>
        <h3>Test Scope: ${result.testScope ? result.testScope : 'N/A'}</h3>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Violation</th>
            <th>Axe Rule ID</th>
            <th>Severity</th>
            <th>WCAG Tags</th>
            <th>Nodes Affected</th>
            <th>Possible Fix</th>
          </tr>
        </thead>
        <tbody>`;

    if (result.violations && result.violations.length > 0) {
      result.violations.forEach((violation, index) => {
        const description = violation.description || 'N/A';
        const ruleId = violation.id || 'N/A';
        const severity = violation.impact || 'N/A';
        const severityClass = `severity-${severity.toLowerCase()}`;
        const wcagTags = Array.isArray(violation.tags) ? violation.tags.join(', ') : 'N/A';
        const nodesAffected = violation.nodes && violation.nodes.length > 0
          ? violation.nodes.map((node) => `<p class="node-summary">${node.failureSummary || 'No summary available'}</p>`).join('')
          : 'No nodes affected';
        const possibleFix = violation.helpUrl
          ? `<a href="${violation.helpUrl}" target="_blank">Fix</a>`
          : 'N/A';

        htmlContent += `
          <tr class="${severityClass}">
            <td>${index + 1}</td>
            <td>${description}</td>
            <td>${ruleId}</td>
            <td class="${severityClass}">${severity}</td>
            <td>${wcagTags}</td>
            <td>
              <button class="collapsible">Show Nodes</button>
              <div class="content">
                ${nodesAffected}
              </div>
            </td>
            <td>${possibleFix}</td>
          </tr>`;
      });
    }

    htmlContent += `
        </tbody>
      </table>`;
  });

  htmlContent += `
    <script>
      // Collapsible Functionality
      const collapsibles = document.querySelectorAll(".collapsible");
      collapsibles.forEach((collapsible) => {
        collapsible.addEventListener("click", function() {
          this.classList.toggle("active");
          const content = this.nextElementSibling;
          if (content.style.display === "block") {
            content.style.display = "none";
          } else {
            content.style.display = "block";
          }
        });
      });

      // Filter Functionality
      function filterBySeverity(severity) {
        const rows = document.querySelectorAll('tbody tr');
        rows.forEach(row => {
          const rowSeverity = row.querySelector('td:nth-child(4)').textContent.toLowerCase();
          if (!severity || rowSeverity === severity) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      }
    </script>
  </body>
  </html>`;

  // Write the HTML report to file
  try {
    await fs.writeFile(reportPath, htmlContent);
    console.info(`Accessibility report saved at: ${reportPath}`);
  } catch (err) {
    console.error(`Failed to save accessibility report: ${err}`);
  }
}
